---
title: 言語ツアー
description: 束縛、関数、パイプ、type と enum、match、エラー、エフェクト、テスト、fiber を一巡りする
---

主な機能を短い例で一巡りします。例はどれも単独のファイルとして `emela run main.emel` で動きます。

## 束縛

```emela check
const VERSION = "0.20"

fn main() {
  name = "Emela"
  count = 1
  count = count + 1 # 同じ名前で束縛し直す
  (major, minor) = (0, 20)
  dbg("#{name} #{VERSION}, count = #{count}, #{major}.#{minor}")
}
```

```console
$ emela run main.emel
"Emela 0.20, count = 2, 0.20"
```

束縛は `パターン = 式` と書き、`let` のようなキーワードはありません。変数は不変で、同じ名前で束縛し直すとそれ以降は新しい値が見えます。文字列は `+` でなく `#{式}` の補間でつなぎます。

詳しくは [基本の構文](/guide/basics/) と [基本の型](/guide/types/)。

## 関数

```emela check
fn connect(host: String, port: Int) -> String {
  "#{host}:#{port}"
}

fn twice(f: fn(Int) -> Int, x: Int) -> Int {
  f(f(x))
}

fn main() {
  dbg(connect("localhost", 5432))
  dbg(connect("localhost", port: 5432))
  dbg(connect(host: "db", port: 5432))
  dbg(twice(fn(n) { n * 3 }, 2))
  dbg(List.map([1, 2, 3], Some))
}
```

```console
$ emela run main.emel
"localhost:5432"
"localhost:5432"
"db:5432"
18
[Some(1), Some(2), Some(3)]
```

本体の最後の式が戻り値で、`return` はありません。仮引数の名前はそのまま引数名になり、`port: 5432` のように名前付きでも渡せます。無名関数は `fn(x) { ... }` と書き、`Some` のような構成子も名前だけで関数の値になります。

詳しくは [束縛と関数](/guide/functions/)。

## パイプ

```emela check
fn is_even(n: Int) -> Bool { n % 2 == 0 }

fn main() {
  List.range(1, 11)
    |> List.filter(is_even)
    |> List.map(fn(n) { n * n })
    |> List.fold(0, fn(acc, n) { acc + n })
    |> dbg
}
```

```console
$ emela run main.emel
220
```

`x |> f(a)` は `f(x, a)` と同じで、左辺の値が右辺の最初の引数に入ります。

`for` や `while` はありません。繰り返しは `List.map` や `List.fold` のような関数か、再帰で書きます。自分自身への末尾呼び出しはスタックを消費しません。詳しくは [制御の流れ](/guide/control-flow/)。

## type と enum

```emela check
type User(id: Int, name: String, admin: Bool)

enum Shape {
  Circle(radius: Float)
  Rect(Float, Float)
  Empty
}

fn main() {
  alice = User(id: 1, name: "alice", admin: False)
  promoted = User(admin: True, ..alice)
  dbg(promoted)
  dbg(promoted.name)
  dbg([Circle(radius: 1.0), Rect(2.0, 3.0), Empty])
}
```

```console
$ emela run main.emel
User(id: 1, name: "alice", admin: True)
"alice"
[Circle(radius: 1.0), Rect(2.0, 3.0), Empty]
```

`type` はフィールドを持つ型と同じ名前の構成子を、`enum` は決まった種類のどれかになる型を定義します。`User(admin: True, ..alice)` は書いたフィールドだけを変えた新しい値を作り、元の値は変わりません。null はなく、値の不在は `Option[A]`（`Some(a)` と `None`）で表します。

詳しくは [データ型](/guide/data/) と [型引数](/guide/generics/)。

## match

```emela check
enum Shape {
  Circle(radius: Float)
  Rect(Float, Float)
  Empty
}

fn area(shape: Shape) -> Float {
  shape match {
    Circle(radius:) if radius > 0.0 -> 3.14 * radius * radius
    Circle(_)                       -> 0.0
    Rect(w, h)                      -> w * h
    Empty                           -> 0.0
  }
}

fn describe(xs: List[Int]) -> String {
  xs match {
    []          -> "empty"
    [x]         -> "one: #{x}"
    [x, ..rest] -> "#{x} and #{List.length(rest)} more"
  }
}

fn main() {
  dbg(area(Rect(2.0, 3.0)))
  dbg(describe([7, 8, 9]))
  label = if List.length([1]) > 0 { "some" } else { "none" }
  dbg(label)
}
```

```console
$ emela run main.emel
6.0
"7 and 2 more"
"some"
```

`match` は後置で `式 match { 腕 }` と書き、パイプの続きにそのまま置けます。腕は上から順に試し、網羅していなければコンパイルが通りません。`if` も式で、値として使うときは `else` が要ります。

詳しくは [パターンマッチ](/guide/pattern-matching/) と [制御の流れ](/guide/control-flow/)。

## エラー

```emela check
error NotFound(id: Int)
error Invalid(reason: String)

type User(id: Int, name: String)

fn find(id: Int) -> User fails NotFound {
  id match {
    1 -> User(id: 1, name: "alice")
    _ -> fail NotFound(id:)
  }
}

# 推論される: fails NotFound | Invalid
fn name_of(id: Int) {
  if id < 0 { fail Invalid(reason: "negative id") }
  find(id).name
}

fn main() {
  dbg(name_of(1))
  dbg(name_of(2) escape { NotFound(id:) -> "no user #{id}" })
  found = Some(find(3)) escape { NotFound(_) -> None }
  dbg(found)
  dbg(name_of(-1)) # Invalid は main まで伝わる
}
```

```console
$ emela run main.emel
"alice"
"no user 2"
None
error: Invalid(reason: "negative id")
```

`fail` で計算を終わらせると、エラーは何も書かなくても呼び出し元へ伝わります。`式 escape { 腕 }` は受けたいエラーだけを値に戻し、受けなかった `Invalid` はそのまま `main` まで伝わります。起こしうるエラーの集合は型の一部で、戻り値の型を省けば推論され、`-> T` と書けば「失敗しない」、`-> T fails NotFound` と書けば「ちょうどこの集合」の意味になります。

Result 型も try / catch もありません。詳しくは [エラー](/guide/errors/)。

## エフェクトとハンドラ

```emela check
import Std.Console.{Console, SystemConsole}

effect Greeter {
  fn greeting(name: String) -> String
}

handler English implements Greeter {
  fn greeting(name) { "Hello, #{name}!" }
}

handler Japanese implements Greeter {
  fn greeting(name) { "こんにちは、#{name}さん" }
}

# 推論される: use { Greeter, Console }
fn welcome(names: List[String]) {
  greeter = use Greeter
  console = use Console
  List.map(names, fn(n) { console.print_line(greeter.greeting(n)) })
}

fn main() {
  with SystemConsole, English { welcome(["alice", "bob"]) }
  with SystemConsole, Japanese { welcome(["carol"]) }
}
```

```console
$ emela run main.emel
Hello, alice!
Hello, bob!
こんにちは、carolさん
```

`effect` は操作の集まりを宣言するだけで、実装は `handler` が持ちます。`use X` はその位置で供給されている `X` の能力の値を返し、`with H { 本体 }` が本体の中で `H` を供給します。同じ `welcome` が、外側の `with` によって英語にも日本語にもなります。

使うエフェクトの集合も型の一部で推論され、`main` では空でなければなりません。ホストの機能は `Std.Platform` の `Platform` にまとまっていて、`with Platform { ... }` でそろいます。詳しくは [エフェクトとハンドラ](/guide/effects/)。

## テスト

```emela check
import Std.Console.{Console, TestConsole}
import Std.State.{State}

fn greet(name: String) {
  (use Console).print_line("Hello, #{name}!")
}

@test
fn greets_everyone() {
  (_, lines) = State.run([], fn() {
    with TestConsole {
      greet("alice")
      greet("bob")
    }
  })
  assert lines == ["Hello, alice!", "Hello, bob!"]
}

fn main() {}
```

```console
$ emela test main.emel
running 1 test
test greets_everyone ... ok

test result: ok. 1 passed; 0 failed; 0 filtered out
```

`@test` を付けた引数のない関数がテストで、`assert 式` で確かめます。`TestConsole` は出力した行を `State` に溜めるハンドラで、`State.run` の戻り値の2つ目で読めます。ハンドラを差し替えるだけなので、モックの仕組みは要りません。

詳しくは [テスト](/guide/testing/)。

## fiber

```emela check
import Std.Clock.{Clock}
import Std.Console.{Console}
import Std.Fiber.{Fiber}
import Std.Platform.{Platform}

fn fetch(id: Int, ms: Int) -> String {
  (use Clock).sleep(ms)
  (use Console).print_line("fetched #{id}")
  "user #{id}"
}

fn main() {
  with Platform {
    (a, b) = Fiber.both(fn() { fetch(1, 200) }, fn() { fetch(2, 100) })
    (use Console).print_line("#{a}, #{b}")
    late = Fiber.timeout(50, fn() { fetch(3, 1000) })
    (use Console).print_line("timeout: #{late}")
  }
}
```

```console
$ emela run main.emel
fetched 2
fetched 1
user 1, user 2
timeout: None
```

`async` や `await` の構文はなく、`sleep` のような中断する操作も普通の呼び出しと同じ形で書きます。`Fiber.both` は2つを並行に走らせるので、後に始めた `fetch(2, 100)` が先に終わります。fiber はスコープより長生きせず、1つが失敗すると兄弟は中断され、エラーはスコープの外へ伝わります。

詳しくは [並行処理](/guide/concurrency/) と [State・Fiber・Deferred](/std/state-fiber/)。

## モジュール

```emela
# src/email.emel
pub opaque type Email(value: String)

pub fn parse(input: String) -> Option[Email] {
  if String.contains(input, "@") { Some(Email(value: input)) } else { None }
}
```

```emela
# src/main.emel
import Email

fn main() {
  dbg(Email.parse("alice@example.com") |> Option.is_some) # True
}
```

1つのファイルが1つのモジュールで、`src/email.emel` は `Email` になります。宣言は既定で非公開で、`pub` を付けたものだけが外から見えます。`opaque` を付けた型は、外からは構成子もフィールドも見えません。

詳しくは [モジュールと公開範囲](/guide/modules/)。
