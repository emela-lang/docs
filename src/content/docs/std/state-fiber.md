---
title: State と Fiber
description: 状態の Std.State、並行性の Std.Fiber、終わり方の Std.Exit と Std.Cause、fiber の間で値を渡す Deferred、Semaphore、Queue
---

std のエフェクトの層は、可変な状態（`Std.State`）と並行性（`Std.Fiber` とその部品）を受け持ちます。どれもランタイムと組になっていて、ホストには触れません。使い方の説明は [リソース](/guide/resources/) と [並行性](/guide/concurrency/) にあります。

型と関数の一覧は API リファレンスの [Std.State](/std/api/std-state/)、[Std.Fiber](/std/api/std-fiber/)、[Std.Exit](/std/api/std-exit/)、[Std.Cause](/std/api/std-cause/)、[Std.Deferred](/std/api/std-deferred/)、[Std.Semaphore](/std/api/std-semaphore/)、[Std.Queue](/std/api/std-queue/) にあります。

## State

`State[S]` は、型 `S` の状態を読み書きするエフェクトです。操作は `get`、`set`、`update` の3つで、`State.run(initial, body)` が状態を用意します。`State.run` は本体の値と最後の状態の組を返し、`body` の `use` から `State[S]` を取り除くので、外からは純粋な呼び出しに見えます。

```emela check
import Std.State.{State}

fn next_id() -> Int uses { State[Int] } {
  st = use State[Int]
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
- `update` の `f` は純粋なので、`update` は一息に実行されます。fiber の間で共有しても途中の状態は見えません。
- 同じ型の状態を2つ持つときは、別の型で包みます（`State[Hits]` と `State[Misses]`）。

テスト用のハンドラ（TestConsole、TestClock、TestFileSystem、TestHttp など）は、どれも状態を State に置きます。

## Fiber

fiber は1本のスレッドの上の軽い実行の単位です。`Fiber.scope` の中でしか起動できず、どの fiber もスコープより先に終わります。

- `Fiber.scope(body)` は、`body` の中で `Fiber.fork` した子が全部終わってから値を返します。`body` が返った時点で走っている子は中断されます。子が失敗すると、兄弟と `body` が中断され、その失敗が伝わります。
- `Fiber.join` は子の値を待ち、`Fiber.interrupt` は子を中断して後片付けが終わるまで待ちます。
- 子は `scope` を呼んだ時点のハンドラを使います。子が使うエフェクトは `scope` の外で供給します。

よく使う形は、スコープを内側に持つ関数にしてあります。`Fiber.all`、`Fiber.both`、`Fiber.map` は全部を並行に走らせて値を集め、`Fiber.race` は最初に終わったものを取り、`Fiber.timeout` は時間内に終わらなければ中断して `None` を返します。どれも、1つが失敗すると残りを中断して、そのエラーで失敗します。

```emela check
import Std.Fiber

error TooBig(n: Int)

fn check(n: Int) -> Int fails TooBig {
  if n > 10 { fail TooBig(n:) }
  n
}

fn main() {
  dbg(Fiber.map([1, 2, 3], |n| check(n) * 10)) # [10, 20, 30]
  result = Fiber.all([|| check(1), || check(30)]) escape {
    TooBig(n:) -> [-n]
  }
  _ = dbg(result) # [-30]
}
```

fiber のハンドルと、スコープに属する Deferred、Semaphore、Queue は、そのスコープの外へ持ち出せません。持ち出すとコンパイルのエラーになります。

## Exit と Cause

`Std.Exit` の `Exit[A, E]` は計算の終わり方で、`Success(A)` か `Failure(Cause[E])` です。`Exit.attempt(f)` は `f` をその場で走らせ、エラーと defect を値に変えます。サーバーで1件の panic が全体を止めないようにするときに使います。

`Std.Cause` の `Cause[E]` は失敗の原因で、エラー（`Fail`）、defect（`Die`）、中断（`Interrupt`）のどれかです。エラーの和の値は書けないので、Cause はエラーを取り出させません。`Cause.kind` で種類を見るか、`Cause.to_string` で表示するか、`Cause.raise` で起こし直して escape で受けます。

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

`Fiber.await` も子の終わり方を Exit で返します。子のエラーと defect はスコープへ伝わるので、`await` に届くのは `Success` か中断だけです。

## Deferred

`Std.Deferred` の `Deferred[A]` は、一度だけ値を入れられる入れ物です。fiber の間で値を1つ渡すのに使います。`Fiber.deferred()` で作るのでスコープに属します。

```emela check
import Std.Fiber
import Std.Deferred

fn main() {
  r = Fiber.scope(|| {
    d = Fiber.deferred()
    before = Deferred.poll(d)
    first = Deferred.complete(d, 1)
    second = Deferred.complete(d, 2)
    (before, first, second, Deferred.await(d))
  })
  _ = dbg(r) # (None, True, False, 1)
}
```

`complete` は最初の1回だけ値を入れて True を返します。`await` は値が入るまで待ち、`poll` は待たずに今の中身を返します。外部関数のコールバックから fiber に合図を送るのにも Deferred を使います（[外部関数](/guide/external/)）。

## Semaphore

`Std.Semaphore` の `Semaphore` は決まった数の許可を持ち、同時に走る処理の数を抑えます。`Fiber.semaphore(n)` で作り、`Semaphore.with_permit(s, f)` で許可を待ってから `f` を走らせます。許可は `f` が値、エラー、defect、中断のどれで終わっても返されます。

```emela check
import Std.Clock.{Clock, TestClock}
import Std.Fiber
import Std.Instant
import Std.Semaphore
import Std.State.{State}

## 100ms かかる仕事を、同時に2つまで走らせる。
fn squares(n: Int) -> List[Int] uses { Clock, Async } {
  Fiber.scope(|| {
    permits = Fiber.semaphore(2)
    Fiber.map(List.range(0, n), |i| {
      Semaphore.with_permit(permits, || {
        (use Clock).sleep(100)
        i * i
      })
    })
  })
}

fn main() {
  start = Instant.from_unix_milliseconds(0)
  (result, end) = State.run(start, || with TestClock { squares(5) })
  dbg(result) # [0, 1, 4, 9, 16]
  _ = dbg(Instant.to_unix_milliseconds(end)) # 300
}
```

5つの仕事を2つずつ走らせるので、仮の時刻は 300ms 進みます。待たずに試すときは `try_with_permit` を使います。

## Queue

`Std.Queue` の `Queue[A]` は、容量の決まった値の列です。`Fiber.queue(capacity)` で作ります。`offer` は列が満ちていれば待ち、`take` は空なら待ちます。`close` した列には足せず、残りを取り切ると `take` が `QueueClosed` で失敗するので、消費する側はそれを終わりの合図にします。

```emela check
import Std.Fiber
import Std.Queue
import Std.Queue.{Queue, QueueClosed}

fn sum_all(q: Queue[Int], acc: Int) -> Int uses { Async } {
  next = Some(Queue.take(q)) escape { QueueClosed -> None }
  next match {
    None    -> acc
    Some(x) -> sum_all(q, acc + x)
  }
}

fn main() {
  total = Fiber.scope(|| {
    q = Fiber.queue(2)
    consumer = Fiber.fork(|| sum_all(q, 0))
    List.each(List.range(1, 11), |x| Queue.offer(q, x) escape { QueueClosed -> () })
    Queue.close(q)
    Fiber.join(consumer)
  })
  _ = dbg(total) # 55
}
```

待たずに試すときは `try_offer` と `poll` を使います。
