---
title: Rust から
description: struct と enum、match、Result と ?、trait、所有権がないこと、async と Emela の対応
---

Rust の `enum` と `match`、式としてのブロック、`Option` は、Emela でもほぼ同じ感覚で書けます。違うのは、所有権と借用がないこと（値は不変で、メモリはランタイムが管理します）、`Result` と `?` の代わりに型に出る失敗が自動で伝わること、`async` / `.await` の印がないことです。

## 対応表

| Rust | Emela |
|---|---|
| `struct User { id: i32, name: String }` | `type User(id: Int, name: String)` |
| `User { name, ..user }` | `User(name:, ..user)` |
| `enum Shape { Circle { r: f64 }, Rect(f64, f64) }` | `enum Shape { Circle(r: Float), Rect(Float, Float) }` |
| `match x { A => .., _ => .. }` | `x match { A -> .. }`（腕は改行で区切る） |
| `i32` / `i64` / `f64` / `bool` / `String` | `Int` / `Int64` / `Float` / `Bool` / `String` |
| `()` | `()` |
| `!` | `Never` |
| `Option<T>` | `Option[T]` |
| `Result<T, E>` | `-> T fails E` |
| `Err(e)?` / `return Err(e)` | `fail e` |
| `?` | 何も書かない（自動で伝わる） |
| `match r { Err(..) => .. }` / `map_err` | `escape { ... }` |
| `opt.ok_or(NotFound(id))?` | `Option.or_fail(opt, NotFound(id:))` |
| `panic!`、`unwrap()`、`todo!()` | `panic(..)`、`match` と `panic`、`todo()` |
| `trait` と `impl` | `trait` と `impl`（0.21 で入る予定） |
| `&impl Trait` / `dyn Trait` で依存を渡す | `effect` と `use` |
| `Drop` | ハンドラの `release` |
| `let mut` | 同じ名前での束縛し直し、`State` |
| `for` / `while` / `loop` | `List.map` / `List.fold` / 再帰 |
| `async fn` と `.await` | 印なしの関数 |
| `tokio::join!` / `select!` / `timeout` | `Fiber.both` / `Fiber.race` / `Fiber.timeout` |
| `format!("{name}")` | `"#{name}"` |
| `dbg!(x)` | `dbg(x)` |
| `mod` とファイル | ファイルのパスから決まるモジュール |

## struct と enum

```rust
struct User {
    id: i32,
    name: String,
}

enum Shape {
    Circle { radius: f64 },
    Rect(f64, f64),
    Empty,
}

fn area(shape: &Shape) -> f64 {
    match shape {
        Shape::Circle { radius } => std::f64::consts::PI * radius * radius,
        Shape::Rect(w, h) => w * h,
        Shape::Empty => 0.0,
    }
}
```

```emela check
type User(id: Int, name: String)

enum Shape {
  Circle(radius: Float)
  Rect(Float, Float)
  Empty
}

fn area(shape: Shape) -> Float {
  shape match {
    Circle(radius:) -> 3.14159 * radius * radius
    Rect(w, h) -> w * h
    Empty -> 0.0
  }
}

fn main() {
  user = User(id: 1, name: "alice")
  name = "bob"
  dbg(User(name:, ..user))                # User(id: 1, name: "bob")
  dbg(area(Rect(2.0, 3.0)))               # 6.0
}
```

- `match` は後置で、腕はカンマでなく改行で区切ります。
- バリアントは修飾なし（`Shape::Circle` でなく `Circle`）で書きます。
- `#[derive(Debug, PartialEq)]` は要りません。0.20 では `==` と `dbg` が全部の型で構造を見て動きます。
- `&` や `&mut` はありません。値は不変なので、渡してもコピーと区別が付きません。`Clone` も要りません。

## Result と ?

Rust では失敗を `Result` で返し、`?` で呼び出し元へ伝えます。Emela では `fail` した失敗が何も書かなくても伝わり、起こしうるエラーは関数の型に `fails` として出ます。

```rust
enum LoadError {
    NotFound(i32),
    Invalid(String),
}

fn find(id: i32) -> Result<String, LoadError> {
    if id == 1 { Ok("alice".to_string()) } else { Err(LoadError::NotFound(id)) }
}

fn load(id: i32) -> Result<String, LoadError> {
    let name = find(id)?;
    if name.is_empty() {
        return Err(LoadError::Invalid("empty".to_string()));
    }
    Ok(format!("Hello, {name}"))
}

fn load_or_guest(id: i32) -> Result<String, LoadError> {
    match load(id) {
        Err(LoadError::NotFound(_)) => Ok("Hello, guest".to_string()),
        other => other,
    }
}
```

```emela check
error NotFound(id: Int)
error Invalid(reason: String)

fn find(id: Int) -> String fails NotFound {
  if id == 1 { "alice" } else { fail NotFound(id:) }
}

fn load(id: Int) -> String fails NotFound | Invalid {
  name = find(id)
  if name == "" { fail Invalid(reason: "empty") }
  "Hello, #{name}"
}

# 推論される型: fn(Int) -> String fails Invalid
fn load_or_guest(id: Int) {
  load(id) escape {
    NotFound(_) -> "Hello, guest"
  }
}

fn main() {
  dbg(load_or_guest(2))                   # "Hello, guest"
}
```

- エラーは1つずつ `error` で宣言します。まとめる enum も `From` の変換も要りません。E はタグの集合で、呼んだ関数のエラーは和として合流します。
- `escape` で受けたタグは E から消えます。受けなかった `Invalid` は伝わり続けます。
- `-> T` と書いた関数は「失敗しない」の宣言です。本体に処理していないエラーがあればコンパイルエラーになります。
- `panic` は defect で、型に出ず、`escape` で受けられません。Rust の panic と同じ扱いです。

## Option と ok_or

```rust
let user = users.iter().find(|u| u.id == id).ok_or(NotFound(id))?;
let name = maybe_user.map(|u| u.name).unwrap_or("guest".to_string());
```

```emela check
error NotFound(id: Int)

type User(id: Int, name: String)

fn find(users: List[User], id: Int) -> User fails NotFound {
  users
    |> List.find(fn(u) { u.id == id })
    |> Option.or_fail(NotFound(id:))
}

fn main() {
  users = [User(id: 1, name: "alice")]
  dbg(find(users, 1).name)
  name = List.find(users, fn(u) { u.id == 2 })
    |> Option.map(fn(u) { u.name })
    |> Option.or("guest")
  dbg(name)                               # "guest"
}
```

## trait と依存

Rust の trait は、型への制約と、差し替えたい実装の受け渡しの両方に使われます。Emela では前者を `trait`、後者をエフェクトで書きます。

```rust
trait Clock {
    fn now(&self) -> u64;
}

fn greet(clock: &impl Clock, name: &str) -> String {
    format!("[{}] Hello, {name}", clock.now())
}
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
  with FixedStamp { dbg(greet("alice")) }
}
```

- 実装を引数で渡しません。`greet` の型に `use Stamp` が出て、`main` かテストで `with` を使って供給します。
- 型への制約としての `trait`（`[A: Ord]`）と `impl`、`derive` は 0.21 で入る予定です。impl を書けるのは型か Trait を定義したモジュールだけ、という孤児規則は Rust と同じです。

## Drop とリソース

`Drop` で後始末していたものは、ハンドラの `release` で書きます。`with` をどう抜けても（正常終了、エラー、defect、中断）1回走ります。

```rust
struct Conn;

impl Drop for Conn {
    fn drop(&mut self) {
        println!("close");
    }
}
```

```emela check
import Std.Console.{Console, SystemConsole}

effect Db {
  fn query(sql: String) -> String
}

handler FakeDb implements Db {
  init {
    (use Console).print_line("open")
    FakeDb
  }
  release { (use Console).print_line("close") }
  fn query(sql) { "rows for #{sql}" }
}

fn main() {
  with SystemConsole, FakeDb {
    (use Console).print_line((use Db).query("select 1"))
  }
}
```

```console
open
rows for select 1
close
```

## ループと可変な変数

`for` と `let mut` の代わりに、`List` の関数か再帰で書きます。自分への末尾呼び出しはスタックを使わないので、`loop` は末尾再帰にします。

```rust
let mut total = 0;
for x in 1..=100 {
    if x % 3 == 0 { total += x; }
}
```

```emela check
fn sum_until(n: Int, acc: Int) -> Int {
  if n == 0 { acc } else { sum_until(n - 1, acc + n) }
}

fn main() {
  total = List.range(1, 101)
    |> List.filter(fn(x) { x % 3 == 0 })
    |> List.fold(from: 0, f: fn(acc, x) { acc + x })
  dbg(total)                              # 1683
  dbg(sum_until(100, 0))                  # 5050
}
```

## async

`async fn` は呼ぶ側に `.await` を求めますが、Emela では中断しうる操作（`Clock.sleep` など）も普通の呼び出しです。中断の印はエフェクトの操作の宣言（`suspend fn`）にだけ付きます。

```rust
async fn fetch_user(id: u32) -> String {
    tokio::time::sleep(Duration::from_millis(10 * id as u64)).await;
    format!("user {id}")
}

let (a, b) = tokio::join!(fetch_user(1), fetch_user(2));
let late = tokio::time::timeout(Duration::from_millis(20), fetch_user(8)).await.ok();
```

```emela check
import Std.Clock.{Clock, SystemClock}
import Std.Fiber.{Fiber}

fn fetch_user(id: Int) -> String use Clock {
  (use Clock).sleep(10 * id)
  "user #{id}"
}

fn main() {
  with SystemClock {
    dbg(Fiber.both(fn() { fetch_user(1) }, fn() { fetch_user(2) }))
    dbg(Fiber.timeout(20, fn() { fetch_user(8) }))   # None
  }
}
```

- `tokio::spawn` のように切り離したタスクはありません。fiber は `Fiber.scope` の中で起動し、スコープより先に終わります（`JoinSet` を必ず待つのに近い形です）。
- fiber は1つのスレッドの上で協調的に切り替わり、並列には走りません。`Send` や `Sync`、`Mutex` はありません。

## 気をつけるところ

- 所有権、借用、ライフタイムはありません。代わりに値はすべて不変です。
- 数値の型の間に暗黙の変換はなく、`as` もありません。`Float.from_int`、`Int64.from_int` のような関数で変換します。
- 整数のゼロ除算は defect です。
- ビット演算の演算子はありません。`Int.bit_and` などの関数で書きます。
- 演算子の多重定義（`impl Add`）はできません。
- マクロはありません。`println!` に当たるのは `Console` のエフェクトの `print_line` です。
- 能力の値（`use Stamp` の値）は引数に渡せず、データに入れることも返すこともできません。
