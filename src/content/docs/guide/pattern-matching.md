---
title: パターンマッチ
description: 後置の match、パターンの種類、ガード、網羅性と冗長な腕、束縛のパターン
---

`match` は値の形で処理を分ける式です。`式 match { 腕 }` と後置で書き、腕は上から順に試します。すべての場合を覆っていない match はコンパイルエラーになります。

```emela check
enum Shape {
  Circle(radius: Float)
  Rect(Float, Float)
  Empty
}

fn area(shape: Shape) -> Float {
  shape match {
    Circle(radius:) if radius > 0.0 -> 3.14 * radius * radius
    Circle(_) -> 0.0
    Rect(w, h) -> w * h
    Empty -> 0.0
  }
}

fn main() {
  dbg(area(Circle(radius: 1.0)))    # 3.14
  dbg(area(Rect(2.0, 3.0)))         # 6.0
  dbg(area(Empty))                  # 0.0
}
```

## 後置で書く

match は値の後ろに書きます。`match x { ... }` と前に置くとエラーです。

```emela check=error
fn main() {
  x = 1
  match x {
    _ -> 0
  }
}
```

```text
`match` comes after the value: write `value match { ... }`
```

後置なので、パイプの結果をそのまま分けられ、左から右へ読む向きが変わりません。

```emela check
type User(id: Int, name: String)

fn main() {
  users = [User(id: 1, name: "alice"), User(id: 2, name: "bob")]
  id = 2
  name = users |> List.find(fn(u) { u.id == id }) match {
    Some(u) -> u.name
    None -> "guest"
  }
  dbg(name)         # "bob"
}
```

match は escape と同じく一番弱く結合するので、`a |> f match { ... }` は `(a |> f) match { ... }` です。`load(id) match { ... } escape { ... }` のように、match の結果に続けて escape を掛けることもできます。

## パターンの種類

| パターン | 形 | 意味 |
|---|---|---|
| ワイルドカード | `_` | 何にでも合い、束縛しない |
| 変数 | `x` | 何にでも合い、`x` に束縛する |
| リテラル | `0` `-1` `1.5` `"a"` `True` | その値と等しいとき合う |
| 定数 | `MAX_SIZE` | const の値と等しいとき合う |
| 構成子 | `Empty` `Rect(w, h)` `Circle(radius: r)` | その構成子で作られた値に合う |
| 残りを無視 | `User(name:, ..)` | 列挙していないフィールドを無視する |
| タプル | `(a, b)` | 要素ごとに照合する |
| リスト | `[]` `[x, ..rest]` `[x, ..]` `[a, b]` | 空、先頭と残り、先頭と（束縛しない）残り、ちょうど2要素 |

パターンは `Some(Some(n))` や `[(k, v), ..rest]` のように入れ子にできます。

### リテラルと const

```emela check
const ADMIN_ID = 0

fn describe(n: Int) -> String {
  n match {
    ADMIN_ID -> "admin"
    -1 -> "minus one"
    n if n < 0 -> "negative"
    _ -> "positive"
  }
}

fn command(s: String) -> String {
  s match {
    "q" -> "quit"
    "h" -> "help"
    _ -> "unknown"
  }
}

fn main() {
  dbg(describe(0))      # "admin"
  dbg(describe(-1))     # "minus one"
  dbg(describe(-5))     # "negative"
  dbg(command("q"))     # "quit"
}
```

パターンでは数のリテラルの前に `-` を書けて、`-1` は1つの値として照合します。const は `==` で照合します。文字列のパターンに補間は書けません。

### 構成子と名前付きフィールド

```emela check
type User(id: Int, name: String, email: String)

fn greet(u: User) -> String {
  u match {
    User(id: 0, ..) -> "hello, admin"
    User(name:, ..) -> "hello, #{name}"
  }
}

fn main() {
  dbg(greet(User(id: 0, name: "root", email: "r@example.com")))   # "hello, admin"
  dbg(greet(User(id: 2, name: "bob", email: "b@example.com")))    # "hello, bob"
}
```

`User(name:, ..)` はフィールド `name` を同じ名前の変数に束縛します。`User(name: n)` と書けば別の名前で束縛し、`User(id: 0, ..)` と書けばその値と照合します。位置で書く `User(i, n, e)` の形もあります。

名前付きフィールドを持つ構成子で一部のフィールドだけ書くときは、`..` が要ります。

```emela check=error
type User(id: Int, name: String, email: String)

fn name_of(u: User) -> String {
  u match {
    User(name:) -> name
  }
}
```

```text
pattern `User` does not mention fields `id`, `email`
```

`..` を省けないので、型にフィールドを足すと、全部の照合箇所がこのエラーで見つかります。

### タプル

複数の値で同時に分けるときは、タプルにまとめて match します。

```emela check
fn fizzbuzz(n: Int) -> String {
  (n % 3, n % 5) match {
    (0, 0) -> "FizzBuzz"
    (0, _) -> "Fizz"
    (_, 0) -> "Buzz"
    _ -> Int.to_string(n)
  }
}

fn main() {
  dbg(List.range(1, 16) |> List.map(fizzbuzz) |> String.join(" "))
  # "1 2 Fizz 4 Buzz Fizz 7 8 Fizz Buzz 11 Fizz 13 14 FizzBuzz"
}
```

### リスト

```emela check
fn sum(xs: List[Int]) -> Int {
  xs match {
    [] -> 0
    [x, ..rest] -> x + sum(rest)
  }
}

fn first_two(xs: List[String]) -> String {
  xs match {
    [a, b, ..] -> "#{a}, #{b}"
    [a] -> a
    [] -> "none"
  }
}

fn main() {
  dbg(sum([1, 2, 3]))                 # 6
  dbg(first_two(["a", "b", "c"]))     # "a, b"
  dbg(first_two(["a"]))               # "a"
}
```

`[x, ..rest]` は先頭の1要素と残りのリストに分けます。`[a, b, ..]` なら先頭の2要素を取り、残りは束縛しません。`..` は末尾に1回だけ書けます。

## ガード

腕のパターンの後に `if 条件` を付けると、パターンに合い、かつ条件が True のときだけその腕を選びます。

```emela check
fn classify(n: Int) -> String {
  n match {
    0 -> "zero"
    n if n % 2 == 0 -> "even"
    _ -> "odd"
  }
}

fn main() {
  dbg(classify(4))      # "even"
  dbg(classify(7))      # "odd"
}
```

`1..10` のような範囲のパターンはないので、範囲もガードで書きます。

```emela check
fn grade(score: Int) -> String {
  score match {
    s if s >= 90 -> "A"
    s if s >= 70 -> "B"
    _ -> "C"
  }
}

fn main() {
  dbg(grade(75))    # "B"
}
```

## 網羅性

すべての場合を覆っていない match はエラーで、足りないパターンの例が示されます。

```emela check=error
enum Shape {
  Circle(radius: Float)
  Rect(Float, Float)
  Empty
}

fn area(shape: Shape) -> Float {
  shape match {
    Circle(radius:) -> 3.14 * radius * radius
    Empty -> 0.0
  }
}
```

```text
non-exhaustive match: pattern `Rect(_, _)` not covered
```

入れ子やリストでも、足りない形を具体的に示します。

| match の腕 | 足りないと示されるパターン |
|---|---|
| `Some(Some(n))`、`None` | `Some(None)` |
| `[]` だけ | `[_, ..]` |
| `n if n > 0`、`0` | `_` |

最後の例のように、ガードの付いた腕は網羅の判定に数えません。条件が何であれ、最後に `_` か変数の腕を置きます。

上の腕で全部覆われていて到達しない腕は、警告になります。

```emela check
fn f(b: Bool) -> Int {
  b match {
    True -> 1
    False -> 0
    _ -> 2        # unreachable match arm の警告
  }
}

fn main() {
  dbg(f(True))    # 1
}
```

## 束縛のパターン

束縛 `パターン = 式` の左辺にもパターンを書けます。ただし必ず照合に成功するものに限ります。

```emela check
type Point(x: Int, y: Int)

fn main() {
  (a, b) = (1, 2)
  Point(x:, ..) = Point(x: 3, y: 4)
  dbg(a + b + x)    # 6
}
```

構成子が1つの type やタプル、変数は書けます。enum のバリアントやリテラルのように失敗しうるパターンはエラーになり、match と同じく足りないパターンが示されます。

```emela check=error
fn main() {
  Some(x) = Some(1)
}
```

```text
refutable pattern in binding: pattern `None` not covered
```

照合の細かい規則（const や Float の扱いなど）は [型と効果の体系](/reference/type-system/) にあります。

## escape の腕

[エラー](/guide/errors/) を受ける `escape` の腕も match と同じ `パターン -> 式` の形です。match が式の値で分けるのに対して、escape は式が起こしうるエラーで分けます。escape は網羅しなくてよく、受けなかったエラーは呼び出し元へ伝わります。腕の最上位に書けるのはエラーの構成子だけです。

```emela check
error NotFound(id: Int)

type User(id: Int, name: String)

fn load(id: Int) -> Option[User] fails NotFound {
  if id < 0 { fail NotFound(id:) }
  if id == 1 { Some(User(id: 1, name: "alice")) } else { None }
}

fn name_of(id: Int) -> String {
  load(id) match {
    Some(user) -> user.name
    None -> "guest"
  } escape {
    NotFound(_) -> "unavailable"
  }
}

fn main() {
  dbg(name_of(1))     # "alice"
  dbg(name_of(2))     # "guest"
  dbg(name_of(-1))    # "unavailable"
}
```
