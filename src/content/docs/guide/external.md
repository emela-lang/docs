---
title: 外部関数
description: "@external による JS と C の関数の宣言、呼べる場所、ホストの型、境界を越えられる型、例外と失敗、非同期のホスト関数"
---

`@external` は、ホスト（JS や C）の関数を Emela から呼ぶための逃げ道です。本体のない `fn` に付けて宣言し、副作用のあるものはハンドラの中でしか呼べません。そのため、外部関数を使っても、すべての副作用は名前の付いたエフェクトを通ります。

```emela check
import Std.Console.{Console}

@external(js, "Math.hypot")
@external(c, "hypot")
fn hypot(x: Float, y: Float) -> Float use {}

@external(js, "console.log")
@external(c, "puts")
fn host_print(text: String) -> ()

handler HostConsole implements Console {
  fn print_line(text) { host_print(text) }
  fn print_error_line(text) { host_print(text) }
}

fn main() {
  d = hypot(3.0, 4.0)       # use {} なので、どこからでも呼べる
  with HostConsole {
    (use Console).print_line("distance: #{d}")
  }
}
```

```console
$ emela run main.emel
distance: 5.0
$ emela run --target c main.emel
distance: 5.0
```

ふだんのプログラムで `@external` を書くことはほとんどありません。ホストへ出る道は同梱の std の Console、Clock、FileSystem、Http などのエフェクト（[Platform](/std/platform/)）が受け持ちます。`@external` は、std にまだない機能をプロジェクトの中で使うときのものです。

## 宣言

```emela
@external(js, "console.log")
fn console_log(msg: String) -> ()

@external(js, "Math.sin")
@external(wasm, "env", "sin")
@external(c, "sin")
fn sin(x: Float) -> Float use {}

@external(js, "./http_ffi.mjs", "fetchText")
@external(wasm, "wasi:http/client", "fetch")
suspend fn fetch_text(url: String) -> String
```

コンパイラはホストの関数の中身を見られないので、引数と戻り値の型は必ず書きます。注釈はターゲット（`js`、`wasm`、`c`）ごとに1つ書き、1つの fn に並べられます。

`(js, "名前")` はグローバルから辿れる JS の関数（`console.log`、`Math.sin`）を指し、`(c, "名前")` はリンクのときに解決する C の関数（libc や OS のライブラリのもの）を指します。

`(ターゲット, "ファイル", "名前")` の形は自分で書いたホスト側のファイルを指します。ファイルは宣言を含むソースのディレクトリからの相対パスで、`./` か `../` で始めます。JS では `.mjs` のファイルから export した関数を指し、出力はそのファイルを絶対パスで読みます（出力の `target/emela/js` をソースと別の場所へ移すと動きません）。C では `.c` のファイルの関数を指し、コンパイラはそのファイルを出力と一緒に `cc` でコンパイルしてリンクします。

同梱の std も同じ形で書かれています。`Std.Clock` のソース（`clock.emel`）は隣の `clock.mjs` と `clock.c` を指しています。

```emela
@external(js, "./clock.mjs", "sleep")
@external(c, "./clock.c", "emela_clock_sleep")
suspend fn sleep_milliseconds(ms: Int) -> ()
```

:::caution[0.21 以降で入る予定]
`--target wasm` はまだありません。`@external(wasm, ...)` の注釈は書けますが、今のターゲットは `js` と `c` です。C のターゲットは Tier 2 です（[ターゲット](/reference/targets/)）。
:::

## 呼べる場所

| 宣言 | 意味 | 呼べる場所 |
|---|---|---|
| `use {}` を明記 | 純粋だと宣言する | どこからでも |
| `use` を省略 | ホストの副作用を持つ | ハンドラの init、release、操作の本体の中だけ |
| `suspend fn` | 完了を待つ必要がある。Async を要求する | ハンドラの中だけ |

```emela check=error
@external(js, "console.log")
fn console_log(msg: String) -> ()

fn main() {
  console_log("hi")
}
```

```text
error: external function `console_log` can only be used in handlers
```

`use {}` の宣言が正しいかどうかを、コンパイラは検証できません。宣言した人が責任を持ちます。

制限は呼び出しだけでなく参照にも掛かります。use を省略した外部関数を関数の値としてハンドラの外へ持ち出すこともできません。外部関数のホストの副作用は R に載らず、外から見えるのはそれを包んだハンドラのエフェクトです。

suspend fn の外部関数は JS では Promise を返す関数に対応します。呼び出した fiber は完了まで中断します。

## JS のファイルを指す例

プロジェクトの `src/` に `.mjs` を置き、エフェクトのハンドラから呼びます。

```text
host-demo/
├── Pome.toml
└── src/
    ├── host.mjs
    └── main.emel
```

```toml
# Pome.toml
[pome]
name = "github.com/acme/host-demo"
version = "0.1.0"
emela = "0.20.1"
```

```js
// src/host.mjs
// Emela の Int は JS の number、String は string で渡ってくる
export function platform() {
  return process.platform;
}

// 失敗は例外にせず、値（-1）で返す
export function parsePort(text) {
  const n = Number.parseInt(text, 10);
  return Number.isInteger(n) && n >= 0 && n <= 65535 ? n : -1;
}

// suspend fn の外部関数は Promise を返す。最後の引数に AbortSignal が来る
export function wait(ms, signal) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => clearTimeout(timer), { once: true });
  });
}
```

```emela
# src/main.emel
import Std.Console.{Console, SystemConsole}

error BadPort(text: String)

effect Host {
  fn platform() -> String
  fn port(text: String) -> Int fails BadPort
  suspend fn pause(ms: Int) -> ()
}

@external(js, "./host.mjs", "platform")
fn host_platform() -> String

@external(js, "./host.mjs", "parsePort")
fn parse_port(text: String) -> Int use {}

@external(js, "./host.mjs", "wait")
suspend fn wait(ms: Int) -> ()

handler NodeHost implements Host {
  fn platform() { host_platform() }
  fn port(text) {
    n = parse_port(text)
    if n < 0 { fail BadPort(text:) } else { n }
  }
  suspend fn pause(ms, resume) {
    wait(ms)
    resume(())
  }
}

fn main() {
  with SystemConsole, NodeHost {
    host = use Host
    console = use Console
    console.print_line("platform: #{host.platform()}")
    host.pause(100)
    console.print_line("port: #{host.port("8080")}")
    p = host.port("http") escape { BadPort(text:) -> 80 }
    console.print_line("port: #{p}")
  }
}
```

```console
$ emela run .
platform: darwin
port: 8080
port: 80
```

`main` から見えるのは Host のエフェクトだけです。テストでは Host のハンドラを差し替えれば、`.mjs` なしで動きます（[エフェクトとハンドラ](/guide/effects/)）。

### AbortSignal

JS では、suspend fn の外部関数の最後の引数に、ランタイムが `AbortSignal` を足して渡します。待っている fiber が中断されると abort します。通信やタイマーを止めるためのもので、使わない関数は無視してかまいません。

上の `host.mjs` の `wait` を `Fiber.timeout` の中で待たせると、違いが分かります。

```emela
r = Fiber.timeout(50, fn() { (use Host).pause(10000) })
(use Console).print_line("#{r}")    # None
```

`signal` で `clearTimeout` する `wait` なら、プログラムは 50 ミリ秒ほどで終わります。`signal` を無視する `wait` だと、`None` を出した後もタイマーが残り、プロセスが終わるまで 10 秒かかります。

止まるのはこの形で待つものだけで、ハンドラがコールバックで後から resume する形のものは止まりません。同梱のハンドラ（SystemClock の sleep を含む）はこの形で書かれています。

## ホストの型

フィールドを持たない `@external type` はホスト側のオブジェクトを表す不透明な型です。

```emela check
@external
type JsValue

@external(js, "JSON.parse")
fn parse(text: String) -> JsValue use {}

@external(js, "JSON.stringify")
fn stringify(value: JsValue) -> String use {}

fn main() {
  v = parse("{ \"name\": \"alice\",  \"tags\": [1, 2] }")
  dbg(stringify(v))    # "{\"name\":\"alice\",\"tags\":[1,2]}"
}
```

Emela からは持ち回ることしかできず、中身を見るにはそれを受け取る外部関数を書きます。C では `@external type` の値はホストのポインタ（`void *`）で、Emela は解放も検査もしません。解放はハンドラの release から、解放する外部関数を呼んでします（下の C の例）。

## 境界を越えられる型

外部関数の引数と戻り値に使えるのは、次の型だけです。

- Int、Int64、Float、Bool、String、`()`
- `@external type` で宣言した型
- 上の型だけからなる関数型（コールバック）

List や Option、自分で定義した型は直接は渡せません。ハンドラの中で変換します。同梱の SystemEnv は `Option[String]` を返したいので、ホストからは「あるか」（Bool）と「値」（String）を別々の外部関数で受け取り、ハンドラの中で `Some` / `None` に組み立てています。

`()` を返す外部関数は、ホストの戻り値を捨てて `()` を返します。上の `host_print` を `console.log` や `puts` に向けられるのはこのためです。

:::caution[実装との違い]
今のコンパイラ（0.20.1）は、JS のターゲットでは List や利用者の型の引数を拒まず、内部の表現のまま渡してしまいます。C のターゲットでは「cannot cross to C」のエラーになります。どちらのターゲットでも、上の型だけを使ってください。
:::

### コールバック

関数型の引数はホストから呼ばれるコールバックになります。

```emela check
import Std.Console.{Console, SystemConsole}

effect Timer {
  fn later(ms: Int, f: fn() -> String) -> ()
}

@external(js, "setTimeout")
fn set_timeout(f: fn() -> String, ms: Int) -> ()

handler JsTimer implements Timer {
  fn later(ms, f) { set_timeout(f, ms) }
}

fn main() {
  with SystemConsole, JsTimer {
    (use Timer).later(10, fn() { dbg("fired") })
    (use Console).print_line("scheduled")
  }
}
```

```console
$ emela run main.emel
scheduled
"fired"
```

ホストはコールバックがその場で終わることを前提に呼ぶので、外部関数に渡す関数は Immediate（中断しない）でなければなりません。中断しうるエフェクトを使う関数を渡すとエラーです。

```emela check=error
import Std.Clock.{Clock, SystemClock}

@external(js, "setTimeout")
fn set_timeout(f: fn() -> (), ms: Int) -> ()

effect Timer {
  suspend fn later(ms: Int) -> ()
}

handler JsTimer implements Timer {
  suspend fn later(ms, resume) {
    set_timeout(fn() { (use Clock).sleep(1) }, ms)
    resume(())
  }
}

fn main() {
  with SystemClock, JsTimer { (use Timer).later(10) }
}
```

```text
error: effect `Clock` may suspend, but callbacks passed to external function `set_timeout` must be `Immediate`
```

コールバックからファイルや通信を扱いたいときは、Deferred で fiber に合図を送ります（[並行処理](/guide/concurrency/)）。C のターゲットはまだコールバックを持ちません。

### C の型

`c` のターゲットでは、Emela の型を次の C の型に写します。C の関数のプロトタイプはこの表で決まり、コンパイラは C のヘッダを読みません。宣言とホストの関数の型が合わないときの振る舞いは決めていません。

| Emela の型 | C の引数 | C の戻り値 |
|---|---|---|
| Int | `int32_t` | `int32_t` |
| Int64 | `int64_t` | `int64_t` |
| Float | `double` | `double` |
| Bool | `bool`（C99 の `_Bool`） | `bool` |
| String | `const char *`（NUL 終端の UTF-8） | `char *`（NUL 終端。`malloc` で確保したもの） |
| `()` | 引数にしない | `void` |
| `@external type` | `void *` | `void *` |
| 関数型 | まだない | まだない |

C に渡す String の写しは呼び出しの間だけ有効です。後から使うなら C の側で写します。C から受け取った String は、ランタイムが Emela の文字列に写した後すぐに `free` します。`size_t` や `int` のような表にない型は、C の側に小さな関数を書いて表の型に直します。

## C のファイルを指す例

`.c` のファイルを `src/` に置き、`@external type` でホストのオブジェクトを持ち回ります。init で作り、release で解放します。

```text
counter/
├── Pome.toml
└── src/
    ├── counter.c
    └── main.emel
```

```toml
# Pome.toml
[pome]
name = "github.com/acme/counter"
version = "0.1.0"
emela = "0.20.1"

[build]
target = "c"
```

```c
// src/counter.c
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

#include "emela.h"

typedef struct { int32_t value; } counter;

void *counter_open(int32_t start) {
  counter *c = malloc(sizeof(counter));
  c->value = start;
  return c;
}

int32_t counter_bump(void *handle) {
  counter *c = handle;
  return ++c->value;
}

// 戻り値の String は malloc で確保して返す。ランタイムが写してから free する
char *counter_label(void *handle, const char *prefix) {
  counter *c = handle;
  char *out = malloc(64);
  snprintf(out, 64, "%s%d", prefix, (int)c->value);
  return out;
}

void counter_close(void *handle) { free(handle); }

static void on_timer(em_task *task, void *ctx) {
  (void)ctx;
  em_complete_unit(task);
}

// suspend fn の外部関数。引数の後ろに em_task * を受け取り、void を返す
void counter_pause(int32_t ms, em_task *task) {
  em_after(ms, task, on_timer, NULL);
  em_on_cancel(task, on_timer, NULL);
}
```

```emela
# src/main.emel
import Std.Console.{Console, SystemConsole}

effect Counter {
  fn bump() -> Int
  fn label(prefix: String) -> String
  suspend fn pause(ms: Int) -> ()
}

@external
type Handle

@external(c, "./counter.c", "counter_open")
fn counter_open(start: Int) -> Handle

@external(c, "./counter.c", "counter_bump")
fn counter_bump(h: Handle) -> Int

@external(c, "./counter.c", "counter_label")
fn counter_label(h: Handle, prefix: String) -> String

@external(c, "./counter.c", "counter_close")
fn counter_close(h: Handle) -> ()

@external(c, "./counter.c", "counter_pause")
suspend fn counter_pause(ms: Int) -> ()

handler NativeCounter(handle: Handle) implements Counter {
  init { NativeCounter(handle: counter_open(10)) }
  release { counter_close(self.handle) }

  fn bump() { counter_bump(self.handle) }
  fn label(prefix) { counter_label(self.handle, prefix) }
  suspend fn pause(ms, resume) {
    counter_pause(ms)
    resume(())
  }
}

fn main() {
  with SystemConsole, NativeCounter {
    counter = use Counter
    counter.bump()
    counter.pause(20)
    counter.bump()
    (use Console).print_line(counter.label("count = "))
  }
}
```

```console
$ emela run .
count = 12
```

`[build] target = "c"` を書いたので、`emela run .` は C に出力して `cc` でビルドし、実行します。`emela.h` はランタイムが出力先に書き出すヘッダで、`.c` からはそのまま include できます。

### C の非同期のホスト関数

C には Promise にあたるものがないので、`c` のターゲットの suspend fn の外部関数は、完了を後からランタイムに知らせる形で書きます。上の `counter_pause` がこの形です。

C の関数は型の表の引数の後ろに完了を待っている fiber を表す `em_task *task` を受け取り、`void` を返します。完了は戻り値の型に応じた `em_complete_int`、`em_complete_string`、`em_complete_unit` などの関数で、1つの `task` についてちょうど1回知らせます（2回目は defect です）。C の関数の中ですぐに呼んでも、後から呼んでもかまいません。

待ちの登録には `em_after(ms, task, callback, ctx)`（ミリ秒の後）、`em_on_readable` と `em_on_writable`（ファイル記述子の準備ができたら）を使います。待っている fiber が中断されると、`em_on_cancel` で登録したコールバックが呼ばれます（JS の `AbortSignal` にあたります）。

## 例外と失敗

外部関数が投げた例外は defect になります。Promise の拒否も同じです。

```emela check
@external(js, "JSON.parse")
fn parse_int(text: String) -> Int use {}

fn main() {
  dbg(parse_int("42"))    # 42
  dbg(parse_int("{"))     # defect
}
```

```console
$ emela run main.emel
42
defect: SyntaxError: Expected property name or '}' in JSON at position 1 (line 1 column 2)
```

C には例外がありません。C の関数が `abort` したりシグナルで止まったりしたときは、defect でなくプロセスが終わります。

外部関数の宣言には `fails` を書けません。失敗として扱いたい結果はホスト側で値にして返し、ハンドラの中で `fail` に変えます。上の `parsePort` が -1 を返したのもこのためです。

```emela check
import Std.Console.{Console, SystemConsole}

error BadNumber(text: String)

effect Numbers {
  fn parse(text: String) -> Float fails BadNumber
}

@external(js, "Number")
fn js_number(text: String) -> Float use {}

handler JsNumbers implements Numbers {
  fn parse(text) {
    x = js_number(text)
    if x != x { fail BadNumber(text:) } else { x }    # NaN は自分自身と等しくない
  }
}

fn main() {
  with SystemConsole, JsNumbers {
    numbers = use Numbers
    console = use Console
    console.print_line("#{numbers.parse("2.5")}")
    n = numbers.parse("abc") escape { BadNumber(text:) -> 0.0 }
    console.print_line("#{n}")
  }
}
```

```console
$ emela run main.emel
2.5
0.0
```

エラーの名前はエフェクトの操作の `fails` に出るので、呼ぶ側はホストの事情を知らずに `escape` できます。C でも同じで、`errno` を自動で失敗に写すことはしません。同梱の FileSystem はホストから「エラーの名前」を String で受け取り、ハンドラの中で FileNotFound などに変えています。

:::caution[実装との違い]
今のコンパイラ（0.20.1）は、外部関数の宣言に書いた `fails` を拒みません。書いても、ホストの関数が失敗を返す手段はないので、書かないでください。
:::

## ターゲットの注釈がないとき

ビルドするターゲットの注釈がない外部関数は、エントリからたどれるときだけエラーになります。エントリは、`emela build` と `emela run` では `main`、`emela test` ではテスト関数です。

```emela check
@external(js, "Math.cbrt")
fn cbrt(x: Float) -> Float use {}

@external(js, "Math.log2")
@external(c, "log2")
fn log2(x: Float) -> Float use {}

fn main() {
  dbg(log2(8.0))
  dbg(cbrt(27.0))
}
```

これを `emela run --target c main.emel` で実行すると、次のエラーになります。

```text
error: external function `cbrt` has no `@external` for target `c`
  = help: add `@external(c, ...)`, or avoid calling it from the entry
```

`dbg(cbrt(27.0))` の行を消せば、`cbrt` はたどれなくなり、C でもビルドできます。だから `with Platform` と書いても、Http を使わなければ、Http の注釈のないターゲットでビルドできます。この検査は build、run、test でします。`emela check` と LSP はターゲットを決めないので、しません。

## 依存の Pome

`@external` を書けるのは、ビルドしているプロジェクトと、同梱の core と std だけです。依存として使う Pome は `@external` を持てません。ライブラリは純粋な Emela と std のエフェクトの上に書き、どのターゲットでも同じ意味で動くようにします。足りないホストの機能は利用者にハンドラを書かせるのでなく、std に platform のエフェクトか値の型として足します（[Pome](/tools/pome/)）。

:::caution[まだ動かないもの]
Pome の依存（`[dependencies]`）は、今の CLI ではまだ読みません（入る版は未定）。この規則の検査も、依存と一緒に入ります。
:::
