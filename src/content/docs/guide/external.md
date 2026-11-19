---
title: 外部関数
description: "@external による JS と C の関数の宣言、呼べる場所、ホストの型、境界を越えられる型、例外と失敗、非同期のホスト関数"
---

`@external` は、ホスト（JS や C）の関数を Emela から呼ぶための逃げ道です。本体のない `fn` に付けて宣言し、副作用のあるものはハンドラの中でしか呼べません。そのため、外部関数を使っても、すべての副作用は名前の付いたエフェクトを通ります。

```emela check
import Std.Console.{Console}

@external(js, "Math.hypot")
@external(c, "hypot")
fn hypot(x: Float, y: Float) -> Float uses {}

@external(js, "console.log")
@external(c, "puts")
fn host_print(text: String) -> ()

handler HostConsole: Console {
  fn print_line(text) { host_print(text) }
  fn print_error_line(text) { host_print(text) }
}

fn main() {
  d = hypot(3.0, 4.0) # uses {} なので、どこからでも呼べる
  with HostConsole {
    (use Console).print_line("distance: #{d}")
  }
}
```

```console
$ emela run main.emel
distance: 5.0
$ emela run --target native main.emel
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
fn sin(x: Float) -> Float uses {}

@external(js, "./http_ffi.mjs", "fetchText")
@external(wasm, "wasi:http/client", "fetch")
suspend fn fetch_text(url: String) -> String
```

コンパイラはホストの関数の中身を見られないので、引数と戻り値の型は必ず書きます。注釈はリンクする相手の言語（`js`、`wasm`、`c`）ごとに1つ書き、1つの fn に並べられます。ビルドのターゲット `native` は `c` の注釈を使います。

`(js, "名前")` はグローバルから辿れる JS の関数（`console.log`、`Math.sin`）を指し、`(c, "名前")` はリンクのときに解決する C の関数（libc や OS のライブラリのもの）を指します。

`(ターゲット, "ファイル", "名前")` の形は自分で書いたホスト側のファイルを指します。ファイルは宣言を含むソースのディレクトリからの相対パスで、`./` か `../` で始めます。JS では `.mjs` のファイルから export した関数を指します。出力は、そのファイルを含む Pome のソースのルートの下にある `.emel` 以外のファイルを出力先へ写し、相対パスで読むので、出力のディレクトリごと別の場所へ移しても動きます。`.mjs` から同じ Pome のほかのファイルを相対パスで読んでもかまいません。C では `.c` のファイルの関数を指し、コンパイラはそのファイルを出力と一緒に `cc` でコンパイルしてリンクします。

同梱の std も同じ形で書かれています。`Std.Clock` のソース（`clock.emel`）は隣の `clock.mjs` と `clock.c` を指しています。

```emela
@external(js, "./clock.mjs", "sleep")
@external(c, "./clock.c", "emela_clock_sleep")
suspend fn sleep_milliseconds(ms: Int) -> ()
```

:::note
ビルドのターゲットは `js`、`native`、`wasm` で、使う注釈はそれぞれ `js`、`c`、`wasm` です。ターゲット名の `c` は `native` の古い名前で、使うと警告（W0903）が出ます（[ターゲット](/reference/targets/)）。
:::

## 呼べる場所

| 宣言 | 意味 | 呼べる場所 |
|---|---|---|
| `uses {}` を明記 | 純粋だと宣言する | どこからでも |
| `uses` を省略 | ホストの副作用を持つ | ハンドラの init、release、操作の本体の中だけ |
| `uses { ProcessHost }` か `uses { PageHost }` | ホストの副作用を持ち、そのホストでだけ動く | ハンドラの init、release、操作の本体の中だけ |
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

`uses {}` の宣言が正しいかどうかを、コンパイラは検証できません。宣言した人が責任を持ちます。

uses 節に書けるのはホストのエフェクト ProcessHost と PageHost だけです（ほかは E0445）。`uses { ProcessHost }` は、ホストが OS のプロセスでなければ動かないことを表します。この外部関数を呼ぶハンドラは ProcessHost を要求します。ProcessHost は with で消えずに R に残るので、そのハンドラを使う関数は ProcessHost が与えられる `main` やテスト関数から呼ぶことになります。同梱の SystemArgs や SystemFileSystem がこの形です。

制限は呼び出しだけでなく参照にも掛かります。uses を省略した外部関数を関数の値としてハンドラの外へ持ち出すこともできません。外部関数のホストの副作用は R に載らず、外から見えるのはそれを包んだハンドラのエフェクトです。

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
emela = "0.28.0"
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
fn parse_port(text: String) -> Int uses {}

@external(js, "./host.mjs", "wait")
suspend fn wait(ms: Int) -> ()

handler NodeHost: Host {
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
r = Fiber.timeout(50, || (use Host).pause(10000))
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
fn parse(text: String) -> JsValue uses {}

@external(js, "JSON.stringify")
fn stringify(value: JsValue) -> String uses {}

fn main() {
  v = parse("{ \"name\": \"alice\",  \"tags\": [1, 2] }")
  _ = dbg(stringify(v)) # "{\"name\":\"alice\",\"tags\":[1,2]}"
}
```

Emela からは持ち回ることしかできず、中身を見るにはそれを受け取る外部関数を書きます。C では `@external type` の値はホストのポインタ（`void *`）で、Emela は解放も検査もしません。解放はハンドラの release から、解放する外部関数を呼んでします（下の C の例）。

## 境界を越えられる型

外部関数の引数と戻り値に使えるのは、次の型だけです。

- Int、Int64、Float、Bool、String、Bytes（`Std.Bytes`）、`()`
- `Array[A]`（`Std.Array`）。A は関数型以外の上の型（`Array[Array[Int]]` や `Array[Bytes]` も渡せます）
- `@external type` で宣言した型
- 上の型だけからなる関数型（コールバック）

List や Option、自分で定義した型は直接は渡せません。ハンドラの中で変換します。並びを渡したいときは Array に変えて渡します。Bytes と Array は境界を越えるときに写されるので、ホスト側で後から書き換えても Emela の値は変わりません。同梱の SystemEnv は `Option[String]` を返したいので、ホストからは「あるか」（Bool）と「値」（String）を別々の外部関数で受け取り、ハンドラの中で `Some` / `None` に組み立てています。

`()` を返す外部関数は、ホストの戻り値を捨てて `()` を返します。上の `host_print` を `console.log` や `puts` に向けられるのはこのためです。

:::caution[検査の抜け]
JS のターゲットでは、コンパイラは List や利用者の型の引数を拒まず、内部の表現のまま渡してしまいます（[emela#263](https://github.com/emela-lang/emela/issues/263)）。native のターゲットでは「cannot cross to C」のエラーになります。どちらのターゲットでも、上の型だけを使ってください。
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

handler JsTimer: Timer {
  fn later(ms, f) { set_timeout(f, ms) }
}

fn main() {
  with SystemConsole, JsTimer {
    (use Timer).later(10, || dbg("fired"))
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

handler JsTimer: Timer {
  suspend fn later(ms, resume) {
    set_timeout(|| (use Clock).sleep(1), ms)
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

コールバックからファイルや通信を扱いたいときは、Deferred で fiber に合図を送ります（[並行処理](/guide/concurrency/)）。

native のターゲットは、関数型（コールバック）と Bytes、Array を境界で受け渡せません。エントリからたどれる外部関数がこれらを受け取るか返すと、コンパイルエラー（E0427、E0443）です。

### C の型

`native` のターゲットでは、Emela の型を次の C の型に写します。C の関数のプロトタイプはこの表で決まり、コンパイラは C のヘッダを読みません。宣言とホストの関数の型が合わないときの振る舞いは決めていません。

| Emela の型 | C の引数 | C の戻り値 |
|---|---|---|
| Int | `int32_t` | `int32_t` |
| Int64 | `int64_t` | `int64_t` |
| Float | `double` | `double` |
| Bool | `bool`（C99 の `_Bool`） | `bool` |
| String | `const char *`（NUL 終端の UTF-8） | `char *`（NUL 終端。`malloc` で確保したもの） |
| `()` | 引数にしない | `void` |
| `@external type` | `void *` | `void *` |
| 関数型 | なし（E0427） | なし（E0427） |

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
emela = "0.28.0"

[build]
target = "native"
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

handler NativeCounter(handle: Handle): Counter {
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

`[build] target = "native"` を書いたので、`emela run .` は C に出力して `cc` でビルドし、実行します。`emela.h` はランタイムが出力先に書き出すヘッダで、`.c` からはそのまま include できます。

### C の非同期のホスト関数

C には Promise にあたるものがないので、`native` のターゲットの suspend fn の外部関数は、完了を後からランタイムに知らせる形で書きます。上の `counter_pause` がこの形です。

C の関数は型の表の引数の後ろに完了を待っている fiber を表す `em_task *task` を受け取り、`void` を返します。完了は戻り値の型に応じた `em_complete_int`、`em_complete_string`、`em_complete_unit` などの関数で、1つの `task` についてちょうど1回知らせます（2回目は defect です）。C の関数の中ですぐに呼んでも、後から呼んでもかまいません。

待ちの登録には `em_after(ms, task, callback, ctx)`（ミリ秒の後）、`em_on_readable` と `em_on_writable`（ファイル記述子の準備ができたら）を使います。待っている fiber が中断されると、`em_on_cancel` で登録したコールバックが呼ばれます（JS の `AbortSignal` にあたります）。

## 例外と失敗

外部関数が投げた例外は defect になります。Promise の拒否も同じです。

```emela check
@external(js, "JSON.parse")
fn parse_int(text: String) -> Int uses {}

fn main() {
  dbg(parse_int("42")) # 42
  _ = dbg(parse_int("{")) # defect
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
fn js_number(text: String) -> Float uses {}

handler JsNumbers: Numbers {
  fn parse(text) {
    x = js_number(text)
    if x != x { fail BadNumber(text:) } else { x } # NaN は自分自身と等しくない
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

:::caution[検査の抜け]
コンパイラは、外部関数の宣言に書いた `fails` を拒みません（[emela#263](https://github.com/emela-lang/emela/issues/263)）。書いても、ホストの関数が失敗を返す手段はないので、書かないでください。
:::

## ターゲットの注釈がないとき

ビルドするターゲットの注釈がない外部関数は、エントリからたどれるときだけエラーになります。エントリは、`emela build` と `emela run` では `main`、`emela test` ではテスト関数です。

```emela check
@external(js, "Math.cbrt")
fn cbrt(x: Float) -> Float uses {}

@external(js, "Math.log2")
@external(c, "log2")
fn log2(x: Float) -> Float uses {}

fn main() {
  dbg(log2(8.0))
  _ = dbg(cbrt(27.0))
}
```

これを `emela run --target native main.emel` で実行すると、次のエラーになります。

```text
error: external function `cbrt` has no `@external(c, ...)` for target `native`
  = help: add `@external(c, ...)`, or avoid calling it from the entry
```

`_ = dbg(cbrt(27.0))` の行を消せば、`cbrt` はたどれなくなり、C でもビルドできます。だから `with Platform` と書いても、Http を使わなければ、Http の注釈のないターゲットでビルドできます。この検査は build、run、test でします。`emela check` と LSP はターゲットを決めないので、しません。

## 依存の Pome

依存として使う Pome の `@external` は、ビルドしている側の `Pome.toml` が `[external]` の `allow` で許したときだけ使えます。

```toml
# アプリの Pome.toml
[dependencies]
"github.com/emela-lang/x/platform-cloudflare" = "v0.1.0"

[external]
allow = ["github.com/emela-lang/x/platform-cloudflare"]
```

- `allow` には Pome のソースパスを並べ、版は書きません。依存の依存も、ここに書かなければ `@external` を使えません。
- 許していない依存の `@external` はコンパイルエラー（E0233）です。`@export` も `@external` と同じに数えます。`emela pome add --allow-external <ソースパス>` は、依存を足すときに `allow` にも書き足します。
- 依存の中の `@external` の関数は `pub` にできません（E0237）。ホストに触れる Pome は、外へはエフェクトか、外部関数を呼ぶ普通の関数として見せます。

ライブラリはふつう純粋な Emela と std のエフェクトの上に書き、どのターゲットでも同じ意味で動くようにします。多くのプログラムが使うホストの機能は、std に platform のエフェクトか値の型として足します。特定のホストにしかない機能は、ターゲット専用の Pome に置きます（[Pome](/tools/pome/)）。
