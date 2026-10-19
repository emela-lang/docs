---
title: 他の言語との対応
description: TypeScript、Rust、Go、Kotlin / Java、Python の書き方が Emela で何に当たるかと、他の言語の感覚で書くと引っかかるところ
---

よく使う言語の書き方が Emela で何に当たるかを並べます。言語の全体を順に知りたいときは [言語ツアー](/start/tour/) から読んでください。

## どの言語にも共通する対応

| ほかの言語 | Emela |
|---|---|
| null / nil / None | `Option[A]`（`Some(x)` と `None`） |
| throw / try / catch、Result 型と `?` | `error` を宣言して `fail`、受けるのは `escape` |
| for / while | `List.map`、`List.fold`、再帰 |
| 再代入する変数 | 同じ名前での束縛し直し、可変な状態は `State` |
| クラスとメソッド `x.f()` | `type` とモジュールの関数、`x \|> f` |
| interface で依存を渡す、DI、モック | `effect`、`handler`、`with` |
| リソースの後始末（defer、try-with-resources、Drop） | ハンドラの `init` と `release` |
| async / await | 印なしの呼び出しと `Fiber` |
| 文字列補間 | `"Hello, #{name}"` |
| 型クラス / interface | `trait` と `impl`（0.21 で入る予定） |

## TypeScript

| TypeScript | Emela |
|---|---|
| `type Shape = { kind: "circle"; r: number } \| ...` と `switch` | `enum Shape { Circle(r: Float) ... }` と `match` |
| `interface` / 構造的な型 | `type`（名前で区別する） |
| `null` / `undefined`、`?.`、`??` | `Option[A]`、`Option.map`、`Option.or` |
| `throw` / `try` / `catch` | `fail` / `escape`。エラーは型に出る |
| `async` / `await` / `Promise` | 印なしの呼び出しと `Fiber` |
| `let` と再代入 | 同じ名前での束縛し直し |
| `` `Hello, ${name}` `` | `"Hello, #{name}"` |

## Rust

| Rust | Emela |
|---|---|
| `struct User { id: i32, name: String }` | `type User(id: Int, name: String)` |
| `User { name, ..user }` | `User(name:, ..user)` |
| `enum Shape { Circle { r: f64 }, Rect(f64, f64) }` | `enum Shape { Circle(r: Float), Rect(Float, Float) }` |
| `match x { A => .., _ => .. }` | `x match { A -> .. }` |
| `i32` / `i64` / `f64` / `bool` | `Int` / `Int64` / `Float` / `Bool` |
| `Result<T, E>` と `?` | `-> T fails E`。`?` は書かなくても伝わる |
| `opt.ok_or(NotFound(id))?` | `Option.or_fail(opt, NotFound(id:))` |
| `panic!`、`todo!()` | `panic(..)`、`todo()` |
| `Drop` | ハンドラの `release` |
| `tokio::join!` / `select!` / `timeout` | `Fiber.both` / `Fiber.race` / `Fiber.timeout` |
| `dbg!(x)` | `dbg(x)` |

所有権、借用、ライフタイムはありません。値はすべて不変です。

## Go

| Go | Emela |
|---|---|
| `type User struct { ID int; Name string }` | `type User(id: Int, name: String)` |
| `func (u User) Greet() string` | `fn greet(u: User) -> String` と `u \|> greet` |
| `(T, error)` を返す | `-> T fails E` |
| `if err != nil { return err }` | 何も書かない（自動で伝わる） |
| `errors.As` / `errors.Is` | `escape { NotFound(..) -> ... }` |
| `fmt.Errorf("...: %w", err)` | `escape { A(..) -> fail B(..) }` |
| `defer conn.Close()` | ハンドラの `release` |
| `go f()` | `Fiber.fork(fn() { f() })`（`Fiber.scope` の中だけ） |
| `errgroup.Group` | `Fiber.scope`、`Fiber.all`、`Fiber.map` |
| `context.WithTimeout` | `Fiber.timeout` |
| `select` で最初の1つ | `Fiber.race` |
| チャネル | 一度だけの受け渡しは `Deferred`。キューは予定 |

goroutine と違い、fiber はスコープより長生きしません。キャンセルのために `ctx` を引数で回す必要もなく、`Fiber.interrupt` で止めるか、スコープの本体が値を返した時点で残っている fiber が中断されます。

## Kotlin / Java

| Kotlin / Java | Emela |
|---|---|
| `data class` / `record` | `type User(id: Int, name: String)` |
| `user.copy(name = "bob")` | `User(name: "bob", ..user)` |
| `sealed interface` と実装 | `enum` とバリアント |
| `when (x) { is A -> ... }` / `switch` のパターン | `x match { A(..) -> ... }` |
| `User?`、`?.`、`?:`、`Optional` | `Option[User]`、`Option.map`、`Option.or` |
| 検査例外 `throws NotFoundException` | `fails NotFound` |
| `RuntimeException` | defect（`panic`） |
| 拡張関数 / static ユーティリティ | モジュールの関数と `\|>` |
| コンストラクタ注入、Mockito | `effect` / `handler` / `with`、テスト用のハンドラ |
| `coroutineScope` / `StructuredTaskScope` | `Fiber.scope` |
| `async` と `await()` | `Fiber.fork` と `Fiber.join` |
| `withTimeoutOrNull` | `Fiber.timeout` |
| `@Test` と `assertEquals` | `@test` と `assert` |

オーバーロードはありません。引数の数や型が違う関数には別の名前を付けます。

## Python

| Python | Emela |
|---|---|
| `@dataclass(frozen=True) class User` | `type User(id: Int, name: String)` |
| `replace(user, name="bob")` | `User(name: "bob", ..user)` |
| `match` / `case` | 後置の `x match { ... }` |
| `None` / `Optional[T]` | `Option[T]` の `None` |
| `raise NotFound(id)` | `fail NotFound(id:)` |
| `try` / `except NotFound` | `escape { NotFound(_) -> ... }` |
| `for x in xs` / 内包表記 | `List.map`、`List.filter`、`List.fold` |
| `x += 1` | `x = x + 1`（束縛し直し） |
| `mock.patch` | ハンドラの差し替え |
| `asyncio.gather` / `TaskGroup` / `wait_for` | `Fiber.all` / `Fiber.scope` / `Fiber.timeout` |
| `print(x)` | `(use Console).print_line(...)`、デバッグなら `dbg(x)` |
| インデント | `{ }` |

型は静的に決まり、ほとんどは推論されます。`dict` と `set` に当たる `Map` と `Set` は 0.21 で入る予定です。

## 引っかかりやすいところ

```emela check
type User(id: Int, name: String)

fn greet(user: User) -> String {
  "Hello, #{user.name}!"
}

fn main() {
  count = 0
  count = count + 1 # 再代入でなく、同じ名前で束縛し直す
  sum = List.range(1, 11) |> List.fold(0, fn(acc, n) { acc + n })
  first = List.get([10, 20, 30], 0)
  user = User(id: 1, name: "alice")
  dbg(user |> greet)
  dbg("#{count} #{sum}")
  dbg(first)
}
```

```console
$ emela run main.emel
"Hello, alice!"
"1 55"
Some(10)
```

ループ構文がないので、繰り返しは `List.fold` のような関数か再帰で書きます。自分への末尾呼び出しはスタックを使いません。添字アクセス `xs[0]` もなく、`List.get` が `Option` を返します。

メソッド呼び出しの構文もありません。`.` で書けるのはフィールドの参照と、能力の値の操作（`(use Users).find(1)`）だけです。

`use X` は import とは別物で、エフェクト `X` の能力の値を取り出す式です。能力の値は、引数に渡す、データに入れる、返すのどれもできません。サービスを値として持ち回る書き方はできないので、使わせたいときはクロージャを渡します。`main` に残ってよいエフェクトはなく、使うものは `main` の中の `with` で全部供給します。標準のハンドラは `Std.Platform` の `Platform` にまとまっています。

文字列は `+` でつなげず、補間 `"#{a}#{b}"` を使います。数の型の間に暗黙の変換はなく、`Int` は32ビットです。`Float.from_int` や `Int64.from_int` で明示して変換します。

ほかに次の2つもよく引っかかります。

- `escape` に `_` の腕は書けません。受けるエラーを名前で並べます。
- 名前の大文字と小文字に意味があります。変数と関数は `snake_case`、型・構成子・エフェクト・モジュールは `PascalCase` で、`HTTP` は型名に使えず `Http` と書きます。
