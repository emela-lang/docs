---
title: 並行処理
description: タスク、組み合わせ関数、Task.Group と Task.Background、中断、Exit と Cause、Deferred、Semaphore、Queue、with の外へ持ち出せないもの
---

複数の待ちを重ねるにはタスクを使います。タスクは並行に進める仕事の単位で、必ず with の項目（`Task.Group` か `Task.Background`）の中で始め、その with を抜けるまでに終わります。`async` や `await` のような専用の構文はなく、すべて `Std.Task` の関数と with の項目で書きます。

```emela check
import Std.Console.{Console, SystemConsole}
import Std.Clock.{Clock, SystemClock}
import Std.Task.{Task}

fn tick(name: String, n: Int, ms: Int) -> Int uses { Clock, Console } {
  clock <- Clock
  console <- Console
  List.each(List.range(0, n), |i| {
    clock.sleep(ms)
    console.print_line("#{name} #{i}")
  })
  n
}

fn main() {
  console <- Console
  with SystemConsole, SystemClock {
    (a, b) = Task.both(|| tick("a", 3, 100), || tick("b", 2, 130))
    console.print_line("done #{a + b}")
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

2つの `tick` が交互に進み、全体は約300ミリ秒で終わります。`tick` 自身はタスクのことを知りません。

:::note[0.28 までの Std.Fiber]
0.29 で `Std.Fiber` はなくなり、`Std.Task` に置き換わりました。`Fiber.scope` と `Fiber.fork` は `with tasks = Task.Group { ... }` と `tasks.start(...)` に、`Fiber.both` などの組み合わせ関数は `Task.both` などになります。`Fiber.await` と `Fiber.interrupt` に当たるものはありません（[中断](#中断)）。
:::

## 切り替わる場所

タスクは1つのスレッドの上の fiber で動き、並列には動かないので、速くなるのは待ちを重ねられるときだけです。待たない計算をタスクに分けても、合計の時間は変わりません。

切り替えが起きるのは中断点だけです。`sleep` やファイル、通信のような Async を要求する suspend な操作を呼んだときと、ランタイムが公平性のために挟む譲渡がそれにあたります。中断しうる呼び出しを挟まない区間は一息に実行されるので、中断しうる呼び出しのどこででも他のタスクに切り替わりうるものとして書きます。

```emela check
import Std.Console.{Console, SystemConsole}
import Std.Clock.{Clock, SystemClock}
import Std.State.{State}
import Std.Task.{Task}

fn pause() -> () uses { Clock } {
  clock <- Clock
  clock.sleep(0)
}

# 中断点がないので一息に進む
fn safe() -> () uses { State[Int] } {
  st <- State[Int]
  st.set(st.get() + 1)
}

# get と set の間に中断点があるので、他のタスクが割り込む
fn racy() -> () uses { State[Int], Clock } {
  st <- State[Int]
  x = st.get()
  pause()
  st.set(x + 1)
}

fn main() {
  console <- Console
  with SystemConsole, SystemClock {
    (_, a) = State.run(0, || Task.map(List.range(0, 10), |i| safe()))
    (_, b) = State.run(0, || Task.map(List.range(0, 10), |i| racy()))
    console.print_line("safe: #{a}, racy: #{b}")
  }
}
```

```console
$ emela run main.emel
safe: 10, racy: 1
```

`racy` では10個のタスクが全員 0 を読んでから書くので、結果は 1 です。読んで書く処理は `st.update(|n| n + 1)` にすれば一息になります（`update` の `f` は純粋です）。細かい規則は [意味論](/reference/semantics/) にあります。

## 組み合わせ関数

ふだんの並行処理は次の5つの関数で足ります。

- `Task.both(f, g)` は型の違う2つを並行に実行して組で返します。
- `Task.map(xs, f)` は各要素に `f` を並行に適用し、元の順で返します。
- `Task.all(fs)` は関数のリストを並行に実行し、元の順で返します。
- `Task.race(fs)` は最初に終わったものを採り、残りを中断します。最初に終わったものがエラーなら、そのエラーで失敗します。
- `Task.timeout(ms, f)` は `f` を `ms` ミリ秒まで待ちます。間に合えば `Some`、間に合わなければ `f` を中断して `None` です。時間は Clock で測ります。

どれも、1つが失敗すれば残りを中断して、そのエラーで失敗します。後で実行するものは `|| ...` で包んで渡します。型は [State と Task](/std/state-task/) にあります。

```emela check
import Std.Console.{Console, SystemConsole}
import Std.Clock.{Clock, SystemClock}
import Std.Task.{Task}

error NotFound(id: Int)

fn fetch(id: Int, ms: Int) -> String fails NotFound uses { Clock, Console } {
  clock <- Clock
  console <- Console
  clock.sleep(ms)
  console.print_line("fetched #{id}")
  if id < 0 { fail NotFound(id:) } else { "user #{id}" }
}

fn main() {
  console <- Console
  with SystemConsole, SystemClock {
    (a, b) = Task.both(|| fetch(1, 200), || fetch(2, 100))
    console.print_line("both: #{a}, #{b}")
    names = Task.map([3, 4, 5], |id| fetch(id, 100 * (6 - id)))
    console.print_line("map: #{names}")
    first = Task.race([|| fetch(6, 300), || fetch(7, 100)])
    console.print_line("race: #{first}")
    late = Task.timeout(100, || fetch(8, 1000))
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
import Std.Task.{Task}

error TooSlow(ms: Int)

fn slow() -> Int uses { Clock } {
  clock <- Clock
  clock.sleep(500)
  1
}

fn main() {
  console <- Console
  with SystemConsole, SystemClock {
    r = Task.timeout(100, || slow()) |> Option.or_fail(TooSlow(ms: 100))
    console.print_line("#{r}")
  }
}
```

```console
$ emela run main.emel
error: TooSlow
$ echo $?
1
```

同時に走る数に上限を付ける（「1000件を最大10並行で」）には [Semaphore](#semaphore) を使います。

## Task.Group

途中で join したい、Deferred を使いたい、のような込み入った形には `Task.Group` を直接使います。5つの組み合わせ関数もこの上に Emela で書かれた普通の関数です。

```emela check
import Std.Console.{Console, SystemConsole}
import Std.Clock.{Clock, SystemClock}
import Std.Task.{Task}

fn main() {
  console <- Console
  clock <- Clock
  with SystemConsole, SystemClock {
    n = with tasks = Task.Group {
      tasks.start(|| console.print_line("child runs"))
      tasks.start(|| {
        clock.sleep(1000)
        console.print_line("never printed")
      })
      console.print_line("parent first")
      clock.sleep(10)
      1
    }
    console.print_line("group returned #{n}")
  }
}
```

```console
$ emela run main.emel
parent first
child runs
group returned 1
```

- `with tasks = Task.Group { 本体 }` はタスクのグループを作り、タスクを始める能力 `tasks` を本体に渡します。
- `tasks.start(f)` は `f` をグループのタスクとして始め、`Task[A]` を返します。start は中断点ではないので、タスクは始めた側が次に中断したときに走り始めます。`parent first` が先に出るのはこのためです。
- `task.join()`（`Task.join(task)` と同じ）はタスクの値を待ちます。待つのは join を呼んだタスクだけで、ほかのタスクはその間も進みます。
- 本体が値を返した時点で残っているタスクは中断され、すべてのタスクの巻き戻りが終わってから with が値を返します。上の `never printed` が出ないのはこのためです。

with より長生きするタスクはないので、常駐する処理は、それに頼る処理全体を囲む with で始めます。

タスクを始める補助の関数は、グループの能力を引数で受けます。型は `use TaskGroup[E, R]` で、E と R はグループのタスクの fails と uses です。型引数にすると、呼ぶ側のグループに別のエラーやエフェクトがあっても渡せます。

```emela check
import Std.Console.{Console, SystemConsole}
import Std.Clock.{Clock, SystemClock}
import Std.Task.{Task, TaskGroup}

fn fetch(url: String) -> () uses { Clock, Console } {
  clock <- Clock
  console <- Console
  clock.sleep(String.length(url) * 10)
  console.print_line("fetched #{url}")
}

# 呼んだ側のグループにタスクを足す
fn crawl[E, R](
  tasks: use TaskGroup[E, { Clock, Console, R }],
  urls: List[String],
) -> List[Task[()]] {
  List.map(urls, |url| tasks.start(|| fetch(url)))
}

fn main() {
  console <- Console
  with SystemConsole, SystemClock {
    with tasks = Task.Group {
      started = crawl(tasks, ["/a", "/bb", "/c"])
      List.each(started, |task| task.join())
    }
    console.print_line("all fetched")
  }
}
```

```console
$ emela run main.emel
fetched /a
fetched /c
fetched /bb
all fetched
```

`crawl` が返したタスクを本体で join しているので、with は3つとも終わるまで待ちます。join しなければ、本体が終わった時点で3つとも中断されます。

### タスクが失敗したとき

タスクがエラーか defect で終わると、兄弟のタスクは中断され、本体は次の中断点でその原因で失敗します。with はすべてのタスクの巻き戻りが終わってから、その原因で失敗します。

```emela check
import Std.Console.{Console, SystemConsole}
import Std.Clock.{Clock, SystemClock}
import Std.Task.{Task}

effect Job {
  fn name() -> String
}

handler Tracked(name: String): Job {
  init {
    console <- Console
    console.print_line("start job")
    Tracked(name: "job")
  }
  release {
    console <- Console
    console.print_line("release #{self.name}")
  }
  fn name() { self.name }
}

error Boom(id: Int)

fn work(id: Int, ms: Int) -> Int fails Boom uses { Clock, Console } {
  clock <- Clock
  console <- Console
  with Tracked {
    clock.sleep(ms)
    if id == 2 { fail Boom(id:) }
    console.print_line("work #{id} done")
    id
  }
}

fn main() {
  console <- Console
  with SystemConsole, SystemClock {
    r = with tasks = Task.Group {
      a = tasks.start(|| work(1, 300))
      b = tasks.start(|| work(2, 100))
      a.join() + b.join()
    } escape {
      Boom(id:) -> 0 - id
    }
    console.print_line("result #{r}")
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

タスクの fails はグループの fails に合流し、with の fails になります。上の with の型は `Int fails Boom` で、escape で受けられます。中断された `work(1, 300)` は途中の with の release を実行して巻き戻り、`work 1 done` は出ません。タスクのエラーでグループを止めたくないときは、タスクの中を `Exit.attempt` で包むか、[Task.Background](#taskbackground) で始めます。

### タスクが使うハンドラ

タスクの R は、グループの with の外で供給します。グループを囲む with と、同じ with でグループより前に書いた項目がそれにあたります。グループの本体の中に書いた with は、タスクには届きません。

```emela check=error
import Std.Clock.{SystemClock}
import Std.Task.{Task}

effect Users {
  fn find(id: Int) -> String
}

handler PostgresUsers: Users {
  fn find(id) { "user #{id}" }
}

fn main() {
  users <- Users
  with SystemClock {
    with tasks = Task.Group {
      with PostgresUsers {
        tasks.start(|| users.find(1))
      }
      ()
    }
  }
}
```

```text
error[E4301]: effect `Users` is not provided in `main`
  = note: tasks get their handlers from outside the `with` of their group, so `with` inside it does not reach them
  = help: provide it with `with` outside the group
```

直すには、with をグループの外に出します（`with PostgresUsers, tasks = Task.Group { ... }`）。タスクが使うエフェクトはグループの外で供給するので、タスクより先に終わる with のハンドラをタスクが使うことは、型の上で起きません。

## Task.Background

結果を見ない仕事（監査のログ、計測値の送信）は `Task.Background` で始めます。

```emela check
import Std.Console.{Console, SystemConsole}
import Std.Clock.{Clock, SystemClock}
import Std.Cause.{Cause}
import Std.Task.{Task}

error Lost(id: Int)

fn audit(id: Int) -> () fails Lost uses { Clock, Console } {
  clock <- Clock
  console <- Console
  clock.sleep(100)
  if id == 2 { fail Lost(id:) }
  console.print_line("audited #{id}")
}

fn main() {
  console <- Console
  with SystemConsole, SystemClock {
    with bg = Task.Background(
      on_failure: |cause| console.print_line("failed: #{Cause.to_string(cause)}"),
    ) {
      bg.start(|| audit(1))
      bg.start(|| audit(2))
      bg.start(|| audit(3))
      console.print_line("responded")
    }
    console.print_line("background done")
  }
}
```

```console
$ emela run main.emel
responded
audited 1
failed: error: Lost
audited 3
background done
```

- `bg.start(f)` は `f` をタスクとして始め、`()` を返します。`f` は `()` を返す関数です。値の要るタスクはグループで始めます。
- release は、本体が値で終わっても失敗で終わっても、タスクを中断せずにすべて終わるまで待ちます。release が待っている間に始めたタスクも待ちます。
- タスクが失敗しても、兄弟と本体は止まりません。そのタスクが巻き戻った後に、そのタスクの中で `on_failure` が原因を受け取ります。`on_failure` の R は、タスクの R と同じく with の外で供給します。
- with が外から中断されたときだけ、タスクも中断されます。このとき `on_failure` は呼ばれません。
- background は閉じないので、start はいつ呼んでも defect になりません。

[HTTP サービス](/std/http/#http-サービス) の関数は、要求ごとの Background が名前で供給する `Spawn` でタスクを始められます。

## 中断

タスクを中断する関数はありません。タスクが中断されるのは次の2つのときだけです。

- グループのタスクは、グループの本体が終わったときと、同じグループの兄弟が失敗したときに中断されます。
- background のタスクは、background の with が外から中断されたときに中断されます。

1つのタスクだけを止めたいときは、そのタスクだけのグループで始めて、その with を終わらせます。

```emela check
import Std.Console.{Console, SystemConsole}
import Std.Clock.{Clock, SystemClock}
import Std.Task.{Task}

fn heartbeat() -> () uses { Clock, Console } {
  clock <- Clock
  console <- Console
  List.each(List.range(0, 100), |i| {
    clock.sleep(100)
    console.print_line("beat #{i}")
  })
}

fn main() {
  console <- Console
  clock <- Clock
  with SystemConsole, SystemClock {
    # heartbeat だけのグループ。本体が終わると heartbeat は中断される
    with tasks = Task.Group {
      tasks.start(|| heartbeat())
      clock.sleep(350)
    }
    console.print_line("stopped")
  }
}
```

```console
$ emela run main.emel
beat 0
beat 1
beat 2
stopped
```

中断は、対象のタスクが次の中断点に達したときに効きます。そこから巻き戻り、途中の with の release が内側から順に実行されます。release の実行中は中断されず、中断は release が終わった後に効きます。

走り続けるタスクに自分で止まってもらうときは、[Deferred](#deferred) で止める合図を渡します。

## エラーを値にする

計算が失敗したときの原因は、`Std.Cause` の `Cause[E]` で表します。原因は fail によるエラー（Fail）と defect（Die）の2種類で、型の E に現れるのは Fail だけです。中断は原因ではなく、値として受け取ることはありません。`Std.Exit` の `Exit.attempt(f)` は `f` をその場で実行し、Fail と Die を値（`Exit[A, E]`）に変えます。タスクは始めません。

```emela check
import Std.Console.{Console, SystemConsole}
import Std.Exit.{Exit, Success, Failure}
import Std.Cause.{Cause, Fail, Die}

error NotFound(id: Int)

fn find(id: Int) -> String fails NotFound {
  if id == 0 { fail NotFound(id:) }
  if id < 0 { panic("negative id") }
  "user #{id}"
}

fn describe(id: Int) -> String {
  Exit.attempt(|| find(id)) match {
    Success(name) -> name
    Failure(cause) -> Cause.kind(cause) match {
      Fail -> "fail: #{Cause.to_string(cause)}"
      Die  -> "die: #{Cause.to_string(cause)}"
    }
  }
}

fn main() {
  console <- Console
  with SystemConsole {
    console.print_line(describe(1))
    console.print_line(describe(0))
    console.print_line(describe(-1))
  }
}
```

```console
$ emela run main.emel
user 1
fail: error: NotFound
die: defect: negative id
```

`Exit[A, E]` は `Success(A)` か `Failure(Cause[E])` で、バリアントは `import Std.Exit.{Success, Failure}` で取り込みます。Cause から中身のエラーは取り出せません。種類を見る（`Cause.kind`）か、文字列にする（`Cause.to_string`）か、`Cause.raise` で起こし直して escape で受けます。attempt の外では、defect は escape を素通りします。

タスクのエラーでグループを止めたくないときは、タスクの中を attempt で包みます。

```emela
tasks.start(|| {
  Exit.attempt(|| handle(conn)) match {
    Success(_) -> ()
    Failure(cause) -> console.print_error_line(Cause.to_string(cause))
  }
})
```

attempt は自分のタスクの中断を受け取りません。受け取れると、タスクが中断を握りつぶして走り続けられてしまうからです。細かい規則は [意味論](/reference/semantics/) にあります。

## Deferred

Deferred は一度だけ値を入れられる入れ物で、タスクの間で値を受け渡します。`with d = Deferred` で空の Deferred を作り、`d` がその能力です。

```emela check
import Std.Console.{Console, SystemConsole}
import Std.Clock.{Clock, SystemClock}
import Std.Deferred.{Deferred}
import Std.Task.{Task}

fn poll_loop(n: Int, stop: use Deferred[()]) -> Int uses { Clock } {
  clock <- Clock
  stop.poll() match {
    Some(_) -> n
    None -> {
      clock.sleep(100)
      poll_loop(n + 1, stop)
    }
  }
}

fn main() {
  console <- Console
  clock <- Clock
  with SystemConsole, SystemClock {
    with ready = Deferred, stop = Deferred, tasks = Task.Group {
      worker = tasks.start(|| {
        clock.sleep(50)
        ready.complete("port 8080")
        poll_loop(0, stop)
      })
      console.print_line("ready: #{ready.await()}")
      clock.sleep(250)
      stop.complete(())
      console.print_line("rounds: #{worker.join()}")
    }
  }
}
```

```console
$ emela run main.emel
ready: port 8080
rounds: 3
```

- `d.complete(v)` は最初の1回だけ値を入れて True を返し、2回目からは何もせず False です。`d.await()` は値が入るまで待ち、`d.poll()` は待たずに `Some(値)` か `None` を返します。complete と poll は中断しません。
- 1つの Deferred をいくつのタスクが待ってもかまいません。値が入ると全員が再開します。
- 走り続けるタスクから途中の値を受け取る（上の `ready`）、止める合図を配る（上の `stop`）のに使い、`Task.race` もこれで書かれています。
- 値の型は推論されます。書くときは `Deferred[Port]` です。補助の関数は `use Deferred[()]` の型で能力を受けます。

外部関数のコールバックの中では待てないので、コールバックからファイルや通信を扱いたいときは、Deferred でタスクに合図を送り、タスクの側で扱います。

## Semaphore

Semaphore は、あるコードを同時に実行するタスクの数を絞ります。決まった数の許可を持ち、タスクは許可を取っている間だけそのコードを実行します。`with s = Semaphore(permits: n)` で作ります。

```emela check
import Std.Console.{Console, SystemConsole}
import Std.Clock.{Clock, SystemClock}
import Std.Semaphore.{Semaphore}
import Std.Task.{Task}

fn load(id: Int) -> Int uses { Clock, Console } {
  clock <- Clock
  console <- Console
  console.print_line("start #{id}")
  clock.sleep(100)
  console.print_line("end #{id}")
  id * 10
}

fn main() {
  console <- Console
  with SystemConsole, SystemClock {
    total = with db = Semaphore(permits: 2) {
      xs = Task.map([1, 2, 3, 4], |id| Semaphore.with_permit(db, || load(id)))
      List.fold(xs, 0, |a, b| a + b)
    }
    console.print_line("total #{total}")
  }
}
```

```console
$ emela run main.emel
start 1
start 2
end 1
start 3
end 2
start 4
end 3
end 4
total 100
```

- `Semaphore.with_permit(s, f)` は許可が空くまで待ってから1つ取り、`f` を実行して返します。`f` が値、エラー、defect、中断のどれで終わっても許可は返り、`f` の中の with の release はその前に走ります。
- `with_permits(s, n, f)` は n 個の許可を取ります。待たずに取れるときだけ実行する `try_with_permit`（取れなければ `None`）もあります。`s.available()` は空いている許可の数です。
- 許可は handler member でもあり、`with held = s.Permits(n: 2) { ... }` と開けます。release で許可が返ります。待たない `s.TryPermits(n: 2)` は、取れなければ `NoPermits` で失敗します。
- 待っているタスクは待ち始めた順に許可を受け取ります。
- `f` の中で始めたタスクは許可を持ちません。

## Queue

Queue はタスクの間で値を順に受け渡します。決まった数まで値をためられ、閉じて「もう値は来ない」と知らせられます。`with q = Queue(capacity: n)` で作ります。

```emela check
import Std.Console.{Console, SystemConsole}
import Std.Clock.{SystemClock}
import Std.Queue.{Queue, QueueClosed}
import Std.Task.{Task}

# キューが閉じて空になるまで取り出す
fn drain(jobs: use Queue[String], done: Int) -> Int uses { Console, Async } {
  console <- Console
  Some(jobs.take()) escape { QueueClosed -> None } match {
    Some(job) -> {
      console.print_line("job #{job}")
      drain(jobs, done + 1)
    }
    None -> done
  }
}

fn main() {
  console <- Console
  with SystemConsole, SystemClock {
    n = with jobs = Queue(capacity: 2), tasks = Task.Group {
      worker = tasks.start(|| drain(jobs, 0))
      List.each(["a", "b", "c"], |j| jobs.offer(j))
      jobs.close()
      worker.join()
    } escape {
      QueueClosed -> 0
    }
    console.print_line("handled #{n}")
  }
}
```

```console
$ emela run main.emel
job a
job b
job c
handled 3
```

- `q.offer(v)` は末尾に足し、いっぱいの間は待ちます。`q.take()` は先頭を取り出し、空の間は待ちます。待たない版の `q.try_offer(v)`（足せたら True）と `q.poll()`（`Some` か `None`）、数を返す `q.size()` もあります。
- `q.close()` で閉じると、残っている値は `take` で順に取り出せ、空になった後の `take` と、閉じた後の `offer` は `QueueClosed` で失敗します。
- 待っているタスクは待ち始めた順に進みます。値は `offer` を始めた順に出てきます。
- 値の型は推論されます。書くときは `Queue[Job](capacity: 100)` です。

## with の外へ持ち出せないもの

グループと background の能力、`Task[A]`、Deferred、Semaphore、Queue の能力は、それを作った with の外へ持ち出せません。`Task[A]` はグループの能力に縛られた型なので、タスクを返す with も、タスクを join する関数を返す with もエラーです。

```emela check=error
import Std.Clock.{Clock, SystemClock}
import Std.Task.{Task}

fn main() {
  clock <- Clock
  with SystemClock {
    t = with tasks = Task.Group {
      tasks.start(|| clock.sleep(10))
    }
    ()
  }
}
```

```text
error[E4405]: capability `tasks` leaves the `with` that made it
```

値の型か、関数の値の R に能力が残っていれば、型検査で止まります。実行時の検査はありません。

## 並列はない

複数のスレッドでの並列実行はありません。CPU を使う計算をタスクに分けても速くなりません。スレッドやロックを言語に出すことはしません。

並行するコードは仮の時刻で動く TestClock でテストできます（[テスト](/guide/testing/)）。
