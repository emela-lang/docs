---
title: State と Task
description: 状態の Std.State、並行性の Std.Task、終わり方の Std.Exit と Std.Cause、タスクの間で値を渡す Deferred、Semaphore、Queue
---

std のエフェクトの層は、可変な状態（`Std.State`）と並行性（`Std.Task` とその部品）を受け持ちます。どれもランタイムと組になっていて、ホストには触れません。使い方の説明は [リソース](/guide/resources/) と [並行性](/guide/concurrency/) にあります。

型と関数の一覧は API リファレンスの [Std.State](/std/api/std-state/)、[Std.Task](/std/api/std-task/)、[Std.Exit](/std/api/std-exit/)、[Std.Cause](/std/api/std-cause/)、[Std.Deferred](/std/api/std-deferred/)、[Std.Semaphore](/std/api/std-semaphore/)、[Std.Queue](/std/api/std-queue/) にあります。

## State

`State[S]` は、型 `S` の状態を読み書きするエフェクトです。操作は `get`、`set`、`update` の3つで、`State.run(initial, body)` が状態を用意します。`State.run` は本体の値と最後の状態の組を返し、`body` の `uses` から `State[S]` を取り除くので、外からは純粋な呼び出しに見えます。

```emela check
import Std.State.{State}

fn next_id() -> Int uses { State[Int] } {
  st <- State[Int]
  st.update(|n| n + 1)
  st.get()
}

fn main() {
  (ids, last) = State.run(0, || [next_id(), next_id(), next_id()])
  dbg(ids) # [1, 2, 3]
  _ = dbg(last) # 3
}
```

- `body` が失敗したときは、状態を捨ててエラーだけが伝わります。失敗の時点の状態も欲しいときは、`body` の中で escape して値に変えます。
- `update` の `f` は純粋なので、`update` は一息に実行されます。タスクの間で共有しても途中の状態は見えません。
- 同じ型の状態を2つ持つときは、別の型で包みます（`State[Hits]` と `State[Misses]`）。

テスト用のハンドラ（TestConsole、TestClock、TestFileSystem、TestHttp など）は、どれも状態を State に置きます。

## Task

タスクは並行に進める仕事の単位で、1本のスレッドの上の fiber で動きます。with の項目 `Task.Group` か `Task.Background` の中でしか始められず、どのタスクもその with より先に終わります。

- `with tasks = Task.Group { ... }` の中で `tasks.start(f)` が始めたタスクは `Task[A]` を返し、`join` で値を待てます。本体が終わった時点で残っているタスクは中断されます。タスクが失敗すると、兄弟が中断され、本体と with がその失敗で失敗します。
- `with bg = Task.Background(on_failure: ...) { ... }` の中で `bg.start(f)` が始めたタスクは値を返しません。release はタスクを中断せずに終わるまで待ち、タスクの失敗は `on_failure` に渡ります。
- タスクの R は、グループや background の with の外で供給します。
- タスクを中断する関数はありません。

よく使う形は、グループを内側に持つ関数にしてあります。`Task.all`、`Task.both`、`Task.map` は全部を並行に走らせて値を集め、`Task.race` は最初に終わったものを取り、`Task.timeout` は時間内に終わらなければ中断して `None` を返します。どれも、1つが失敗すると残りを中断して、そのエラーで失敗します。

```emela check
import Std.Task

error TooBig(n: Int)

fn check(n: Int) -> Int fails TooBig {
  if n > 10 { fail TooBig(n:) }
  n
}

fn main() {
  dbg(Task.map([1, 2, 3], |n| check(n) * 10)) # [10, 20, 30]
  result = Task.all([|| check(1), || check(30)]) escape {
    TooBig(n:) -> [-n]
  }
  _ = dbg(result) # [-30]
}
```

グループと background の能力、`Task[A]`、Deferred、Semaphore、Queue の能力は、それを作った with の外へ持ち出せません。持ち出すとコンパイルのエラー（E4405）になります。

## Exit と Cause

`Std.Exit` の `Exit[A, E]` は計算の終わり方で、`Success(A)` か `Failure(Cause[E])` です。`Exit.attempt(f)` は `f` をその場で走らせ、エラーと defect を値に変えます。サーバーで1件の panic が全体を止めないようにするときに使います。

`Std.Cause` の `Cause[E]` は失敗の原因で、エラー（`Fail`）か defect（`Die`）です。中断は原因ではありません。エラーの和の値は書けないので、Cause はエラーを取り出させません。`Cause.kind` で種類を見るか、`Cause.to_string` で表示するか、`Cause.raise` で起こし直して escape で受けます。

```emela check
import Std.Exit
import Std.Exit.{Exit, Success, Failure}
import Std.Cause

error TooBig(n: Int) derive Show

fn check(n: Int) -> Int fails TooBig {
  if n > 10 { fail TooBig(n:) }
  n
}

fn describe(exit: Exit[Int, TooBig]) -> String {
  exit match {
    Success(n)     -> "ok #{n}"
    Failure(cause) -> "#{Cause.kind(cause)}: #{Cause.to_string(cause)}"
  }
}

fn main() {
  dbg(describe(Exit.attempt(|| check(3)))) # "ok 3"
  dbg(describe(Exit.attempt(|| check(30)))) # "Fail: error: TooBig(n: 30)"
  dbg(describe(Exit.attempt(|| panic("boom")))) # "Die: defect: boom"
  again = Exit.attempt(|| check(30)) match {
    Success(n)     -> n
    Failure(cause) -> Cause.raise(cause) escape { TooBig(n:) -> -n }
  }
  _ = dbg(again) # -30
}
```

## Deferred

`Std.Deferred` の `Deferred[A]` は、一度だけ値を入れられる入れ物です。タスクの間で値を1つ渡すのに使います。`with d = Deferred` で空の入れ物を作り、`d` がその能力です。

```emela check
import Std.Deferred.{Deferred}
import Std.Task

fn main() {
  r = with d = Deferred, tasks = Task.Group {
    before = d.poll()
    tasks.start(|| d.complete(1))
    value = d.await()
    second = d.complete(2)
    (before, value, second)
  }
  _ = dbg(r) # (None, 1, False)
}
```

`complete` は最初の1回だけ値を入れて True を返します。`await` は値が入るまで待ち、`poll` は待たずに今の中身を返します。外部関数のコールバックからタスクに合図を送るのにも Deferred を使います（[外部関数](/guide/external/)）。

## Semaphore

`Std.Semaphore` の `Semaphore` は決まった数の許可を持ち、同時に走る処理の数を抑えます。`with s = Semaphore(permits: n)` で作り、`Semaphore.with_permit(s, f)` で許可を待ってから `f` を走らせます。許可は `f` が値、エラー、defect、中断のどれで終わっても返されます。

```emela check
import Std.Clock.{Clock, TestClock}
import Std.Instant
import Std.Semaphore.{Semaphore}
import Std.State.{State}
import Std.Task

## 100ms かかる仕事を、同時に2つまで走らせる。
fn squares(n: Int) -> List[Int] uses { Clock, Async } {
  clock <- Clock
  with permits = Semaphore(permits: 2) {
    Task.map(List.range(0, n), |i| {
      Semaphore.with_permit(permits, || {
        clock.sleep(100)
        i * i
      })
    })
  }
}

fn main() {
  start = Instant.from_unix_milliseconds(0)
  (result, end) = State.run(start, || with TestClock { squares(5) })
  dbg(result) # [0, 1, 4, 9, 16]
  _ = dbg(Instant.to_unix_milliseconds(end)) # 300
}
```

5つの仕事を2つずつ走らせるので、仮の時刻は 300ms 進みます。待たずに試すときは `try_with_permit` を使います。許可は handler member の `s.Permits(n:)` と `s.TryPermits(n:)` で with の項目として開くこともできます。

## Queue

`Std.Queue` の `Queue[A]` は、容量の決まった値の列です。`with q = Queue(capacity: n)` で作ります。`q.offer(v)` は列が満ちていれば待ち、`q.take()` は空なら待ちます。`q.close()` した列には足せず、残りを取り切ると `take` が `QueueClosed` で失敗するので、消費する側はそれを終わりの合図にします。

```emela check
import Std.Queue.{Queue, QueueClosed}
import Std.Task

fn sum_all(q: use Queue[Int], acc: Int) -> Int uses { Async } {
  next = Some(q.take()) escape { QueueClosed -> None }
  next match {
    None    -> acc
    Some(x) -> sum_all(q, acc + x)
  }
}

fn main() {
  total = with q = Queue(capacity: 2), tasks = Task.Group {
    consumer = tasks.start(|| sum_all(q, 0))
    List.each(List.range(1, 11), |x| q.offer(x) escape { QueueClosed -> () })
    q.close()
    consumer.join()
  }
  _ = dbg(total) # 55
}
```

待たずに試すときは `try_offer` と `poll` を使います。
