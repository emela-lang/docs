---
title: Gleam から
description: 構文の近い Gleam との違い。後置の match、型の書き方、use の意味、Result のないエラー、エフェクト
---

Emela の構文は Gleam にかなり近く、`|>`、カスタム型、引数名つきの呼び出し、`fn(x) { ... }`、リストのパターンはほとんどそのまま読めます。違いが大きいのは3つです。`match` が後置であること、`use` がまったく別の意味であること、エラーを `Result` でなく型に出る失敗で扱うことです。

## 対応表

| Gleam | Emela |
|---|---|
| `case x { ... }` | `x match { ... }` |
| `case a, b { 0, 0 -> ... }` | `(a, b) match { (0, 0) -> ... }` |
| `let x = 1` | `x = 1` |
| `List(a)`、`Result(a, e)` | `List[A]`。Result はない |
| `pub type User { User(id: Int) }` | `pub type User(id: Int)` |
| `pub type Shape { Circle(..) Rect(..) }` | `pub enum Shape { Circle(..) Rect(..) }` |
| `User(..user, name: "b")` | `User(name: "b", ..user)` |
| `#(1, "a")`、`pair.0` | `(1, "a")`、パターンで取り出す |
| `Nil` | `()` |
| `fn f(host host: String)` | `fn f(host: String)`（仮引数名がそのまま引数名） |
| `add(1, _)` | `fn(x) { add(1, x) }` |
| `"a" <> b` | `"a#{b}"` |
| `1.0 +. 2.0` | `1.0 + 2.0`（両辺は同じ型） |
| `const max_size = 3` | `const MAX_SIZE = 3` |
| `use x <- result.try(f())` | `x = f()` |
| `Error(NotFound(id))` | `fail NotFound(id:)` |
| `result.map_error` / `result.unwrap` | `escape { ... }` |
| `option.Option(a)` | `Option[A]`（Prelude にある） |
| `io.println("hi")` | `(use Console).print_line("hi")` |
| `echo x` | `dbg(x)` |
| `todo`、`panic as "msg"` | `todo()`、`panic("msg")` |
| `import gleam/list`、`list.map` | import なしで `List.map` |
| `@external(erlang, "m", "f")` | `@external(js, "./m.mjs", "f")` |

## 型の宣言

Gleam ではレコードも直和も `type` で書きます。Emela では構成子が1つの型を `type`、複数のものを `enum` と書き分けます。

```gleam
pub type User {
  User(id: Int, name: String)
}

pub type Shape {
  Circle(radius: Float)
  Rect(width: Float, height: Float)
}
```

```emela check
pub type User(id: Int, name: String)

pub enum Shape {
  Circle(radius: Float)
  Rect(width: Float, height: Float)
}

fn main() {
  user = User(id: 1, name: "alice")
  renamed = User(name: "bob", ..user)
  dbg(renamed.name)                       # "bob"
  dbg([Circle(1.0), Rect(width: 2.0, height: 3.0)])
}
```

- 型引数は `[A]` で書きます（`List[Int]`、`Option[User]`）。小文字の型変数は書けません。
- 更新の `..user` は末尾に書きます。
- フィールドを参照できるのは `type` の値だけで、`enum` の値はバリアントが1つでも `match` で取り出します。

## case と後置の match

`case x { ... }` は `x match { ... }` になります。パイプの結果をそのまま分けられます。

```gleam
pub fn area(shape: Shape) -> Float {
  case shape {
    Circle(radius:) -> 3.14 *. radius *. radius
    Rect(width:, height:) -> width *. height
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
    Circle(radius:) if radius > 0.0 -> 3.14 * radius * radius
    Circle(_) -> 0.0
    Rect(width:, height:) -> width * height
  }
}

fn label(n: Int) -> String {
  (n % 3, n % 5) match {
    (0, 0) -> "FizzBuzz"
    (0, _) -> "Fizz"
    (_, 0) -> "Buzz"
    _ -> Int.to_string(n)
  }
}

fn main() {
  dbg(area(Circle(1.0)))
  List.range(1, 16) |> List.map(label) |> String.join(" ") |> dbg
}
```

- 前置の `match x { ... }` はエラー（E0142）です。
- 複数の値で分けるときはタプルにします。
- 文字列の接頭辞のパターン（`"key=" <> rest`）はありません。`String.starts_with` とガードで書きます。

## 引数名

Gleam は外向きのラベルと中の名前を別に書きますが、Emela では仮引数名がそのまま引数名になります。どの引数も名前で渡せます。

```gleam
pub fn connect(host host: String, port port: Int) -> String {
  host <> ":" <> int.to_string(port)
}

connect(host: "localhost", port: 5432)
```

```emela check
fn connect(host: String, port: Int) -> String {
  "#{host}:#{port}"
}

fn main() {
  dbg(connect("localhost", 5432))
  dbg(connect("localhost", port: 5432))
  dbg(connect(host: "localhost", port: 5432))
  port = 8080
  dbg(connect("example.com", port:))      # port: port の省略
}
```

- 仮引数名は公開 API の一部で、変えると呼び出し側が壊れます。
- 関数の値（ラムダや変数に入れた関数）は名前で呼べず、位置引数だけです。

## エラーと use

Gleam ではエラーを `Result` で返し、`use <- result.try` で早く抜けます。Emela には Result がありません。`fail` した失敗は何も書かなければ呼び出し元へ伝わり、起こしうるエラーは関数の型（`fails`）に出ます。

```gleam
pub type LoadError {
  NotFound(id: Int)
  Invalid(reason: String)
}

pub fn load(id: Int) -> Result(String, LoadError) {
  use user <- result.try(find(id))
  use name <- result.try(validate(user))
  Ok("Hello, " <> name)
}

pub fn load_or_guest(id: Int) -> String {
  case load(id) {
    Ok(text) -> text
    Error(NotFound(_)) -> "Hello, guest"
    Error(Invalid(reason)) -> reason
  }
}
```

```emela check
error NotFound(id: Int)
error Invalid(reason: String)

fn find(id: Int) -> String fails NotFound {
  if id == 1 { "alice" } else { fail NotFound(id:) }
}

fn validate(name: String) -> String fails Invalid {
  if name == "" { fail Invalid(reason: "empty name") } else { name }
}

fn load(id: Int) -> String fails NotFound | Invalid {
  user = find(id)
  name = validate(user)
  "Hello, #{name}"
}

fn load_or_guest(id: Int) -> String {
  load(id) escape {
    NotFound(_) -> "Hello, guest"
    Invalid(reason:) -> reason
  }
}

fn main() {
  dbg(load_or_guest(1))
  dbg(load_or_guest(2))
}
```

- エラーは1つずつ `error` で宣言します。まとめた enum を作らず、関数の E がタグの集合になります。
- `escape` で受けたタグは E から消え、受けなかったタグはそのまま伝わります。
- `Result` を値として持ちたい場面は、`Some(load(id)) escape { NotFound(_) -> None }` のように Option へ変えます。

Emela の `use` は、Gleam の `use` とは無関係です。`use X` は、エフェクト X の能力の値を取り出す式です。コールバックを平らにする構文はありません。

## 副作用とエフェクト

Gleam では `io.println` をどこからでも呼べますが、Emela の副作用はエフェクトを通してしか起こせません。使ったエフェクトは関数の R に載り、`main` で `with` を使って供給します。

```gleam
import gleam/io

pub fn greet(name: String) -> Nil {
  io.println("Hello, " <> name <> "!")
}
```

```emela check
import Std.Console.{Console, SystemConsole}

# 推論される型: fn(String) -> () use Console
fn greet(name: String) {
  (use Console).print_line("Hello, #{name}!")
}

fn main() {
  with SystemConsole { greet("alice") }
}
```

テストでは `SystemConsole` の代わりに `TestConsole` を供給すれば、出力をリストとして受け取れます。詳しくは [エフェクト](/guide/effects/) と [テスト](/guide/testing/) を見てください。

## モジュールと公開

1つのファイルが1つのモジュールなのは同じですが、名前の付け方と参照の仕方が違います。

| | Gleam | Emela |
|---|---|---|
| `src/http/client.*` のモジュール名 | `http/client` | `Http.Client` |
| import | `import http/client` | `import Http.Client` |
| 呼び出し | `client.get(url)` | `Client.get(url)` |
| 名前の取り込み | `import http/client.{get}` | `import Http.Client.{get}` |
| 標準のモジュール | `import gleam/list` が要る | `List`、`String`、`Option` などは import なし |

```emela check
# src/email.emel
pub opaque type Email(value: String)

pub error InvalidEmail(input: String)

pub fn parse(input: String) -> Email fails InvalidEmail {
  if String.contains(input, "@") { Email(value: input) } else { fail InvalidEmail(input:) }
}
```

- `pub` と `pub opaque` の意味は Gleam と同じです。opaque な型は、定義したモジュールの外では作れず、`match` もフィールドの参照もできません。
- `import Email` だけでは型 `Email` を修飾なしで書けません。`Email.Email` と書くか、`import Email.{Email}` で取り込みます。
- 別名の import（`as`）はまだありません。
- 詳しくは [モジュール](/guide/modules/) を見てください。

## 並行性

Gleam は BEAM のプロセスと OTP を使いますが、Emela の並行の単位は1つのスレッドの上で切り替わる fiber です。fiber は `Fiber.scope` の中でだけ起動でき、スコープより先に必ず終わります。メッセージを送り合う代わりに、`Fiber.join` で値を受け取るか、`Fiber.both` や `Fiber.map` のような組み合わせ関数を使います。詳しくは [並行性](/guide/concurrency/) を見てください。

## 気をつけるところ

- `let` はありません。`x = 1` と書き、同じ名前で束縛し直せます。
- 型名は大文字と小文字で区別が決まります。`HTTP` は型名に使えず `Http` と書きます。
- 関数の部分適用（`f(1, _)`）はありません。無名関数で書きます。
- 文字列は `<>` でなく補間（`"#{a}#{b}"`）か `String.append` でつなぎます。
- `Float` の演算子は Int と同じ `+ - * /` です。両辺は同じ型でなければならず、暗黙の変換はありません。
- ターゲットは JavaScript と C です（Erlang はありません）。WebAssembly は予定です。
- `trait` と `derive` は 0.21 で入る予定です。0.20 では `==` と補間が全部の型で動きます。
