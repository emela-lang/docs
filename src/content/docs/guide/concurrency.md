---
title: 並行処理
description: fiber、組み合わせ関数、Fiber.scope と fork、中断、Exit と Cause、Deferred、持ち出しの禁止
---

複数の待ちを重ねるには fiber を使います。fiber は1つのスレッドの上で協調的に切り替わる軽量な実行単位で、必ずスコープの中で起動し、スコープを抜けるまでに終わります。`async` や `await` のような専用の構文はなく、すべて `Std.Fiber` の関数で書きます。

```emela check
import Std.Console.{Console, SystemConsole}
import Std.Clock.{Clock, SystemClock}
import Std.Fiber.{Fiber}

fn tick(name: String, n: Int, ms: Int) -> Int use { Clock, Console } {
  List.map(List.range(0, n), fn(i) {
    (use Clock).sleep(ms)
    (use Console).print_line("#{name} #{i}")
  })
  n
}

fn main() {
  with SystemConsole, SystemClock {
    (a, b) = Fiber.both(fn() { tick("a", 3, 100) }, fn() { tick("b", 2, 150) })
    (use Console).print_line("done #{a + b}")
  }
}
```

```console
$ emela run main.emel
a 0
b 0
a 1
b 1
a 2
done 5
```

2つの `tick` が交互に進み、全体は約300ミリ秒で終わります。`tick` 自身は fiber のことを知りません。

## 切り替わる場所

fiber は並列には動かないので、速くなるのは待ちを重ねられるときだけです。待たない計算を fiber に分けても、合計の時間は変わりません。

切り替えが起きるのは中断点だけです。`sleep` やファイル、通信のような Async を要求する suspend な操作を呼んだときと、ランタイムが公平性のために挟む譲渡がそれにあたります。中断しうる呼び出しを挟まない区間は一息に実行されるので、中断しうる呼び出しのどこででも他の fiber に切り替わりうるものとして書きます。

```emela check
import Std.Console.{Console, SystemConsole}
import Std.Clock.{Clock, SystemClock}
import Std.Fiber.{Fiber}
import Std.State.{State}

fn pause() -> () use { Clock } { (use Clock).sleep(0) }

# 中断点がないので一息に進む
fn safe() -> () use { State[Int] } {
  st = use State[Int]
  st.set(st.get() + 1)
}

# get と set の間に中断点があるので、他の fiber が割り込む
fn racy() -> () use { State[Int], Clock } {
  st = use State[Int]
  x = st.get()
  pause()
  st.set(x + 1)
}

fn main() {
  with SystemConsole, SystemClock {
    (_, a) = State.run(0, fn() { Fiber.map(List.range(0, 10), fn(i) { safe() }) })
    (_, b) = State.run(0, fn() { Fiber.map(List.range(0, 10), fn(i) { racy() }) })
    (use Console).print_line("safe: #{a}, racy: #{b}")
  }
}
```

```console
$ emela run main.emel
safe: 10, racy: 1
```

`racy` では10個の fiber が全員 0 を読んでから書くので、結果は 1 です。読んで書く処理は `st.update(fn(n) { n + 1 })` にすれば一息になります（`update` の `f` は純粋です）。細かい規則は [意味論](/reference/semantics/) にあります。

## 組み合わせ関数

ふだんの並行処理は次の5つの関数で足ります。

- `Fiber.both(f, g)` は型の違う2つを並行に実行して組で返します。
- `Fiber.map(xs, f)` は各要素に `f` を並行に適用し、元の順で返します。
- `Fiber.all(fs)` は関数のリストを並行に実行し、元の順で返します。
- `Fiber.race(fs)` は最初に終わったものを採り、残りを中断します。最初に終わったものがエラーなら、そのエラーで失敗します。
- `Fiber.timeout(ms, f)` は `f` を `ms` ミリ秒まで待ちます。間に合えば `Some`、間に合わなければ `f` を中断して `None` です。時間は Clock で測ります。

どれも、1つが失敗すれば残りを中断して、そのエラーで失敗します。後で実行するものは `fn() { ... }` で包んで渡します（引数なしの関数の短い書き方はありません）。型は [State・Fiber・Deferred](/std/state-fiber/) にあります。

```emela check
import Std.Console.{Console, SystemConsole}
import Std.Clock.{Clock, SystemClock}
import Std.Fiber.{Fiber}

error NotFound(id: Int)

fn fetch(id: Int, ms: Int) -> String fails NotFound use { Clock, Console } {
  (use Clock).sleep(ms)
  (use Console).print_line("fetched #{id}")
  if id < 0 { fail NotFound(id:) } else { "user #{id}" }
}

fn main() {
  with SystemConsole, SystemClock {
    console = use Console
    (a, b) = Fiber.both(fn() { fetch(1, 200) }, fn() { fetch(2, 100) })
    console.print_line("both: #{a}, #{b}")
    names = Fiber.map([3, 4, 5], fn(id) { fetch(id, 100 * (6 - id)) })
    console.print_line("map: #{names}")
    first = Fiber.race([fn() { fetch(6, 300) }, fn() { fetch(7, 100) }])
    console.print_line("race: #{first}")
    late = Fiber.timeout(100, fn() { fetch(8, 1000) })
    console.print_line("timeout: #{late}")
  }
}
```

```console
$ emela run main.emel
fetched 2
fetched 1
both: user 1, user 2
fetched 5
fetched 4
fetched 3
map: ["user 3", "user 4", "user 5"]
fetched 7
race: user 7
timeout: None
```

時間切れを失敗にしたいときは `Option.or_fail` を挟みます。

```emela check
import Std.Console.{Console, SystemConsole}
import Std.Clock.{Clock, SystemClock}
import Std.Fiber.{Fiber}

error TooSlow(ms: Int)

fn slow() -> Int use { Clock } {
  (use Clock).sleep(500)
  1
}

fn main() {
  with SystemConsole, SystemClock {
    r = Fiber.timeout(100, fn() { slow() }) |> Option.or_fail(TooSlow(ms: 100))
    (use Console).print_line("#{r}")
  }
}
```

```console
$ emela run main.emel
error: TooSlow(ms: 100)
$ echo $?
1
```

:::caution[0.21 で入る予定]
同時に走る数の上限（「1000件を最大10並行で」）は、`Semaphore` と `Queue` と一緒に入ります。
:::

## Fiber.scope と fork

途中で join したい、Deferred を使いたい、のような込み入った形には `Fiber.scope` と `Fiber.fork` を直接使います。5つの組み合わせ関数もこの上に Emela で書かれた普通の関数です。

```emela check
import Std.Console.{Console, SystemConsole}
import Std.Clock.{Clock, SystemClock}
import Std.Fiber.{Fiber}

fn main() {
  with SystemConsole, SystemClock {
    console = use Console
    n = Fiber.scope(fn() {
      Fiber.fork(fn() { console.print_line("child runs") })
      Fiber.fork(fn() {
        (use Clock).sleep(1000)
        console.print_line("never printed")
      })
      console.print_line("parent first")
      (use Clock).sleep(10)
      1
    })
    console.print_line("scope returned #{n}")
  }
}
```

```console
$ emela run main.emel
parent first
child runs
scope returned 1
```

`Fiber.scope(body)` は fiber を起動する能力 `Scope` を供給して `body` を実行し、`Fiber.fork(f)` は `f` を子の fiber として起動してハンドル `Fiber[A]` を返します。fork は中断点ではないので、子は親が次に中断したときに走り始めます。`parent first` が先に出るのはこのためです。

本体が値を返した時点で残っている子は中断され、すべての子の巻き戻りが終わってから scope が値を返します。親より長生きする fiber はないので、常駐する処理は main の直下のスコープで fork します。子の値を待つには `Fiber.join(fiber)` を使います。待つのは join を呼んだ fiber だけで、ほかの fiber はその間も進みます。

fork できるのは scope に渡した関数と、そこから呼ばれた関数の中だけです。補助の関数はスコープを引数で受けず、`use Scope` で受けます。

### 子が失敗したとき

子がエラーか defect で終わると、兄弟の fiber（スコープの本体を含む）は中断され、原因がスコープの外へ伝わります。

```emela check
import Std.Console.{Console, SystemConsole}
import Std.Clock.{Clock, SystemClock}
import Std.Fiber.{Fiber}

effect Job {
  fn name() -> String
}

handler Tracked(name: String) implements Job {
  init {
    (use Console).print_line("start job")
    Tracked(name: "job")
  }
  release {
    (use Console).print_line("release #{self.name}")
  }
  fn name() { self.name }
}

error Boom(id: Int)

fn work(id: Int, ms: Int) -> Int fails Boom use { Clock, Console } {
  with Tracked {
    (use Clock).sleep(ms)
    if id == 2 { fail Boom(id:) }
    (use Console).print_line("work #{id} done")
    id
  }
}

fn main() {
  with SystemConsole, SystemClock {
    r = Fiber.scope(fn() {
      a = Fiber.fork(fn() { work(1, 300) })
      b = Fiber.fork(fn() { work(2, 100) })
      Fiber.join(a) + Fiber.join(b)
    }) escape {
      Boom(id:) -> 0 - id
    }
    (use Console).print_line("result #{r}")
  }
}
```

```console
$ emela run main.emel
start job
start job
release job
release job
result -2
```

子の fails はスコープの fails に合流します。上の `Fiber.scope(...)` の型は `Int fails Boom` で、escape で受けられます。中断された `work(1, 300)` は途中の with の release を実行して巻き戻り、`work 1 done` は出ません。子のエラーをスコープに伝えたくないときは、子の中を `Fiber.attempt` で包みます（[エラーを値にする](#エラーを値にする)）。

### 子が使うハンドラ

子の中で使うハンドラは `Fiber.scope` を呼んだ時点のものです。スコープの本体の中に書いた with は、子には配られません。

```emela check=error
import Std.Clock.{SystemClock}
import Std.Fiber.{Fiber, Scope}

effect Users {
  fn find(id: Int) -> String
}

handler PostgresUsers implements Users {
  fn find(id) { "user #{id}" }
}

fn main() {
  with SystemClock {
    Fiber.scope(fn() {
      s = use Scope
      with PostgresUsers {
        s.fork(fn() { (use Users).find(1) })
      }
      ()
    })
  }
}
```

```text
error: effect `Users` is not provided in `main`
  = note: fibers forked in `Fiber.scope` get their handlers from where `Fiber.scope` is called, so `with` inside it does not reach them
```

直すには、with をスコープの外に出します（`with PostgresUsers { Fiber.scope(fn() { ... }) }`）。子が使うエフェクトは Fiber.scope の外で供給するので、子より先に終わる with のハンドラを子が使うことは、型の上では起きません。

## 中断

`Fiber.interrupt(fiber)` は子を中断し、巻き戻りが終わるまで待ちます。

```emela check
import Std.Console.{Console, SystemConsole}
import Std.Clock.{Clock, SystemClock}
import Std.Fiber.{Fiber, Success, Failure}
import Std.Cause.{Cause}

fn heartbeat() -> () use { Clock, Console } {
  List.map(List.range(0, 100), fn(i) {
    (use Clock).sleep(100)
    (use Console).print_line("beat #{i}")
  })
  ()
}

fn main() {
  with SystemConsole, SystemClock {
    Fiber.scope(fn() {
      beat = Fiber.fork(fn() { heartbeat() })
      (use Clock).sleep(350)
      Fiber.interrupt(beat)
      Fiber.await(beat) match {
        Success(_) -> (use Console).print_line("finished")
        Failure(cause) -> (use Console).print_line("stopped: #{Cause.to_string(cause)}")
      }
    })
  }
}
```

```console
$ emela run main.emel
beat 0
beat 1
beat 2
stopped: interrupted
```

中断は、対象の fiber が次の中断点に達したときに効きます。そこから巻き戻り、途中の with の release が内側から順に実行されます。release の実行中は中断されず、中断は release が終わった後に効きます。

中断された子を `Fiber.join` すると defect（`fiber was interrupted`）になります。中断されうる子の結果を見たいときは、上のように `Fiber.await` を使います。

## エラーを値にする

fiber が正常に終わらなかったときの原因は、`Std.Cause` の `Cause[E]` で表します。原因は fail によるエラー（Fail）、defect（Die）、中断（Interrupt）の3種類で、型の E に現れるのは Fail だけです。`Fiber.attempt(f)` は `f` をその場で実行し、Fail と Die を値（`Exit[A, E]`）に変えます。

```emela check
import Std.Console.{Console, SystemConsole}
import Std.Fiber.{Fiber, Success, Failure}
import Std.Cause.{Cause, Fail, Die, Interrupt}

error NotFound(id: Int)

fn find(id: Int) -> String fails NotFound {
  if id == 0 { fail NotFound(id:) }
  if id < 0 { panic("negative id") }
  "user #{id}"
}

fn describe(id: Int) -> String {
  Fiber.attempt(fn() { find(id) }) match {
    Success(name) -> name
    Failure(cause) -> Cause.kind(cause) match {
      Fail -> "fail: #{Cause.to_string(cause)}"
      Die -> "die: #{Cause.to_string(cause)}"
      Interrupt -> "interrupt"
    }
  }
}

fn main() {
  with SystemConsole {
    console = use Console
    console.print_line(describe(1))
    console.print_line(describe(0))
    console.print_line(describe(-1))
  }
}
```

```console
$ emela run main.emel
user 1
fail: error: NotFound(id: 0)
die: defect: negative id
```

`Exit[A, E]` は `Success(A)` か `Failure(Cause[E])` で、バリアントは `import Std.Fiber.{Success, Failure}` で取り込みます。Cause から中身のエラーは取り出せません。種類を見る（`Cause.kind`）か、文字列にする（`Cause.to_string`）か、`Cause.raise` で起こし直して escape で受けます。attempt の外では、defect は escape を素通りします。

子のエラーでスコープを止めたくないときは、子の中を attempt で包みます。

```emela
s.fork(fn() {
  Fiber.attempt(fn() { handle(conn) }) match {
    Success(_) -> ()
    Failure(cause) -> (use Console).print_error_line(Cause.to_string(cause))
  }
})
```

原因ごとに attempt、await、スコープのどこで受けるかの表は [意味論](/reference/semantics/) にあります。

## Deferred

Deferred は一度だけ値を入れられる入れ物で、fiber の間で値を受け渡します。`Fiber.deferred()` で作り、作ったスコープに属します。

```emela check
import Std.Console.{Console, SystemConsole}
import Std.Clock.{Clock, SystemClock}
import Std.Fiber.{Fiber}
import Std.Deferred.{Deferred}

fn poll_loop(n: Int, stop: Deferred[()]) -> Int use { Clock } {
  Deferred.poll(stop) match {
    Some(_) -> n
    None -> {
      (use Clock).sleep(100)
      poll_loop(n + 1, stop)
    }
  }
}

fn main() {
  with SystemConsole, SystemClock {
    console = use Console
    Fiber.scope(fn() {
      ready = Fiber.deferred()
      stop = Fiber.deferred()
      worker = Fiber.fork(fn() {
        (use Clock).sleep(50)
        Deferred.complete(ready, "port 8080")
        poll_loop(0, stop)
      })
      console.print_line("ready: #{Deferred.await(ready)}")
      (use Clock).sleep(250)
      Deferred.complete(stop, ())
      console.print_line("rounds: #{Fiber.join(worker)}")
    })
  }
}
```

```console
$ emela run main.emel
ready: port 8080
rounds: 3
```

`Deferred.complete(d, v)` は最初の1回だけ値を入れて True を返し、2回目からは何もせず False です。`Deferred.await(d)` は値が入るまで待ち、`Deferred.poll(d)` は待たずに `Some(値)` か `None` を返します。走り続ける子から途中の値を受け取る（上の `ready`）、止める合図を配る（上の `stop`）のに使い、`Fiber.race` もこれで書かれています。外から強制的に止めるのは `Fiber.interrupt` です。

外部関数のコールバックの中では待てないので、コールバックからファイルや通信を扱いたいときは、Deferred で fiber に合図を送り、fiber の側で扱います。

## スコープの外へ持ち出せないもの

Scope の能力、fiber のハンドル（`Fiber[A]`）、Deferred は、スコープの外へ持ち出せません。

```emela check=error
import Std.Clock.{Clock, SystemClock}
import Std.Fiber.{Fiber}

fn main() {
  with SystemClock {
    f = Fiber.scope(fn() {
      Fiber.fork(fn() { (use Clock).sleep(10) })
    })
    ()
  }
}
```

```text
error: a `Fiber` cannot leave the `Fiber.scope` that started it
```

`Option[Fiber[User]]` のように、値の型のどこかに `Fiber` か `Deferred` が含まれていればエラーです。型で止まらない持ち出し（State に入れる、クロージャで捕まえて返す）は実行時に検査します。

```emela check
import Std.Console.{Console, SystemConsole}
import Std.Clock.{SystemClock}
import Std.Fiber.{Fiber}

fn main() {
  with SystemConsole, SystemClock {
    later = Fiber.scope(fn() {
      child = Fiber.fork(fn() { 42 })
      fn() { Fiber.join(child) }
    })
    (use Console).print_line("#{later()}")
  }
}
```

```console
$ emela run main.emel
defect: fiber was joined after its scope ended
```

:::caution[0.22 で静的に止める予定]
0.22 で capture set が入ると、上の実行時の検査はすべて静的なエラーになります。0.20 でエラーになるプログラムは 0.22 でもエラーです。版を上げて通らなくなるのは、0.20 で実行時の defect だったものだけです。
:::

## 並列はない

複数のスレッドでの並列実行はありません。CPU を使う計算を fiber に分けても速くなりません。将来は純粋な関数に限った並列の仕組みと、ヒープを分けたワーカーの間のメッセージを検討しています。スレッドやロックを言語に出すことはしません。

並行するコードは仮の時刻で動く TestClock でテストできます（[テスト](/guide/testing/)）。
