---
title: Scala から
description: case class、enum、match、for 内包、given と Trait、ZIO と Cats Effect を Emela の言葉に置き換える
---

Scala 3 の case class と enum、後置の `match` は、Emela でもほぼ同じ形で書けます。ZIO を使ってきたなら、`ZIO[R, E, A]` の3つの型引数がそのまま Emela の関数の型（`-> A fails E use R`）になっている、と考えると早いです。違うのは、for 内包でつなぐ代わりに直接書くこと、高カインド型がないこと、`given` による依存の受け渡しをエフェクトで書くことです。

## 対応表

| Scala | Emela |
|---|---|
| `case class User(id: Int, name: String)` | `type User(id: Int, name: String)` |
| `user.copy(name = "bob")` | `User(name: "bob", ..user)` |
| `enum Shape { case Circle(r: Double) ... }` | `enum Shape { Circle(r: Float) ... }` |
| `x match { case ... => ... }` | `x match { ... -> ... }` |
| `Option`、`for` 内包 | `Option`、`Option.and_then` |
| `trait Show[A]` と `given` / `using` | `trait` と `impl`（0.21 で入る予定） |
| 依存を渡す `using` | `effect` と `use` |
| `ZIO[R, E, A]` | `-> A fails E use R` |
| `for { a <- f; b <- g(a) } yield ...` | `a = f()` と `b = g(a)` を並べる |
| `ZIO.fail(NotFound(id))` | `fail NotFound(id:)` |
| `catchSome` / `catchAll` / `mapError` | `escape { ... }` |
| `orDie` | `escape { X(_) -> panic(...) }` |
| `ZIO.service[Users]` | `use Users` |
| `ZLayer.succeed` | `handler` |
| `ZLayer.scoped` と `acquireRelease` / `Resource.make` | `init` と `release` を持つ `handler` |
| `ZLayer.make` / `provide` | `layer` と `with` |
| `zipPar` / `IO.both` | `Fiber.both` |
| `ZIO.foreachPar` / `parTraverse` | `Fiber.map` |
| `race` / `timeout`（Option を返す） | `Fiber.race` / `Fiber.timeout` |
| `.fork` と `.join` / `.start` と `.joinWithNever` | `Fiber.fork` と `Fiber.join`（`Fiber.scope` の中） |
| `Ref` | `State` |
| `F[_]` と tagless final | ない。エフェクトで抽象する |
| `s"Hello, $name"` | `"Hello, #{name}"` |

## case class と enum

```scala
case class User(id: Int, name: String)

enum Shape:
  case Circle(radius: Double)
  case Rect(width: Double, height: Double)

def area(shape: Shape): Double = shape match
  case Shape.Circle(r)  => math.Pi * r * r
  case Shape.Rect(w, h) => w * h
```

```emela check
type User(id: Int, name: String)

enum Shape {
  Circle(radius: Float)
  Rect(width: Float, height: Float)
}

fn area(shape: Shape) -> Float {
  shape match {
    Circle(r) -> 3.14159 * r * r
    Rect(width: w, height: h) -> w * h
  }
}

fn main() {
  user = User(id: 1, name: "alice")
  dbg(User(name: "bob", ..user))
  dbg(area(Rect(2.0, 3.0)))               # 6.0
}
```

- バリアントは修飾なしで書きます（`Shape.Circle` でなく `Circle`）。
- `match` は Scala と同じく後置です。腕は `->` で、`case` は書きません。
- バリアントは型ではないので、`Circle` 型の引数は書けません。
- 構成子を値として渡せます（`List.map(xs, Some)`）。

## for 内包と Option

Option をつなぐ for 内包は `Option.and_then` で書きます。

```scala
def email(id: Int): Option[String] =
  for
    user  <- findUser(id)
    email <- user.email
  yield email
```

```emela check
type User(id: Int, name: String, email: Option[String])

fn find_user(id: Int) -> Option[User] {
  if id == 1 { Some(User(id: 1, name: "alice", email: None)) } else { None }
}

fn email(id: Int) -> Option[String] {
  find_user(id) |> Option.and_then(fn(u) { u.email })
}

fn main() {
  dbg(email(1))                           # None
}
```

ZIO や Cats Effect の for 内包は要りません。エフェクトのある処理も普通の関数として上から順に書きます。

## ZIO の型と関数の型

```scala
case class NotFound(id: Int)

trait Users:
  def find(id: Int): IO[NotFound, User]

val greeting: ZIO[Users, NotFound, String] =
  for
    users <- ZIO.service[Users]
    user  <- users.find(1)
  yield s"Hello, ${user.name}"

val sample: ULayer[Users] = ZLayer.succeed(new Users {
  def find(id: Int) =
    if id == 1 then ZIO.succeed(User(1, "alice")) else ZIO.fail(NotFound(id))
})

val run = greeting.provide(sample)
```

```emela check
error NotFound(id: Int)

type User(id: Int, name: String)

effect Users {
  fn find(id: Int) -> User fails NotFound
}

handler SampleUsers implements Users {
  fn find(id) {
    if id == 1 { User(id: 1, name: "alice") } else { fail NotFound(id:) }
  }
}

fn greeting(id: Int) -> String fails NotFound use Users {
  user = (use Users).find(id)
  "Hello, #{user.name}"
}

fn main() {
  with SampleUsers {
    dbg(greeting(1))
  }
}
```

- `ZIO.service` に当たる `use Users` は、関数の中のどこにでも書けます。
- ZIO の E は任意の型ですが、Emela の E は `error` で宣言したタグの集合です。Scala 3 の union 型（`NotFound | DbError`）に近い形で、`fails NotFound | DbError` と書きます。
- R も集合で、順序に意味はありません（ZIO の `Users & Config` に当たります）。

## エラーの扱い

`catchSome` は E の型を変えませんが、`escape` は受けたタグを型からも消します。受けなかったタグはそのまま伝わります。

```scala
val safe: ZIO[Any, Unavailable, User] =
  loadUser(id).catchAll {
    case NotFound(_)   => ZIO.succeed(guest)
    case DbError(msg)  => ZIO.fail(Unavailable(msg))
  }
```

```emela check
error NotFound(id: Int)
error DbError(message: String)
error Unavailable(reason: String)

fn load_name(id: Int) -> String fails NotFound | DbError {
  if id < 0 { fail DbError(message: "timeout") }
  if id == 0 { fail NotFound(id:) } else { "alice" }
}

# 推論される型: fn(Int) -> String fails Unavailable
fn safe_name(id: Int) {
  load_name(id) escape {
    NotFound(_) -> "guest"
    DbError(message:) -> fail Unavailable(reason: message)
  }
}

fn main() {
  dbg(safe_name(0))
}
```

- `orDie` は `escape { DbError(message:) -> panic(message) }` です。ZIO の defect と同じく、Emela の defect も型に出ません。
- `ZIO.attempt` のように例外を取り込む道具はありません。ホストの関数が投げた例外は defect になります。

## ZLayer と Resource

`ZLayer.scoped` と `acquireRelease`（Cats Effect なら `Resource.make`）は、ハンドラの `init` と `release` で書きます。`init` の中の `use` が、そのハンドラの依存です。

```scala
val storeLive: ZLayer[Config, Nothing, Store] = ZLayer.scoped {
  for
    config <- ZIO.service[Config]
    prefix <- ZIO.acquireRelease(ZIO.succeed(config.prefix))(p =>
                Console.printLine(s"close $p").orDie)
  yield MemoryStore(prefix)
}

val app = program.provide(storeLive, configLive)
```

```emela check
import Std.Console.{Console, SystemConsole}

effect Config {
  fn prefix() -> String
}

effect Store {
  fn get(key: String) -> String
}

handler EnvConfig implements Config {
  fn prefix() { "v1" }
}

handler MemoryStore(prefix: String) implements Store {
  init { MemoryStore(prefix: (use Config).prefix()) }

  release { (use Console).print_line("close #{self.prefix}") }

  fn get(key) { "#{self.prefix}/#{key}" }
}

layer AppLive {
  MemoryStore
  EnvConfig
}

fn main() {
  with SystemConsole, AppLive {
    (use Console).print_line((use Store).get("alice"))
  }
}
```

- `ZLayer.make` と同じく、layer の並び順は意味を持ちません。コンパイラが依存から初期化の順を決め、`release` はその逆順に走ります。
- 同じエフェクトを2つのハンドラが供給する layer はエラー（E0421）です。
- テストで差し替えるときは `with AppLive, TestConfig { ... }` と後ろに並べます。

## fiber

ZIO の fiber は親の fiber に監督されますが、`forkDaemon` で切り離せます。Emela の fiber は必ず `Fiber.scope` の中で起動し、スコープより先に終わります。切り離す手段はありません。

```scala
val both    = fetch(1).zipPar(fetch(2))
val all     = ZIO.foreachPar(List(3, 4, 5))(fetch)
val fastest = fetch(6).race(fetch(7))
val late    = fetch(8).timeout(100.millis)   // Option[String]
```

```emela check
import Std.Clock.{Clock, SystemClock}
import Std.Fiber.{Fiber}

fn fetch(id: Int) -> String use Clock {
  (use Clock).sleep(10 * id)
  "user #{id}"
}

fn main() {
  with SystemClock {
    dbg(Fiber.both(fn() { fetch(1) }, fn() { fetch(2) }))
    dbg(Fiber.map([3, 4, 5], fn(id) { fetch(id) }))
    dbg(Fiber.race([fn() { fetch(6) }, fn() { fetch(7) }]))   # "user 6"
    dbg(Fiber.timeout(20, fn() { fetch(8) }))                 # None
  }
}
```

- 子が失敗すると兄弟が中断され、エラーはスコープの E に合流します。
- `exit` / `either` で終わり方を値にするのは `Fiber.attempt` です。
- fiber は1つのスレッドの上で協調的に切り替わります。並列の実行はありません。
- 詳しくは [並行性](/guide/concurrency/) を見てください。

## given と Trait

型クラスに当たるのは `trait` と `impl` です。`using` の引数でなく、型引数の制約 `[A: Show]` で受けます。

```scala
trait Describe[A]:
  def describe(a: A): String

given Describe[User] with
  def describe(u: User) = s"User(${u.name})"
```

```emela
trait Describe {
  fn describe(self) -> String
}

impl Describe for User {
  fn describe(self) { "User(#{self.name})" }
}

fn print_all[A: Describe](xs: List[A]) -> List[String] {
  List.map(xs, Describe.describe)
}
```

:::caution[0.21 で入る予定]
`trait`、`impl`、`derive` と制約の検査は 0.21 で入ります。0.20 では `==` と文字列補間が、型の構造をそのまま見て全部の型で動きます。
:::

- impl は1つの型と1つの Trait の組にプログラム全体で1つだけです。スコープで切り替える `given` はありません。
- 環境によって変わる振る舞い（`using ExecutionContext` のようなもの）は、Trait でなくエフェクトで書きます。
- 暗黙の変換はありません。

## 気をつけるところ

- 高カインド型はありません。`F[_]` で抽象した tagless final の書き方は、エフェクトとハンドラの差し替えに置き換えます。
- `var`、`while`、`for` ループはありません。`List.map`、`List.fold`、再帰で書きます。自分への末尾呼び出しはスタックを使いません。
- 部分型と継承はありません。`enum` の直和と、エフェクトによる差し替えで書きます。
- 能力の値（`use Users` の値）は、引数に渡す、データに入れる、返すのどれもできません。ZIO のようにサービスを値として持ち回れないので、使わせたいときはクロージャを渡します。
- 中置の演算子は定義できません。`a.combine(b)` に当たるものは `Money.add(a, b)` のような関数です。
- `escape` の腕に `_` は書けません。受けるエラーを名前で並べます。
