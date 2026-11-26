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
  console <- Console
  clock <- Clock
  List.each(List.range(0, n), |i| {
    clock.sleep(100)
    console.print_line("#{n - i}")
  })
  console.print_line("liftoff")
}

fn main() {
  with SystemConsole, SystemClock {
    countdown(3) # 100 ミリ秒ごとに 3, 2, 1, liftoff
  }
}

# その場で再開するので、テストは待たない
handler InstantClock: Clock {
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

同じ `countdown` が `main` では本当に待ち、テストではすぐ終わります。違うのは with に書いたハンドラだけです。

## suspend fn の操作

```emela
pub effect Clock {
  suspend fn sleep(ms: Int) -> ()
  fn now() -> Instant
}
```

ホストのタイマーや通信を待つ操作、ほかの suspend な操作を呼ぶ操作は、エフェクトの側で `suspend fn` と宣言します。中断しうることを示す印はここにだけ付き、関数のシグネチャ（`uses { Clock }`）にも呼び出し（`clock.sleep(100)`）にも付きません。呼ぶ側はエフェクトの宣言を見て、中断しうるかを知ります。ハンドラの側でも、宣言と同じく `suspend fn` と書きます。

## resume

suspend fn の実装は最後の引数として `resume` を受け取ります。`resume(v)` を呼ぶと、中断していた呼び出し元が再開し、操作の戻り値が `v` になります。

```emela check
import Std.Console.{Console, SystemConsole}

effect Ask {
  suspend fn ask(question: String) -> Int
}

handler LengthAnswer: Ask {
  suspend fn ask(question, resume) {
    console <- Console
    console.print_line("before resume")
    resume(String.length(question))
    console.print_line("after resume")
  }
}

fn main() {
  console <- Console
  ask <- Ask
  with SystemConsole, LengthAnswer {
    n = ask.ask("hello")
    console.print_line("got #{n}")
  }
}
```

```console
$ emela run main.emel
before resume
after resume
got 5
```

- 実装の引数は操作の引数の後ろに resume を1つ足したものです。名前は `resume` でなくてもかまいません。
- その場で resume したときは、resume の後の本体の残りを実行し終えてから呼び出し元が続きます。上の出力で `after resume` が `got 5` より先に出るのはそのためです。
- 本体が resume せずに失敗したときは、そのエラーが操作の呼び出しの結果になります。

### resume の後に中断しない

suspend fn の実装では、resume を呼んだ後（または resume を変数に入れる、クロージャで捕まえる、引数に渡すといった使い方の後）に、中断しうる呼び出しを書けません（E4305）。呼び出し元はもう再開しているので、そこで待つ仕事は誰にも待たれないからです。

```emela check=error
import Std.Clock.{Clock}

effect Ask {
  suspend fn ask(question: String) -> Int
}

handler Lazy: Ask {
  suspend fn ask(question, resume) {
    clock <- Clock
    resume(String.length(question))
    clock.sleep(100) # resume の後に中断しうる
  }
}
```

```text
error[E4305]: call to `sleep` may suspend after `resume` has been called
  = help: start the rest with `Spawn` before calling `resume`
```

if や match の片方の枝だけで resume する場合も含め、resume の後に届きうる呼び出しはすべて検査します。呼び出し元が再開した後も続ける仕事は、resume の前に `Spawn`（[Task.Background](/guide/concurrency/#taskbackground)）で始めます。

### resume は高々1回

`resume` を呼べるのは高々1回です。2回目は defect になります。

```emela check
effect Ask {
  suspend fn ask(question: String) -> Int
}

handler Twice: Ask {
  suspend fn ask(question, resume) {
    resume(1)
    resume(2)
  }
}

fn main() {
  ask <- Ask
  with Twice {
    _ = dbg(ask.ask("x"))
  }
}
```

```console
$ emela run main.emel
defect: resume called twice in operation `ask` of handler `Twice`
```

型で1回を保証する仕組みはありません。

### その場で、または後から

resume はその場で呼んでも、コールバックの中で後から呼んでもかまいません。

```emela check
import Std.Console.{Console, SystemConsole}

effect Timer {
  suspend fn wait(ms: Int) -> ()
}

@external(js, "setTimeout")
fn set_timeout(f: fn() -> (), ms: Int) -> ()

handler JsTimer: Timer {
  suspend fn wait(ms, resume) {
    set_timeout(|| resume(()), ms) # 後から resume する
  }
}

fn main() {
  console <- Console
  timer <- Timer
  with SystemConsole, JsTimer {
    console.print_line("waiting")
    timer.wait(200)
    console.print_line("done")
  }
}
```

後から resume したときは、`resume` の呼び出しの中で呼び出し元が再開し、呼び出し元が次に中断するか終わったところで resume が戻ります。

## Async

Async は「後から再開される」ことを表すホストのエフェクトです。供給できるのはホストだけで、ハンドラも `x <- Async` も書けません。

resume を後から呼ぶ手段（外部関数のコールバック、`@external suspend fn`、別のタスク）は Async を要求します。コンパイラは、suspend fn の実装で `resume` を `resume(v)` と直接呼ぶ以外の使い方（変数に入れる、クロージャで捕まえる、引数に渡す）を見ると、後から呼びうるとみなしてハンドラの依存に Async を足します。上の JsTimer も同梱の SystemClock も Async に依存するので、`with JsTimer { ... }` の R には Async が残ります。

`main` とテスト関数の R はホストのエフェクト（Async と ProcessHost）を除いて空であればよいので、Async が残っても動きます。uses 節で効果がないと宣言した関数の中では、エラーになります。

```emela check=error
effect Timer {
  suspend fn wait(ms: Int) -> ()
}

@external(js, "setTimeout")
fn set_timeout(f: fn() -> (), ms: Int) -> ()

handler JsTimer: Timer {
  suspend fn wait(ms, resume) {
    set_timeout(|| resume(()), ms)
  }
}

fn pause() -> () uses {} {
  timer <- Timer
  with JsTimer { timer.wait(10) }
}
```

```text
effect `Async` is not declared in `uses`
```

### その場で resume するハンドラ

テスト用の InstantClock のようにその場で resume するハンドラは、Async を要求しません。`with InstantClock { ... }` は実際に中断せず、型の上でも Async が現れません。

```emela check
import Std.Console.{Console, SystemConsole}
import Std.Clock.{Clock}
import Std.Instant.{Instant}

handler InstantClock: Clock {
  suspend fn sleep(ms, resume) { resume(()) }
  fn now() { Instant.from_unix_milliseconds(0) }
}

# uses {} と書いても通る
fn nap() -> () uses {} {
  clock <- Clock
  with InstantClock {
    clock.sleep(1000)
  }
}

fn main() {
  console <- Console
  with SystemConsole {
    nap()
    console.print_line("woke")
  }
}
```

## Immediate

Immediate は「中断せず、呼んだその場で完了する」ことを表す組み込みの制約です。コンパイラが宣言から判定するので、実装を書くことはありません。suspend fn も `suspend handler` のメンバー（[状態と資源](/guide/resources/#ハンドラのメンバー)）も持たないエフェクトは、Async を除いて Immediate で、Console は Immediate、Clock は Immediate ではありません。どのハンドラを使うかには左右されません。

中断されると困る場所だけが、効果の型引数に `R: Immediate` と書いてこの制約を求めます。呼び出し側に印を付ける代わりに、型検査で止めます。

```emela check=error
import Std.Clock.{Clock, SystemClock}
import Std.Console.{Console, SystemConsole}

fn run_now[R: Immediate](f: fn() -> () uses { R }) -> () uses { R } { f() }

fn main() {
  console <- Console
  clock <- Clock
  with SystemConsole, SystemClock {
    run_now(|| console.print_line("ok")) # 通る
    run_now(|| clock.sleep(10)) # Clock は中断しうる
  }
}
```

```text
effect `Clock` may suspend, but `R` of `run_now` must be `Immediate`
```

[外部関数](/guide/external/)に渡すコールバックも Immediate でなければなりません。ホストのコールバックの中では待てないためです。コールバックからファイルや通信を扱いたいときは、[Deferred](/guide/concurrency/#deferred) でタスクに合図を送り、タスクの側で扱います。

制約の細かい規則は[型と効果の体系](/reference/type-system/)にあります。

## fn の操作は中断できない

`fn` の操作（suspend fn でないもの）の実装が中断しないことは、コンパイル時に確かめられます。中断しうる呼び出しを含めたいなら、エフェクトの宣言で `suspend fn` にします。

```emela check=error
import Std.Clock.{Clock}
import Std.Instant.{Instant}

effect Stamp {
  fn stamp() -> Instant
}

handler Slow: Stamp {
  fn stamp() {
    clock <- Clock
    clock.sleep(10)
    clock.now()
  }
}
```

```text
operation `sleep` of `Clock` is a `suspend fn` and may suspend, but operation `stamp` is not a `suspend fn`
  = help: declare `stamp` as a `suspend fn` in the effect
```

その場で resume するハンドラの with の中なら、本体の R が Immediate になるので suspend fn の操作も呼べます。

```emela check
import Std.Clock.{Clock}
import Std.Instant.{Instant}

handler InstantClock: Clock {
  suspend fn sleep(ms, resume) { resume(()) }
  fn now() { Instant.from_unix_milliseconds(0) }
}

effect Stamp {
  fn stamp() -> Instant
}

# 本体の R が Immediate なので通る
handler Settled: Stamp {
  fn stamp() {
    clock <- Clock
    with InstantClock {
      clock.sleep(10)
      clock.now()
    }
  }
}

fn main() {
  stamp <- Stamp
  with Settled { _ = dbg(stamp.stamp()) }
}
```

`clock <- Clock` を書いて `clock.now()` のように fn の操作だけを呼ぶ本体も通り、Clock はハンドラの依存になります。

ハンドラのメンバーも同じです。`suspend` を付けずに宣言したメンバー（`handler Open(path: String): ReadFile`）を実装する内側のハンドラの init と release は、fn の操作の本体と同じ規則で検査します。開くときや閉じるときに待つなら、エフェクトの宣言で `suspend handler Open(...)` にします。

## resume されない継続

resume が一度も呼ばれないまま捨てられた継続は、中断されたものとして巻き戻ります。途中の with の release は内側から実行されます。

```emela check
effect Ask {
  suspend fn ask(question: String) -> Int
}

handler Silent: Ask {
  suspend fn ask(question, resume) { () }
}

fn main() {
  ask <- Ask
  with Silent {
    _ = dbg(ask.ask("x"))
  }
}
```

```console
$ emela run main.emel
interrupted
$ echo $?
130
```

上の Silent は Async に依存しないので、後から resume されることはありません。そのため継続はその場で巻き戻ります。後から resume しうるときは、そのタスクを待っている with（`Task.Group` か `Task.Background`）かプログラムの最上位が終わるときに巻き戻ります。

`main` の継続が巻き戻ると、標準エラーに `interrupted` を1行出し、終了コード 130 で終わります。エラー（1）とも defect（101）とも終了コードで見分けられます。巻き戻りの細かい規則は[実行時の意味](/reference/semantics/)にあります。

複数の処理を中断点で切り替えながら進めるのがタスクです（[並行処理](/guide/concurrency/)）。
