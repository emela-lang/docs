---
title: 中断する操作
description: suspend fn の操作、resume、Async と Immediate
---

`suspend fn` で宣言した操作は、呼び出し元を中断させることがあります。続きをいつ実行するか（再開するか）は、ハンドラが `resume` で決めます。呼ぶ側の書き方は普通の呼び出しと同じで、`await` のような印は付きません。

```emela check
import Std.Console.{Console, SystemConsole}
import Std.Clock.{Clock, SystemClock}
import Std.Instant.{Instant}

fn countdown(n: Int) {
  console = use Console
  clock = use Clock
  List.map(List.range(0, n), fn(i) {
    clock.sleep(100)
    console.print_line("#{n - i}")
  })
  console.print_line("liftoff")
}

fn main() {
  with SystemConsole, SystemClock {
    countdown(3)    # 100 ミリ秒ごとに 3, 2, 1, liftoff
  }
}

# その場で再開するので、テストは待たない
handler InstantClock implements Clock {
  suspend fn sleep(ms, resume) { resume(()) }
  fn now() { Instant.from_unix_milliseconds(0) }
}

@test
fn countdown_does_not_wait() {
  with SystemConsole, InstantClock {
    countdown(3)
  }
}
```

```console
$ emela run main.emel
3
2
1
liftoff
```

同じ `countdown` が、`main` では本当に待ち、テストではすぐ終わります。違うのは with に書いたハンドラだけです。

## suspend fn の操作

```emela
pub effect Clock {
  suspend fn sleep(ms: Int) -> ()
  fn now() -> Instant
}
```

- 待つ処理（ホストのタイマーや通信を待つ、ほかの suspend な操作を呼ぶ）を含む操作は、エフェクトの側で `suspend fn` と宣言します。
- 中断するかどうかの印が付くのは、エフェクトの操作の宣言だけです。関数のシグネチャ（`use Clock`）にも呼び出し（`clock.sleep(100)`）にも付きません。呼ぶ側はエフェクトの宣言から、中断しうるかを知ります。
- ハンドラの操作の `suspend` の有無は、宣言と同じでなければなりません（E0415）。

## resume

suspend fn の実装は、最後の引数として `resume` を受け取ります。`resume(v)` を呼ぶと、中断していた呼び出し元が再開し、操作の戻り値が `v` になります。

```emela check
import Std.Console.{Console, SystemConsole}

effect Ask {
  suspend fn ask(question: String) -> Int
}

handler LengthAnswer implements Ask {
  suspend fn ask(question, resume) {
    (use Console).print_line("before resume")
    resume(String.length(question))
    (use Console).print_line("after resume")
  }
}

fn main() {
  with SystemConsole, LengthAnswer {
    n = (use Ask).ask("hello")
    (use Console).print_line("got #{n}")
  }
}
```

```console
$ emela run main.emel
before resume
after resume
got 5
```

- 実装の引数は、操作の引数に resume を1つ足した数です。最後の引数が resume で、名前は問いません。
- resume の型は `fn(T) -> () fails {} use {}` です（T は操作の戻り値の型）。
- 実装の本体の値は捨てるので、本体の型は `()` でなければなりません。
- その場で resume したとき、resume の後に本体の残りがあれば、それを先に実行し終えてから呼び出し元が続きます（上の出力の順）。
- 操作の本体が resume せずに失敗したときは、そのエラーが操作の呼び出しの結果になります（操作の `fails` に載っているエラー）。

### resume は高々1回

`resume` を呼べるのは高々1回です。2回目は defect になります。

```emela check
effect Ask {
  suspend fn ask(question: String) -> Int
}

handler Twice implements Ask {
  suspend fn ask(question, resume) {
    resume(1)
    resume(2)
  }
}

fn main() {
  with Twice {
    dbg((use Ask).ask("x"))
  }
}
```

```console
$ emela run main.emel
defect: resume called twice in operation `ask` of handler `Twice`
```

型で1回を保証する仕組みはありません。同じ経路で2回呼ぶような目で見て分かる誤りは、linter が警告する予定です。

### その場で、または後から

resume は、その場で呼んでも、コールバックの中で後から呼んでもかまいません。

```emela check
import Std.Console.{Console, SystemConsole}

effect Timer {
  suspend fn wait(ms: Int) -> ()
}

@external(js, "setTimeout")
fn set_timeout(f: fn() -> (), ms: Int) -> ()

handler JsTimer implements Timer {
  suspend fn wait(ms, resume) {
    set_timeout(fn() { resume(()) }, ms)    # 後から resume する
  }
}

fn main() {
  with SystemConsole, JsTimer {
    (use Console).print_line("waiting")
    (use Timer).wait(200)
    (use Console).print_line("done")
  }
}
```

後から resume したときは、`resume` の呼び出しの中で呼び出し元が再開し、呼び出し元が次に中断するか終わったところで resume が戻ります。

## Async

Async は組み込みのエフェクトで、「後から再開される」ことを表します。供給できるのはランタイムだけで、ハンドラは書けません（E0413）。操作も持たないので `use Async` とも書けません（E0414）。

- `resume` を後から呼ぶ手段（外部関数のコールバック、`@external suspend fn`、fiber の fork）は Async を要求します。
- コンパイラは、suspend fn の実装の本体で `resume` を直接呼ぶ（`resume(v)`）以外の使い方をしたとき、後から呼びうるとみなして、ハンドラの依存に Async を足します。直接呼ぶ以外の使い方とは、変数に入れる、クロージャで捕まえる、引数に渡す、などです。この判定は構文だけで、安全側に倒します。
- したがって上の JsTimer も、同梱の SystemClock も Async に依存し、`with JsTimer { ... }` の R には Async が残ります。
- `main` とテスト関数の R は、Async を除いて空であればよいので、Async が残っても動きます。

```emela check=error
effect Timer {
  suspend fn wait(ms: Int) -> ()
}

@external(js, "setTimeout")
fn set_timeout(f: fn() -> (), ms: Int) -> ()

handler JsTimer implements Timer {
  suspend fn wait(ms, resume) {
    set_timeout(fn() { resume(()) }, ms)
  }
}

fn pause() -> () use {} {
  with JsTimer { (use Timer).wait(10) }
  # error[E0402]: effect `Async` is not declared in `use`
}
```

### その場で resume するハンドラ

その場で resume するハンドラ（テスト用の InstantClock など）は Async を要求しません。`with InstantClock { ... }` は実際に中断せず、型の上でも Async が現れません。

```emela check
import Std.Console.{Console, SystemConsole}
import Std.Clock.{Clock}
import Std.Instant.{Instant}

handler InstantClock implements Clock {
  suspend fn sleep(ms, resume) { resume(()) }
  fn now() { Instant.from_unix_milliseconds(0) }
}

# use {} と書いても通る
fn nap() -> () use {} {
  with InstantClock {
    (use Clock).sleep(1000)
  }
}

fn main() {
  with SystemConsole {
    nap()
    (use Console).print_line("woke")
  }
}
```

## Immediate

Immediate は、「中断せず、呼んだその場で完了する」ことを表す組み込みの制約です。コンパイラが宣言から自動で判定し、利用者が実装を書くことはありません。

- エフェクトが Immediate であるのは、suspend fn を1つも持たず、Async でもないときです。Console は Immediate、Clock は Immediate ではありません。
- 効果の集合が Immediate であるのは、要素がすべて Immediate のときです。空集合は Immediate です。
- エフェクトが Immediate かどうかは宣言だけで決まり、ハンドラには左右されません。

中断されると困る場所だけが、効果の型引数に `R: Immediate` と書いてこの制約を要求します。呼び出し側に印を付ける代わりに、型検査で止めます。

```emela check=error
import Std.Clock.{Clock, SystemClock}
import Std.Console.{Console, SystemConsole}

fn run_now[R: Immediate](f: fn() -> () use R) -> () use R { f() }

fn main() {
  with SystemConsole, SystemClock {
    run_now(fn() { (use Console).print_line("ok") })    # 通る
    run_now(fn() { (use Clock).sleep(10) })
    # error[E0416]: effect `Clock` may suspend, but `R` of `run_now` must be `Immediate`
  }
}
```

- `R: Immediate` の制約は、その定義（fn か構成子）を参照したところで、具体化した集合について確かめます（E0416）。
- 引数の型の中の見えない効果の集合（`f: fn() -> ()`）は Immediate の制約を持たないので、`R: Immediate` の引数には渡せません。制約が要るときは、名前を付けた型引数に `: Immediate` を書きます。
- 型を推論する定義で、Immediate を要求する位置に渡した集合変数を汎化するときは、その型引数に Immediate の制約が付きます。

### 外部関数のコールバック

[外部関数](/guide/external/)の引数の関数型（コールバック）の見えない効果の集合は、Immediate の制約を持ちます。ホストのコールバックの中では待てないためです。

```emela check=error
import Std.Clock.{Clock}
import Std.Console.{Console}

@external(js, "setTimeout")
fn set_timeout(f: fn() -> (), ms: Int) -> ()

handler Bad implements Console {
  fn print_line(text) { set_timeout(fn() { (use Clock).sleep(1) }, 0) }
  fn print_error_line(text) { () }
}
# error[E0416]: effect `Clock` may suspend, but callbacks passed to external function `set_timeout` must be `Immediate`
```

コールバックからファイルや通信を扱いたいときは、[Deferred](/guide/concurrency/) で fiber に合図を送り、fiber の側で扱います。

## fn の操作の実装の制約

`fn` の操作（suspend fn でないもの）の実装の本体は、次のどちらかを満たさなければなりません（E0417）。どちらもそれだけで、本体が中断しないことを保証します。

- 本体の R が Immediate である。その場で resume するハンドラの with の中で suspend fn の操作を呼ぶ本体は、こちらで通ります。
- 本体が中断しうる呼び出しを含まない。

```emela check=error
import Std.Clock.{Clock}
import Std.Instant.{Instant}

effect Stamp {
  fn stamp() -> Instant
}

handler Slow implements Stamp {
  fn stamp() {
    (use Clock).sleep(10)
    (use Clock).now()
  }
}
# error[E0417]: operation `sleep` of `Clock` is a `suspend fn` and may suspend, but operation `stamp` is not a `suspend fn`
#   = help: declare `stamp` as a `suspend fn` in the effect
```

```emela check
import Std.Clock.{Clock}
import Std.Instant.{Instant}

handler InstantClock implements Clock {
  suspend fn sleep(ms, resume) { resume(()) }
  fn now() { Instant.from_unix_milliseconds(0) }
}

effect Stamp {
  fn stamp() -> Instant
}

# 本体の R が Immediate なので通る
handler Settled implements Stamp {
  fn stamp() {
    with InstantClock {
      (use Clock).sleep(10)
      (use Clock).now()
    }
  }
}

fn main() {
  with Settled { dbg((use Stamp).stamp()) }
}
```

呼び出しが中断しうるかは、次で決めます。

- 操作の呼び出し（`clock.now()`、`(use Clock).now()`）は、その操作の宣言で決まります。`suspend fn` なら中断しうる。
- 関数と関数の値の呼び出しは、呼ばれる側の型の R で決まります。R が Immediate でなければ中断しうる。能力を捕まえたクロージャや、値として取り出した操作（`g = clock.now`）を呼ぶのも、関数の値の呼び出しです。
- `@external suspend fn` の呼び出しは中断しうる。

中断しうる呼び出しを含まなければ、本体の R は制限しません。`fn now() { (use Clock).now() }` は通り、Clock がハンドラの依存になります。ただし関数を挟むと、その関数が fn の操作しか呼ばなくても中断しうるとみなします（`fn stamp() -> Instant use { Clock }` を呼ぶ本体は E0417）。外側の Clock の `now` と、内側の `with InstantClock` の中の `sleep` を同じ本体に混ぜた場合も、どちらの条件も満たさず E0417 です。

## resume されない継続

resume が一度も呼ばれないまま捨てられた継続は、中断されたものとして巻き戻ります。途中の with の release は内側から実行されます。

```emela check
effect Ask {
  suspend fn ask(question: String) -> Int
}

handler Silent implements Ask {
  suspend fn ask(question, resume) { () }
}

fn main() {
  with Silent {
    dbg((use Ask).ask("x"))
  }
}
```

```console
$ emela run main.emel
interrupted
$ echo $?
130
```

- 中断しない文脈（R が Immediate。その場で resume するハンドラの with の中）で、suspend な操作がその場で resume されなかったときは、その継続はもう resume されません。その時点で中断されたまま巻き戻ります。上の Silent はこの形です。
- 後から resume しうる場合は、その fiber を待っているスコープ（`Fiber.scope` かプログラムの最上位）が終わるときに巻き戻ります。イベントループが空になったときは、待っている継続をすべて巻き戻します。
- `main` の継続が中断されたまま巻き戻ると、標準エラーに `interrupted` を1行出し、終了コード 130 で終わります。エラー（1）とも defect（101）とも終了コードで見分けられます。テスト関数のときは、そのテストの `interrupted` の失敗として報告します。
- resume した後で操作の本体が失敗したり defect になったりしたときは、呼び出し元はもう進んでいるので、プログラムの最上位（またはテスト）の defect になります（`... failed after resume: <エラー>`）。

複数の処理を中断点で切り替えながら進めるのが fiber です。[並行処理](/guide/concurrency/)に続きます。
