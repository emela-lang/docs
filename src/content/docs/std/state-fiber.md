---
title: State・Fiber・Deferred
description: std の effect 層 Std.State、Std.Fiber、Std.Cause、Std.Deferred のリファレンス
---

std の effect 層は、可変な状態（`Std.State`）と並行性（`Std.Fiber`、`Std.Cause`、`Std.Deferred`）を受け持ちます。このページは型と関数の一覧です。使い方の説明は [リソース](/guide/resources/) と [並行性](/guide/concurrency/) にあります。

## Std.State

可変な状態をエフェクトで表します。状態の置き場所は `State.run` の枠で、値そのものは不変のままです。

```emela
pub effect State[S] {
  fn get() -> S
  fn set(value: S) -> ()
  fn update(f: fn(S) -> S) -> ()
}
```

| 宣言 | シグネチャ | 説明 |
|---|---|---|
| `get` | `fn get() -> S` | 今の状態 |
| `set` | `fn set(value: S) -> ()` | 状態を `value` にする |
| `update` | `fn update(f: fn(S) -> S) -> ()` | 状態に `f` を適用する |
| `run` | `run[S, A, E, R](initial: S, body: fn() -> A fails E use { State[S], R }) -> (A, S) fails E use R` | 初期値 `initial` の状態で `body` を実行し、`body` の値と最後の状態の組を返す |

- `body` の R から `State[S]` が消えるので、`State.run` の呼び出しは外からは純粋に見えます。
- `body` が失敗したときは、状態を捨ててエラーだけが伝わります。失敗の時点の状態も欲しいときは、`body` の中で escape して値に変えます。
- `body` が中断しても、状態は再開の後に引き継がれます。
- `update` の `f` は純粋なので、`update` は一息に実行されます。fiber の間で共有しても途中の状態は見えません。
- 同じ型の状態を2つ持つときは、別の型で包みます（`State[Hits]` と `State[Misses]`）。
- `run` はランタイムが供給する組み込みのハンドラです。

```emela check
import Std.State.{State}

fn next_id() -> Int use State[Int] {
  st = use State[Int]
  st.update(fn(n) { n + 1 })
  st.get()
}

fn main() {
  (ids, last) = State.run(0, fn() { [next_id(), next_id(), next_id()] })
  dbg(ids)  # [1, 2, 3]
  dbg(last) # 3
}
```

テスト用のハンドラ（TestConsole、TestClock、TestFileSystem、TestHttp）は、どれも状態を State に置きます。[Console・Clock・Random・Env](/std/platform/) を見てください。

## Std.Fiber

fiber は1本のスレッドの上の軽い実行の単位です。スコープの中でしか起動できず、どの fiber もスコープより先に終わります。`import Std.Fiber.{Fiber, Scope}` か `import Std.Fiber` で使います。

### 型

| 宣言 | 定義 | 説明 |
|---|---|---|
| `Fiber` | `@external type Fiber[A]` | 型 `A` の値を返す fiber のハンドル。ランタイムが持つ。起動した `Fiber.scope` の外へ持ち出せない |
| `Exit` | `enum Exit[A, E] { Success(A), Failure(Cause[E]) }` | fiber の終わり方。値で終わったか、エラー、defect、中断で終わったか |
| `Scope` | `@intrinsic effect Scope[E, R]` | スコープの中で fiber を起動する能力。`E` と `R` は子の fails と use。供給できるのは `Fiber.scope` だけで、ハンドラは書けない |

`Scope` の操作は次の2つです。

| 操作 | シグネチャ | 説明 |
|---|---|---|
| `fork` | `fn fork[A](f: fn() -> A fails E use R) -> Fiber[A]` | `f` をスコープの子の fiber として起動する |
| `deferred` | `fn deferred[A]() -> Deferred[A]` | スコープに属す Deferred を作る |

### 関数

| 関数 | シグネチャ | 説明 |
|---|---|---|
| `scope` | `scope[A, E, R](body: fn() -> A fails E use { Scope[E, R], Async, R }) -> A fails E use { Async, R }` | スコープを作って `body` を実行し、すべての子が終わってから値を返す |
| `fork` | `fork[A, E, R](f: fn() -> A fails E use { Scope[E, R], R }) -> Fiber[A] use Scope[E, R]` | 一番内側のスコープで `f` を起動する。`(use Scope).fork(f)` と同じ |
| `deferred` | `deferred[A, E, R]() -> Deferred[A] use Scope[E, R]` | 一番内側のスコープに属す Deferred を作る。`(use Scope).deferred()` と同じ |
| `join` | `join[A](fiber: Fiber[A]) -> A use Async` | 子が終わるのを待って値を返す。`interrupt` で中断した子なら defect（`fiber was interrupted`） |
| `await` | `await[A](fiber: Fiber[A]) -> Exit[A, {}] use Async` | 子が終わるのを待って終わり方を返す。子のエラーと defect はスコープへ行くので、届くのは `Success` か中断だけ |
| `interrupt` | `interrupt[A](fiber: Fiber[A]) -> () use Async` | 子を中断し、巻き戻り（`release` を含む）が終わるまで待つ。終わっている子には何もしない |
| `attempt` | `attempt[A, E, R](f: fn() -> A fails E use R) -> Exit[A, E] use R` | `f` をその場で実行し、エラーと defect を値に変える。自分への中断は受けない |
| `all` | `all[A, E, R](fs: List[fn() -> A fails E use R]) -> List[A] fails E use { Async, R }` | すべてを並行に実行し、値を元の順に集める |
| `race` | `race[A, E, R](fs: List[fn() -> A fails E use R]) -> A fails E use { Async, R }` | すべてを並行に実行し、最初に終わったもの（値でもエラーでも）を採る。残りは中断する |
| `both` | `both[A, B, E, R](f: fn() -> A fails E use R, g: fn() -> B fails E use R) -> (A, B) fails E use { Async, R }` | 2つを並行に実行して組で返す |
| `map` | `map[A, B, E, R](xs: List[A], f: fn(A) -> B fails E use R) -> List[B] fails E use { Async, R }` | 各要素に `f` を並行に適用し、結果を元の順に返す |
| `timeout` | `timeout[A, E, R](ms: Int, f: fn() -> A fails E use R) -> Option[A] fails E use { Clock, Async, R }` | `f` を `ms` ミリ秒まで待つ。間に合えば `Some`、間に合わなければ `f` を中断して `None`。時間は Clock で測る |

- `scope` の `body` が返った時点で走っている子は中断されます。子が失敗すると、兄弟と `body` が中断され、その失敗が伝わります。
- 子は `scope` を呼んだ時点のハンドラを使います。子が使うエフェクトは `scope` の外で供給します。
- `all`、`race`、`both`、`map` は、1つが失敗すると残りを中断して、そのエラーで失敗します。
- `timeout` で失敗させたいときは `Option.or_fail` で包みます。
- `scope`、`join`、`await`、`interrupt`、`attempt` は組み込みで、`all`、`race`、`both`、`map`、`timeout` はその上に Emela で書かれています。

```emela check
import Std.Fiber

error TooBig(n: Int)

fn check(n: Int) -> Int fails TooBig {
  if n > 10 { fail TooBig(n:) }
  n
}

fn main() {
  dbg(Fiber.map([1, 2, 3], fn(n) { check(n) * 10 }))  # [10, 20, 30]
  result = Fiber.all([fn() { check(1) }, fn() { check(30) }]) escape {
    TooBig(n:) -> [-n]
  }
  dbg(result)                                        # [-30]
}
```

:::caution[実行時の検査]
スコープ、fiber のハンドル、Deferred の持ち出しの検査は、0.20 では一部が実行時の defect（`fiber scope was used after it ended` など）です。0.22 の capture set ですべて静的な検査になります。
:::

## Std.Cause

fiber が正常に終わらなかった原因です。エラー（`Fail`）、defect（`Die`）、中断（`Interrupt`）のどれかです。

| 宣言 | シグネチャ | 説明 |
|---|---|---|
| `Cause` | `opaque type Cause[E]` | 原因。`E` は起こりうるエラーの集合。中身のエラーは取り出せない |
| `CauseKind` | `enum CauseKind { Fail, Die, Interrupt }` | 原因の種類 |
| `kind` | `kind[E](c: Cause[E]) -> CauseKind` | 原因の種類 |
| `to_string` | `to_string[E](c: Cause[E]) -> String` | `error: ...`、`defect: ...`、`interrupted` の形の文字列 |
| `raise` | `raise[A, E](c: Cause[E]) -> A fails E` | 起こし直す。`Fail` は fail、`Die` は defect、`Interrupt` は中断の巻き戻し |

エラーの和の値は書けないので、Cause はエラーを渡しません。種類を見るか、表示するか、`Cause.raise` で起こし直して escape で受けます。

```emela check
import Std.Fiber
import Std.Fiber.{Exit, Success, Failure}
import Std.Cause

error TooBig(n: Int)

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
  dbg(describe(Fiber.attempt(fn() { check(3) })))      # "ok 3"
  dbg(describe(Fiber.attempt(fn() { check(30) })))     # "Fail: error: TooBig(n: 30)"
  dbg(describe(Fiber.attempt(fn() { panic("boom") }))) # "Die: defect: boom"
  again = Fiber.attempt(fn() { check(30) }) match {
    Success(n)     -> n
    Failure(cause) -> Cause.raise(cause) escape { TooBig(n:) -> -n }
  }
  dbg(again)                                           # -30
}
```

`attempt` は defect を値に変えられる境界です。サーバーで1件の panic が全体を止めないようにするときに使います。

## Std.Deferred

一度だけ値を入れられる入れ物で、fiber の間で値を渡すのに使います。作れるのは Scope の `deferred`（か `Fiber.deferred()`）だけなので、スコープに属し、スコープの外へは持ち出せません。

| 宣言 | シグネチャ | 説明 |
|---|---|---|
| `Deferred` | `@external type Deferred[A]` | 型 `A` の値を1つ入れる入れ物。ランタイムが持つ |
| `complete` | `complete[A](d: Deferred[A], value: A) -> Bool` | 最初の1回だけ値を入れて True。2回目からは何もせず False。中断しない |
| `await` | `await[A](d: Deferred[A]) -> A use Async` | 値が入るまで待って返す。何本の fiber が待ってもよい |
| `poll` | `poll[A](d: Deferred[A]) -> Option[A]` | 入っていれば `Some`、なければ `None`。待たない |

```emela check
import Std.Fiber
import Std.Deferred

fn main() {
  r = Fiber.scope(fn() {
    d = Fiber.deferred()
    before = Deferred.poll(d)
    first = Deferred.complete(d, 1)
    second = Deferred.complete(d, 2)
    (before, first, second, Deferred.await(d))
  })
  dbg(r) # (None, True, False, 1)
}
```

`poll` は、止める合図を区切りごとに見るときに使います。外部関数のコールバックから fiber に合図を送るのにも Deferred を使います（[外部関数](/guide/external/)）。

:::caution[0.21 以降に入る予定]
`Semaphore` と `Queue` は 0.21 で入ります。`Schedule` と `Stream` は後の版です。
:::
