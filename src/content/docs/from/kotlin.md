---
title: Kotlin から
description: data class、sealed class、when、null 安全、拡張関数、例外、coroutine と Emela の対応
---

Kotlin の data class と sealed class、`when`、null 安全で書いていたことは、Emela の `type`、`enum`、`match`、`Option` でほぼそのまま書けます。大きく違うのは、例外の代わりに型に出るエラーを使うこと、依存をコンストラクタでなくエフェクトで渡すこと、そして `suspend` の印が呼び出しの連鎖に広がらないことです。

## 対応表

| Kotlin | Emela |
|---|---|
| `data class User(val id: Int, val name: String)` | `type User(id: Int, name: String)` |
| `user.copy(name = "bob")` | `User(name: "bob", ..user)` |
| `sealed interface` と `data class` / `data object` | `enum` とバリアント |
| `when (x) { is A -> ... }` | `x match { A(..) -> ... }` |
| `User?`、`?.`、`?:` | `Option[User]`、`Option.map`、`Option.or` |
| `!!` | `match` に `None -> panic("...")` の腕を書く |
| 拡張関数 `fun List<Int>.total()` | モジュールの関数と `xs \|> total` |
| `throw` / `try` / `catch` | `fail` / `escape` |
| `interface` とコンストラクタ注入 | `effect` / `handler` / `with` |
| `Closeable.use { }` | ハンドラの `init` と `release` |
| `suspend fun` | 印なしの関数。`suspend fn` はエフェクトの操作にだけ付く |
| `coroutineScope { }` | `Fiber.scope(fn() { ... })` |
| `async { }` と `await()` | `Fiber.fork` と `Fiber.join` |
| `launch` と `job.cancel()` | `Fiber.fork` と `Fiber.interrupt` |
| `withTimeoutOrNull(ms) { }` | `Fiber.timeout(ms, fn() { ... })` |
| `val` / `var` | 束縛（不変）。可変な状態は `State` |
| `for (i in 1..10)` | `List.range(1, 11) \|> List.map(...)`、再帰 |
| `"Hello, ${user.name}"` | `"Hello, #{user.name}"` |
| `user.name.length` | `String.length(user.name)` |

## data class と sealed class

```kotlin
data class User(val id: Int, val name: String)

sealed interface Shape {
    data class Circle(val radius: Double) : Shape
    data class Rect(val width: Double, val height: Double) : Shape
    data object Empty : Shape
}

fun area(shape: Shape): Double = when (shape) {
    is Shape.Circle -> Math.PI * shape.radius * shape.radius
    is Shape.Rect -> shape.width * shape.height
    Shape.Empty -> 0.0
}
```

```emela check
type User(id: Int, name: String)

enum Shape {
  Circle(radius: Float)
  Rect(width: Float, height: Float)
  Empty
}

fn area(shape: Shape) -> Float {
  shape match {
    Circle(radius:) -> 3.14159 * radius * radius
    Rect(width:, height:) -> width * height
    Empty -> 0.0
  }
}

fn main() {
  user = User(id: 1, name: "alice")
  dbg(User(name: "bob", ..user))          # User(id: 1, name: "bob")
  dbg(area(Rect(width: 2.0, height: 3.0)))
}
```

- バリアントは型ではありません。`fn f(c: Circle)` とは書けず、引数の型は `Shape` です。
- `match` は網羅していなければエラーです。`when` の `else` に当たるのは `_` です。
- `==` は構造で比べます（data class の `equals` と同じ）。
- 範囲の条件（`in 1..10`）はパターンにありません。ガード（`n if n >= 1 && n <= 10 ->`）で書きます。

## null 安全と Option

Emela に null はありません。ないかもしれない値は `Option[A]` で表します。

```kotlin
fun findUser(id: Int): User? = users.find { it.id == id }

val name = findUser(2)?.name ?: "guest"
```

```emela check
type User(id: Int, name: String)

const USERS = [User(id: 1, name: "alice")]

fn find_user(id: Int) -> Option[User] {
  USERS |> List.find(fn(u) { u.id == id })
}

fn main() {
  name = find_user(2) |> Option.map(fn(u) { u.name }) |> Option.or("guest")
  dbg(name)                               # "guest"

  greeting = find_user(1) match {
    Some(user) -> "Hello, #{user.name}"
    None -> "Hello, stranger"
  }
  dbg(greeting)
}
```

- `?.let { }` は `Option.map`、`Option` を返す関数をつなぐのは `Option.and_then` です。
- 「ないならエラーにする」は `Option.or_fail(opt, NotFound(id:))` です。

## 拡張関数とパイプ

メソッド呼び出しの構文はありません。関数を対象を第1引数に取る形で書き、`|>` でつなぎます。

```kotlin
fun List<Int>.total(): Int = fold(0) { acc, x -> acc + x }

val result = listOf(1, 2, 3, 4).filter { it % 2 == 0 }.total()
```

```emela check
fn total(xs: List[Int]) -> Int {
  List.fold(xs, from: 0, f: fn(acc, x) { acc + x })
}

fn main() {
  result = [1, 2, 3, 4]
    |> List.filter(fn(x) { x % 2 == 0 })
    |> total
  dbg(result)                             # 6
}
```

- `x |> f(a)` は `f(x, a)` と同じです。左の値が第1引数に入ります。
- ラムダは `fn(x) { ... }` の1形式だけで、`it` はありません。

## 例外と error

Kotlin の例外は型に出ませんが、Emela のエラーは関数の型（`fails`）に出ます。受けなかったエラーはコンパイラが追い、`main` まで漏れれば実行時に `error: ...` と出て終わります。

```kotlin
class NotFound(val id: Int) : Exception("not found: $id")

fun find(id: Int): User =
    if (id == 1) User(1, "alice") else throw NotFound(id)

val user = try { find(2) } catch (e: NotFound) { User(0, "guest") }
```

```emela check
error NotFound(id: Int)

type User(id: Int, name: String)

# 推論される型: fn(Int) -> User fails NotFound
fn find(id: Int) {
  if id == 1 { User(id: 1, name: "alice") } else { fail NotFound(id:) }
}

fn main() {
  user = find(2) escape {
    NotFound(_) -> User(id: 0, name: "guest")
  }
  dbg(user)
}
```

- `escape` の腕には `error` で宣言した構成子だけを書けます。`catch (e: Exception)` のように全部を受ける腕はありません。
- `runCatching` で値にする代わりに、`Some(find(2)) escape { NotFound(_) -> None }` と書けます。
- `error()` や `check()` で落とすのに当たるのは `panic("...")` です。これは defect で、型に出ず、`escape` で受けられません。

## 依存の注入とエフェクト

コンストラクタで interface を受け取っていたものは、エフェクトとして宣言します。実装はハンドラで、呼ぶ側が `with` で供給します。

```kotlin
interface Clock { fun now(): Long }

class Greeter(private val clock: Clock) {
    fun greet(name: String) = "[${clock.now()}] Hello, $name"
}

val greeter = Greeter(FixedClock(0))
```

```emela check
effect Stamp {
  fn now() -> Int
}

handler FixedStamp implements Stamp {
  fn now() { 0 }
}

fn greet(name: String) -> String use Stamp {
  "[#{(use Stamp).now()}] Hello, #{name}"
}

fn main() {
  with FixedStamp {
    dbg(greet("alice"))                   # "[0] Hello, alice"
  }
}
```

- `greet` の型に `use Stamp` が出るので、何に依存しているかがシグネチャで分かります。
- 標準ライブラリには本物の `Clock`（`Std.Clock`）と、テスト用の `TestClock` があります。

## suspend と coroutine

Kotlin の `suspend fun` は、呼ぶ関数にも `suspend` を要求します。Emela では、中断しうるのはエフェクトの操作だけで、`suspend fn` はエフェクトの宣言に書きます。それを呼ぶ関数には印が付かず、呼び出しも普通の形のままです。

```kotlin
suspend fun fetchUser(id: Int): String {
    delay(100)
    return "user $id"
}

suspend fun loadBoth(): Pair<String, String> = coroutineScope {
    val a = async { fetchUser(1) }
    val b = async { fetchUser(2) }
    a.await() to b.await()
}

val late = withTimeoutOrNull(50) { fetchUser(3) }
```

```emela check
import Std.Clock.{Clock, SystemClock}
import Std.Fiber.{Fiber}

# Clock.sleep は suspend fn。fetch_user 自身には印がない
fn fetch_user(id: Int) -> String use Clock {
  (use Clock).sleep(100)
  "user #{id}"
}

fn load_both() -> (String, String) use { Clock, Async } {
  Fiber.scope(fn() {
    a = Fiber.fork(fn() { fetch_user(1) })
    b = Fiber.fork(fn() { fetch_user(2) })
    (Fiber.join(a), Fiber.join(b))
  })
}

fn main() {
  with SystemClock {
    dbg(load_both())                      # ("user 1", "user 2")
    dbg(Fiber.timeout(50, fn() { fetch_user(3) }))   # None
  }
}
```

- `coroutineScope` と同じく、`Fiber.scope` は子がすべて終わるまで抜けません。子が失敗すると兄弟を中断し、エラーをスコープの外へ伝えます。
- `GlobalScope.launch` に当たる、スコープの外で走り続ける fiber はありません。
- 中断されると、途中の `with` のハンドラの `release` が内側から順に走ります（`finally` と同じ向き）。
- fiber は1つのスレッドの上で協調的に切り替わります。`Dispatchers.Default` のような並列実行はありません。
- 2つの値をまとめて待つだけなら `Fiber.both(fn() { fetch_user(1) }, fn() { fetch_user(2) })` で足ります。

## 気をつけるところ

- `var` と再代入はありません。同じ名前で束縛し直すと、以降は新しい束縛が見えます。
- `for` と `while` はありません。`List.map`、`List.fold`、再帰で書きます。自分への末尾呼び出しはスタックを使いません。
- 文字列の連結に `+` は使えません。補間 `"#{a}#{b}"` を使います。
- 名前の書き方が決まっています。関数と変数は `snake_case`（`find_user`）、型は `PascalCase` です。
- 能力の値（`use Stamp` の値）は、引数に渡す、フィールドに入れる、返すのどれもできません。コンストラクタ注入の感覚で持ち回ろうとするとエラー（E0408〜E0410）になります。
- `interface` に当たる `trait` は 0.21 で入る予定です。環境で差し替えたい振る舞いは、Trait でなくエフェクトで書きます。
