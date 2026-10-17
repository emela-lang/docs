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

## fiber

- fiber は1つのスレッドの上で動きます。並列ではないので、速くなるのは待ちを重ねられるときだけです。待たない計算は、fiber に分けても合計の時間は変わりません。
- 切り替えが起きるのは中断点だけです。中断点は、Async を要求する suspend な操作の呼び出し（`sleep` やファイル、通信）と、ランタイムが公平性のために挟む譲渡です。
- 譲渡は、中断しうる呼び出しの位置にだけ挟みます。ランタイムが呼び出しの回数を数えて一定の回数ごとに他の fiber へ譲るので、切り替えの順序は実行のたびに同じです。回数は決まっていません。
- 中断しうる呼び出しを挟まない区間は一息に実行されます。R が Immediate な関数は、他の fiber から見て一息に実行されます（[中断する操作](/guide/suspend/)）。

したがって、中断しうる呼び出しのどこででも他の fiber に切り替わりうるものとして書きます。

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

`racy` では10個の fiber が全員 0 を読んでから書くので、結果は 1 です。読んで書く処理は `st.update(fn(n) { n + 1 })` にすれば一息になります（`update` の `f` は純粋です）。

## 組み合わせ関数

ふだんの並行処理は、次の5つの関数で足ります。どれも下の `Fiber.scope` の上に Emela で書かれた普通の関数です。

- `Fiber.both(f, g)` は型の違う2つを並行に実行して組で返します。
- `Fiber.map(xs, f)` は各要素に `f` を並行に適用し、元の順で返します。
- `Fiber.all(fs)` は関数のリストを並行に実行し、元の順で返します。
- `Fiber.race(fs)` は最初に終わったものを採り、残りを中断します。最初に終わったものがエラーなら、そのエラーで失敗します。
- `Fiber.timeout(ms, f)` は `f` を `ms` ミリ秒まで待ちます。間に合えば `Some`、間に合わなければ `f` を中断して `None` です。時間は Clock で測ります。

どれも、1つが失敗すれば残りを中断して、そのエラーで失敗します。型は [State・Fiber・Deferred](/std/state-fiber/) にあります。

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

- 後で実行するものは `fn() { ... }` で包んで渡します。引数なしの関数の短い書き方はありません。
- 時間切れを失敗にしたいときは `Option.or_fail` を挟みます。

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

途中で join したい、Deferred を使いたい、のような込み入った形には `Fiber.scope` と `Fiber.fork` を直接使います。

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

- `Fiber.scope(body)` は、fiber を起動する能力 `Scope` を供給して `body` を実行します。Scope を供給できるのは `Fiber.scope` だけで、ハンドラは書けません（E0413）。
- `Fiber.fork(f)` は `f` を子の fiber として起動し、ハンドル `Fiber[A]` を返します。`(use Scope).fork(f)` と同じです。
- fork できるのは、Scope が供給されているところ（scope に渡した関数と、そこから呼ばれた関数の中）だけです。補助の関数はスコープを引数で受けず、`use Scope` で受けます。
- fork は中断点ではありません。子は待ち行列に入り、親が次に中断したときに走り始めます。上の `parent first` が先に出るのはこのためです。
- 子は、スコープを抜けるまでに必ず終わります。本体が値を返した時点で残っている子は中断され、すべての子の巻き戻り（release を含む）が終わってから scope が値を返します。走り始める前に中断された子は、`f` を呼ばずに終わります。
- `Fiber.join(fiber)` は子が終わるのを待って値を返します。待つのは join を呼んだ fiber だけで、ほかの fiber はその間も進みます。終わった子の値は覚えておくので、2回目からはすぐ返ります。
- 親より長生きする、切り離された fiber はありません。常駐する処理は main の直下のスコープで fork します。

### 失敗は兄弟を中断する

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

- 子の fails は、`Scope[E, R]` の E を通してスコープの fails に合流します。上の `Fiber.scope(...)` の型は `Int fails Boom` で、escape で受けられます。
- 中断された子（`work(1, 300)`）は、途中の with の release を内側から実行して巻き戻ります。`work 1 done` は出ません。
- 2つ以上の子が失敗したときは、先に失敗したものがスコープの結果になり、後の失敗は表示の注記（`note: another fiber also failed: ...`）に回ります。
- 子が失敗した時点でスコープは閉じます。その後の fork は defect です。
- 子のエラーをスコープに伝えたくないときは、子の中で `Fiber.attempt` で包みます（下の「Exit と Cause」）。

### 子のハンドラはスコープを呼んだ時点のもの

子の中で使うハンドラは、`Fiber.scope` を呼んだ時点のものです。スコープの本体の中に書いた with は、子には配られません。

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
    # error[E0402]: effect `Users` is not provided in `main`
    #   = note: fibers forked in `Fiber.scope` get their handlers from where `Fiber.scope` is called, so `with` inside it does not reach them
  }
}
```

直すには、with をスコープの外に出します（`with PostgresUsers { Fiber.scope(fn() { ... }) }`）。

- 子の E と R は、`Scope[E, R]` の E と R に含まれなければなりません。子が使うエフェクトは、Fiber.scope の外で供給します。
- この規則のおかげで、子より先に終わる with のハンドラを子が使うことは、型の上では起きません。例外は、同じエフェクトをスコープの外でも供給していて、本体の中の with で作ったクロージャを子に渡した場合です。その with が先に終われば、実行時の検査で defect になります。
- 子の中の `use Scope` だけは、その子が属すスコープ自身を指します。子は兄弟を fork できます。
- fork は Async を要求します。Fiber.scope の R に Async が残るので、`main` かテスト関数の中か、Async を R に持つ関数の中で使います。

### 入れ子のスコープ

入れ子のスコープでは、`use Scope` と `Fiber.fork` は最も内側のスコープを指します。外側へ fork するときは、外側で取り出した能力の値を使います。

```emela check
import Std.Console.{Console, SystemConsole}
import Std.Clock.{Clock, SystemClock}
import Std.Fiber.{Fiber, Scope}

fn main() {
  with SystemConsole, SystemClock {
    console = use Console
    clock = use Clock
    Fiber.scope(fn() {
      outer = use Scope
      Fiber.scope(fn() {
        outer.fork(fn() {
          clock.sleep(100)
          console.print_line("outer child")
        })
        Fiber.fork(fn() {
          clock.sleep(100)
          console.print_line("inner child")
        })
        clock.sleep(10)
      })
      console.print_line("inner scope ended")
      clock.sleep(200)
    })
  }
}
```

```console
$ emela run main.emel
inner scope ended
outer child
```

内側の子は内側のスコープと一緒に終わり、外側に fork した子は外側のスコープが終わるまで走ります。

## 中断

`Fiber.interrupt(fiber)` は子を中断し、巻き戻りが終わるまで待ちます。終わっている子には何もしません。

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

- 中断は、対象の fiber が次の中断点に達したときに効きます。そこから巻き戻り、途中の with の release が内側から順に実行されます。
- release の実行中は中断されません。中断は、実行中の release が終わった後に効きます。
- 子が中断されるのは、スコープの本体が値を返したとき、兄弟が失敗したとき、`Fiber.interrupt` を呼ばれたときの3通りです。
- 自分自身への `Fiber.interrupt` は、その場で巻き戻ります。

中断された子を `Fiber.join` すると defect です。中断の起こり方によりません。中断されうる子の結果を見たいときは、上のように `Fiber.await` を使います。

```emela check
import Std.Clock.{Clock, SystemClock}
import Std.Fiber.{Fiber}

fn main() {
  with SystemClock {
    Fiber.scope(fn() {
      child = Fiber.fork(fn() { (use Clock).sleep(1000) })
      Fiber.interrupt(child)
      Fiber.join(child)
    })
  }
}
```

```console
$ emela run main.emel
defect: fiber was interrupted
$ echo $?
101
```

## Exit と Cause

fiber が正常に終わらなかったときの原因は3種類で、`Std.Cause` の `Cause[E]` で表します。

| 原因 | 発生源 | 型に現れるか |
|---|---|---|
| Fail | fail | 現れる（E） |
| Die | defect | 現れない |
| Interrupt | 中断 | 現れない |

`Fiber.attempt(f)` は `f` をその場で実行し、Fail と Die を値（`Exit[A, E]`）に変えます。

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

- `Exit[A, E]` は `Success(A)` か `Failure(Cause[E])` です。バリアントは `import Std.Fiber.{Success, Failure}` で取り込みます。
- 「E のどれか」という値の型は作れないので、Cause から中身のエラーは取り出せません。できるのは、種類を見る（`Cause.kind`）、文字列にする（`Cause.to_string`）、起こし直す（`Cause.raise`）の3つです。
- attempt は、defect を値に変えられる境界です。attempt の外では、defect は escape を素通りします。
- attempt は、自分の fiber への中断を受けません。受けると、中断を握りつぶして走り続ける fiber が書けてしまうためです。

起こし直した後は、escape で具体的なエラーとして受けられます。

```emela check
import Std.Console.{Console, SystemConsole}
import Std.Fiber.{Fiber, Success, Failure}
import Std.Cause.{Cause}

error NotFound(id: Int)

fn find(id: Int) -> String fails NotFound {
  if id == 0 { fail NotFound(id:) } else { "user #{id}" }
}

fn main() {
  with SystemConsole {
    exit = Fiber.attempt(fn() { find(0) })
    name = exit match {
      Success(name) -> name
      Failure(cause) -> Cause.raise(cause) escape { NotFound(id:) -> "missing #{id}" }
    }
    (use Console).print_line(name)
  }
}
```

```console
$ emela run main.emel
missing 0
```

`Fiber.await(fiber)` は子が終わるのを待って `Exit[A, {}]` を返します。子の Fail と Die はスコープへ伝わるので、await に届くのは成功か中断だけです。原因ごとに、どこで受けるかをまとめます。

| 原因 | attempt | await | スコープ |
|---|---|---|---|
| Fail | Failure として受ける | 届かない | 兄弟を中断して伝える |
| Die | Failure として受ける | 届かない | 兄弟を中断して伝える |
| Interrupt | 受けずに巻き戻る | Failure として受ける | その子だけが終わる |

子のエラーでスコープを止めたくないときは、子の中を attempt で包みます。fork の種類は増やしません。

```emela
s.fork(fn() {
  Fiber.attempt(fn() { handle(conn) }) match {
    Success(_) -> ()
    Failure(cause) -> (use Console).print_error_line(Cause.to_string(cause))
  }
})
```

## Deferred

Deferred は、一度だけ値を入れられる入れ物で、fiber の間で値を受け渡します。`Fiber.deferred()`（`(use Scope).deferred()`）で作り、作ったスコープに属します。

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

- `Deferred.complete(d, v)` は最初の1回だけ値を入れて True を返します。2回目からは何もせず False です。中断しません。
- `Deferred.await(d)` は値が入るまで待ちます。何人で待ってもよく、値が入れば全員が再開します。
- `Deferred.poll(d)` は、入っていれば `Some(値)`、まだなら `None` を返します。待ちません。
- 誰も値を入れない Deferred を待つ子は、スコープの終わりで中断されます。
- 使いみちは3つです。どれか1つが終わるのを待つ（`Fiber.race` はこれで書かれています）、走り続ける子から途中の値を受け取る（上の `ready`）、止める合図を配る（上の `stop`）。外から強制的に止めるのは `Fiber.interrupt` です。

外部関数のコールバックの中では待てないので、コールバックからファイルや通信を扱いたいときは、Deferred で fiber に合図を送り、fiber の側で扱います。

## 持ち出しの禁止

Scope の能力、fiber のハンドル（`Fiber[A]`）、Deferred は、スコープの外へ持ち出せません。

```emela check=error
import Std.Clock.{Clock, SystemClock}
import Std.Fiber.{Fiber}

fn main() {
  with SystemClock {
    f = Fiber.scope(fn() {
      Fiber.fork(fn() { (use Clock).sleep(10) })
    })
    # error[E0425]: a `Fiber` cannot leave the `Fiber.scope` that started it
    ()
  }
}
```

- Scope は能力なので、能力の値の規則がそのまま掛かります。引数に渡す、データに入れる、返すはエラーです（E0408〜E0410、[状態と資源](/guide/resources/)）。
- `Fiber.scope` の値の型のどこかに `Fiber` か `Deferred` が含まれていればエラーです（E0425）。`Option[Fiber[User]]` も含みます。スコープの外では子はもう終わっているので、正しいプログラムを拒むことはありません。
- 型で止まらない持ち出し（State に入れる、クロージャで捕まえて返す）は、実行時に検査します。

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

終わったスコープの fork と deferred、ハンドルの join と await と interrupt、Deferred の complete と await と poll は、どれも defect になります（`fiber scope was used after it ended`、`deferred was completed after its scope ended` など）。

:::caution[0.22 で静的に止める予定]
0.22 で capture set が入ると、ハンドルと Deferred を「作ったスコープの能力を抱えた値」として扱い、上の実行時の検査をすべて静的なエラーにします。0.20 でエラーになるプログラムは 0.22 でもエラーです。版を上げて通らなくなるのは、0.20 で実行時の defect だったものだけです。

| 持ち出し方 | 0.20 | 0.22 |
|---|---|---|
| 能力の値（Scope を含む）を引数に渡す、データに入れる、返す | 静的（E0408〜E0410） | 静的 |
| 能力を捕まえたクロージャを with やスコープの外へ出す | 実行時 | 静的 |
| `Fiber` や `Deferred` を型に含む値を Fiber.scope から返す | 静的（E0425） | 静的 |
| `Fiber` や `Deferred` を State に入れる、クロージャで捕まえて外へ出す | 実行時 | 静的 |
:::

## 並列はない

複数のスレッドでの並列実行はありません。CPU を使う計算を fiber に分けても速くなりません。将来は、純粋な関数に限った並列の仕組みと、ヒープを分けたワーカーの間のメッセージを検討しています。スレッドやロックを言語に出すことはしません。

並行するコードのテストは、仮の時刻で動く TestClock で書けます。[テスト](/guide/testing/)に続きます。
