---
title: TypeScript と Effect-TS から
description: Effect<A, E, R>、Effect.gen、Context.Tag と Layer、catchTag、Fiber と Scope を Emela の言葉に置き換える
---

Emela は、Effect-TS で書くときの型の形（成功の値、エラー、要求するサービス）を、言語の関数の型にしたものです。`Effect.gen` と `yield*` で包んでいた処理を、Emela では普通の関数として直接書きます。素の TypeScript から来た人向けの対応は、ページの後半にあります。

## 対応表

| Effect-TS | Emela |
|---|---|
| `Effect<A, E, R>` | 関数の型 `-> A fails E use R` |
| `Effect.gen(function* () { ... })` と `yield*` | 普通の関数の本体。印は付けない |
| `Effect.succeed(x)` | `x` |
| `Effect.fail(new NotFound({ id }))` | `fail NotFound(id:)` |
| `Data.TaggedError("NotFound")<{ id: number }>` | `error NotFound(id: Int)` |
| `Effect.catchTag("NotFound", f)` / `catchTags` | `escape { NotFound(_) -> ... }` |
| `Effect.mapError` | `escape { A(..) -> fail B(..) }` |
| `Effect.die` / `Effect.orDie` | `panic(...)` / `escape { A(_) -> panic(...) }` |
| `Context.Tag` のサービス | `effect` |
| `yield* Users` | `use Users` |
| `Layer.succeed(Tag, impl)` | `handler` |
| `Layer.effect` / `Layer.scoped` と `acquireRelease` | `init` と `release` を持つ `handler` |
| `Layer.mergeAll(...)` と `Layer.provide` | `layer`（依存の順はコンパイラが決める） |
| `Effect.provide(program, layer)` | `with AppLive { ... }` |
| `Effect.runPromise(main)` | `fn main()` と `emela run` |
| `Effect.fork` と `Fiber.join` | `Fiber.fork` と `Fiber.join`（`Fiber.scope` の中だけ） |
| `Effect.all(xs, { concurrency: "unbounded" })` | `Fiber.all` / `Fiber.map` / `Fiber.both` |
| `Effect.race` / `Effect.timeoutOption` | `Fiber.race` / `Fiber.timeout` |
| `Effect.exit` / `Exit` / `Cause` | `Fiber.attempt` / `Exit` / `Cause` |
| `Ref` | `State` のエフェクト |
| `Option.Option<A>` | `Option[A]` |
| `pipe(x, f, g)` | `x \|> f \|> g` |

## Effect の型と関数の型

Effect-TS では、計算を `Effect` の値として組み立て、型引数に E と R を載せます。

```ts
import { Context, Data, Effect } from "effect"

class NotFound extends Data.TaggedError("NotFound")<{ readonly id: number }> {}

interface User {
  readonly id: number
  readonly name: string
}

class Users extends Context.Tag("Users")<
  Users,
  { readonly find: (id: number) => Effect.Effect<User, NotFound> }
>() {}

const greeting = (id: number): Effect.Effect<string, NotFound, Users> =>
  Effect.gen(function* () {
    const users = yield* Users
    const user = yield* users.find(id)
    return `Hello, ${user.name}!`
  })
```

Emela では、関数を呼べばその場で実行されます。E は `fails`、R は `use` として関数の型に載ります。

```emela check
error NotFound(id: Int)

type User(id: Int, name: String)

effect Users {
  fn find(id: Int) -> User fails NotFound
}

fn greeting(id: Int) -> String fails NotFound use Users {
  users = use Users
  user = users.find(id)
  "Hello, #{user.name}!"
}
```

- `yield*` に当たる印はありません。`users.find(id)` が失敗すれば、そのまま `greeting` の呼び出し元へ伝わります。
- `fails` と `use` を省くと推論されます。公開する関数で書いておくと、そのとおりであることをコンパイラが確かめます。
- `Effect` は遅延した値ですが、Emela の呼び出しは値を作りません。「後で実行するもの」を渡したいときは `fn() { ... }` で包みます。

## サービスと Layer

`Layer.succeed` で作っていた実装は `handler`、`Effect.provide` は `with` です。

```ts
const SampleUsers = Layer.succeed(Users, {
  find: (id) =>
    id === 1
      ? Effect.succeed({ id: 1, name: "alice" })
      : Effect.fail(new NotFound({ id })),
})

const main = greeting(1).pipe(Effect.provide(SampleUsers))
Effect.runPromise(main).then(console.log)
```

```emela check
import Std.Console.{Console, SystemConsole}

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
  "Hello, #{user.name}!"
}

fn main() {
  with SystemConsole, SampleUsers {
    (use Console).print_line(greeting(1))
  }
}
```

- ハンドラの操作の引数と戻り値の型は、エフェクトの宣言から決まるので書きません。
- ハンドラは、エフェクトで宣言した `fails` を超えて失敗できません。実装を差し替えても、呼ぶ側の E は変わりません。
- `with` の外へは、そのハンドラを捕まえた値を持ち出せません。
- コンソールへの出力も `Console` というエフェクトです。`console.log` のように直接は呼べません。

## catchTag と escape

`Effect.catchTag` で受けたタグが E から消えるのと同じく、`escape` で受けたタグは E から消えます。受けなかったタグはそのまま伝わります。

```ts
const safe = loadUser(id).pipe(
  Effect.catchTags({
    NotFound: () => Effect.succeed(guest),
    DbError: (e) => Effect.fail(new Unavailable({ reason: e.message })),
  }),
)
```

```emela check
error NotFound(id: Int)
error DbError(message: String)
error Unavailable(reason: String)

type User(id: Int, name: String)

fn load_user(id: Int) -> User fails NotFound | DbError {
  if id < 0 { fail DbError(message: "connection lost") }
  if id == 0 { fail NotFound(id:) }
  User(id:, name: "alice")
}

# 推論される型: fn(Int) -> User fails Unavailable
fn safe_user(id: Int) {
  load_user(id) escape {
    NotFound(_) -> User(id: 0, name: "guest")
    DbError(message:) -> fail Unavailable(reason: message)
  }
}

fn main() {
  dbg(safe_user(0) escape { Unavailable(_) -> User(id: -1, name: "none") })
}
```

- `escape` の腕にはエラーの構成子だけを書けます。`_` で全部を受ける書き方（`catchAll`）はありません。受けたいタグを並べます。
- `Effect.either` や `Effect.option` のように値へ変えるときは、`Some(load_user(id)) escape { NotFound(_) -> None }` と書きます。
- `orDie` は `escape { DbError(message:) -> panic(message) }` です。defect は型に出ず、`escape` では受けられません。

## Layer の依存とリソース

`Layer.scoped` と `Effect.acquireRelease` で書いていた「設定を読んで接続を開き、終わったら閉じる」は、ハンドラの `init` と `release` で書きます。

```ts
const StoreLive = Layer.scoped(
  Store,
  Effect.gen(function* () {
    const config = yield* Config
    const prefix = yield* Effect.acquireRelease(
      Effect.sync(() => { console.log("open"); return config.prefix }),
      () => Effect.sync(() => console.log("close")),
    )
    return { get: (key) => Effect.succeed(`${prefix}/${key}`) }
  }),
)

const AppLive = StoreLive.pipe(Layer.provide(ConfigLive))
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
  init {
    prefix = (use Config).prefix()
    (use Console).print_line("open #{prefix}")
    MemoryStore(prefix:)
  }

  release {
    (use Console).print_line("close #{self.prefix}")
  }

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

```console
open v1
v1/alice
close v1
```

- `init` の中の `use` がハンドラの依存です。`Layer.provide` で組み立てる代わりに、layer にハンドラを並べればコンパイラが依存から初期化の順を決めます。
- `release` は、正常終了、エラー、defect、中断のどれで `with` を抜けても1回走ります。
- テストで一部を差し替えるときは `with AppLive, TestConfig { ... }` と後ろに並べます。同じエフェクトは後ろが優先です。

## Fiber と Scope

Effect-TS の `Effect.fork` は、子を親の fiber に結びつけます。Emela では、子を起動できる場所を `Fiber.scope` に限り、スコープを抜けるまでに子が必ず終わります。

```ts
const program = Effect.gen(function* () {
  const a = yield* Effect.fork(fetchUser(1))
  const b = yield* Effect.fork(fetchUser(2))
  return [yield* Fiber.join(a), yield* Fiber.join(b)]
})

const both = Effect.all([fetchUser(1), fetchUser(2)], { concurrency: "unbounded" })
const fast = Effect.timeoutOption(fetchUser(3), "100 millis")
```

```emela check
import Std.Console.{Console, SystemConsole}
import Std.Clock.{Clock, SystemClock}
import Std.Fiber.{Fiber}

fn fetch_user(id: Int, ms: Int) -> String use Clock {
  (use Clock).sleep(ms)
  "user #{id}"
}

fn main() {
  with SystemConsole, SystemClock {
    console = use Console
    pair = Fiber.scope(fn() {
      a = Fiber.fork(fn() { fetch_user(1, 50) })
      b = Fiber.fork(fn() { fetch_user(2, 10) })
      (Fiber.join(a), Fiber.join(b))
    })
    console.print_line("#{pair}")

    (x, y) = Fiber.both(fn() { fetch_user(1, 50) }, fn() { fetch_user(2, 10) })
    console.print_line("#{x}, #{y}")

    fast = Fiber.timeout(100, fn() { fetch_user(3, 1000) })
    console.print_line("#{fast}")
  }
}
```

```console
("user 1", "user 2")
user 1, user 2
None
```

- `Effect.forkDaemon` に当たる、親より長生きする fiber はありません。常駐する処理は `main` の直下のスコープで fork します。
- 子が失敗すると兄弟が中断され、エラーはスコープの外へ伝わります。子のエラーは `Fiber.scope` の E に合流します。
- `Fiber.timeout` は間に合わなければ `None` を返します（`timeoutOption` と同じ）。失敗にしたいときは `Option.or_fail` を挟みます。
- `Effect.exit` に当たるのは `Fiber.attempt` で、Fail と Die（defect）を `Exit` の値に変えます。
- 詳しくは [並行性](/guide/concurrency/) を見てください。

## Ref と State

`Ref` で持っていた可変な状態は、`State` のエフェクトで表します。状態の置き場所は `State.run` の枠で、外からは純粋な関数に見えます。

```ts
const program = Effect.gen(function* () {
  const ref = yield* Ref.make(10)
  yield* Ref.update(ref, (n) => n + 1)
  return yield* Ref.get(ref)
})
```

```emela check
import Std.State.{State}

fn tick() -> Int use State[Int] {
  st = use State[Int]
  st.update(fn(n) { n + 1 })
  st.get()
}

fn main() {
  (value, last) = State.run(10, fn() { tick() })
  dbg((value, last))   # (11, 11)
}
```

## テスト

Effect-TS でテスト用の Layer を供給するのと同じく、テストではハンドラを差し替えます。標準ライブラリには `TestConsole` や `TestClock` があり、状態は `State` に置きます。

```emela check
import Std.Console.{Console, TestConsole}
import Std.State.{State}

fn greet(name: String) -> () use Console {
  (use Console).print_line("Hello, #{name}!")
}

@test
fn greets() {
  (_, lines) = State.run([], fn() { with TestConsole { greet("alice") } })
  assert lines == ["Hello, alice!"]
}
```

## 素の TypeScript から

| TypeScript | Emela |
|---|---|
| `type Shape = { kind: "circle"; r: number } \| ...` と `switch` | `enum Shape { Circle(r: Float) ... }` と `match` |
| `interface` / 構造的な型 | `type`（名前で区別する） |
| `null` / `undefined`、`?.`、`??` | `Option[A]`、`Option.map`、`Option.or` |
| `throw` / `try` / `catch` | `fail` / `escape`。エラーは型に出る |
| `async` / `await` / `Promise` | 印なしの呼び出しと `Fiber` |
| `class` とメソッド | `type` とモジュールの関数、`\|>` |
| `let` と再代入 | 同じ名前での束縛し直し |
| `for` / `forEach` | `List.map` / `List.fold` / 再帰 |
| `` `Hello, ${name}` `` | `"Hello, #{name}"` |

```ts
type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "rect"; width: number; height: number }

function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle": return Math.PI * shape.radius ** 2
    case "rect": return shape.width * shape.height
  }
}
```

```emela check
enum Shape {
  Circle(radius: Float)
  Rect(width: Float, height: Float)
}

fn area(shape: Shape) -> Float {
  shape match {
    Circle(radius:) -> 3.14159 * radius * radius
    Rect(width:, height:) -> width * height
  }
}

fn main() {
  dbg(area(Rect(width: 2.0, height: 3.0)))   # 6.0
}
```

`async` を付けた関数は呼び出し側にも `await` を強いますが、Emela では中断しうる操作（`Clock.sleep` や `Http.send`）も普通の呼び出しと同じ形で書きます。中断するかどうかの印は、エフェクトの操作の宣言（`suspend fn`）にだけ付きます。

## 気をつけるところ

- 呼び出しは値を作らず、その場で実行されます。`Effect` を変数に入れて何度も走らせる書き方は、`fn() { ... }` を渡す形にします。
- `use Users` で取り出した能力の値は、引数に渡す、返す、データに入れるのどれもできません。Effect-TS のようにサービスの実装を値として持ち回れません。使わせたいときはクロージャを渡します。
- `escape` に `_` の腕は書けません（E0320）。受けるエラーを名前で並べます。
- エラーの値の型は1つのエラーの型だけです。「NotFound か DbError」という値は作れません。
- `main` は Async を除いて R が空でなければなりません。足りないエフェクトは E0402 で知らされます。
- 文字列は `+` でつなげません。補間か `String.append` を使います。
- エラーと defect は分かれています。`panic` やゼロ除算は型に出ず、`Fiber.attempt` やテストランナーのような境界でだけ観測できます。
