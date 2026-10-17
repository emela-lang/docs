---
title: パターンマッチ
description: 後置の match、パターンの種類、ガード、網羅性と冗長な腕、束縛のパターン
---

`match` は、値の形で処理を分ける式です。`式 match { 腕 }` と後置で書き、腕は上から順に試します。網羅していない match はコンパイルエラーになり、足りないパターンの例が示されます。

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

match は値の後ろに書きます。Kotlin の `when` や Rust の `match` に近いものですが、向きが逆です。

```emela check=error
fn main() {
  x = 1
  match x {         # E0142: `match` comes after the value: write `value match { ... }`
    _ -> 0
  }
}
```

前置で書くと E0142 になります。コンパイラは前置のまま読んで回復し、型の検査は続けます。

後置なので、パイプの結果をそのまま分けられます。読む向きが左から右のまま変わりません。match は式なので、束縛の右辺にも書けます。

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

- 優先順位は escape と同じく一番弱いところにあります。`a |> f match { ... }` は `(a |> f) match { ... }` です。
- 行頭の `match {` は前の行に続きます。`x` の次の行に `match {` を書いてもかまいません。
- match と escape は続けて書けます。`load(id) match { ... } escape { ... }` は、match の結果に escape を掛けます。

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

パターンは入れ子にできます（`Some(Some(n))`、`[(k, v), ..rest]`）。

### リテラル、負の数、const

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

- パターンでは、数のリテラルの前に `-` を書けます（`-1`、`-0x10`、`-1.5`）。式の `-1` は単項マイナスとリテラルですが、パターンでは1つの値です。そのため Int の最小値 `-2147483648` もパターンなら書けます。
- 文字列のパターンに補間は書けません（E0117）。
- const は `==` で照合します。右辺がリテラル、構成子、タプル、リストなどの値だけでできた const は、網羅と冗長の判定でもその値として扱います。`ADMIN_ID` の下に `0 -> ...` を書けば冗長の警告が出ます。
- 右辺が関数の呼び出しを含む const は、ガードの付いた腕と同じく網羅の判定に数えません。

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

- `User(name:)` は `User(name: name)` の省略で、フィールド `name` を同じ名前の変数に束縛します。
- `User(name: n)` と書けば別の名前で束縛し、`User(id: 0)` と書けばその値と照合します。
- 位置でも書けます（`User(i, n, e)`）。
- 名前付きフィールドを持つ構成子では、`..` を書かずにフィールドを省くとエラーです。フィールドを足したときに、全部の照合箇所が検査に引っかかるようにするためです。

```emela check=error
type User(id: Int, name: String, email: String)

fn name_of(u: User) -> String {
  u match {
    User(name:) -> name   # E0308: pattern `User` does not mention fields `id`, `email`
  }
}
```

### タプル

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

複数の値で同時に分けるときは、タプルにまとめて match します。

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

- `[x, ..rest]` は先頭の1要素と残りのリストに分けます。`[x, y, ..rest]` で先頭の2要素を取れます。
- `..` は末尾に1回だけ書けます。要素なしの `[..]` と `[..rest]` は書けません（それぞれ `_`、`rest` と同じなので）。

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

- ガードの付いた腕は、網羅性の判定に数えません。
- ガードの付いた腕は、それより下の腕が冗長かどうかの判定でも、下の腕を覆いません。

## 網羅性

すべての場合を覆っていない match はエラーです（E0303）。エラーには、足りないパターンの例が出ます。

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
error[E0303]: non-exhaustive match: pattern `Rect(_, _)` not covered
```

入れ子やリストでも、足りない形を具体的に示します。

| match の腕 | 足りないと示されるパターン |
|---|---|
| `Some(Some(n))`、`None` | `Some(None)` |
| `[]` だけ | `[_, ..]` |
| `n if n > 0`、`0` | `_` |

最後の例のように、ガードの付いた腕しかない場合は、条件が何であれ覆っていないとみなします。最後に `_` か変数の腕を置きます。

## 冗長な腕

それより上の腕で全部覆われている腕は、到達しないので警告します（W0301）。

```emela check
fn f(b: Bool) -> Int {
  b match {
    True -> 1
    False -> 0
    _ -> 2        # W0301: unreachable match arm
  }
}

fn main() {
  dbg(f(True))    # 1
}
```

## Float と NaN の照合

Float のリテラルのパターンは `==` で照合します。

```emela check
const NAN = 0.0 / 0.0

fn classify(x: Float) -> String {
  x match {
    NAN -> "nan"        # どの値にも合わない
    0.0 -> "zero"       # -0.0 にも合う
    _ -> "other"
  }
}

fn main() {
  dbg(classify(-0.0))         # "zero"
  dbg(classify(0.0 / 0.0))    # "other"
}
```

- `0.0` は `-0.0` にも合います。
- NaN は自分自身とも等しくないので、NaN の値のパターンはどの値にも合いません。NaN を見分けるには、ガードで `x != x` を確かめます。
- 冗長な腕の判定では、NaN どうしを同じ値とみなします。

## 範囲のパターンはない

`1..10` のような範囲のパターンはありません。網羅の判定が数の区間を扱わずに済むようにするためです。範囲はガードで書きます。

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

## 束縛のパターン

束縛 `パターン = 式` の左辺にもパターンを書けますが、必ず照合に成功するもの（反駁不能なもの）に限ります。

```emela check
type Point(x: Int, y: Int)

fn main() {
  (a, b) = (1, 2)
  Point(x:, ..) = Point(x: 3, y: 4)
  dbg(a + b + x)    # 6
}
```

失敗しうるパターンは E0317 です。検査は網羅性と同じで、エラーには足りないパターンが出ます。

```emela check=error
fn main() {
  Some(x) = Some(1)   # E0317: refutable pattern in binding: pattern `None` not covered
}
```

- 構成子が1つの type やタプル、変数、`_` は反駁不能です。
- enum のバリアント、リテラル、負の数、const、要素数を決めたリストは反駁可能なので、束縛には書けません。match で書きます。

## escape の腕との違い

[エラー](/guide/errors/) を受ける `escape` の腕も、match と同じ `パターン -> 式` の形です。違いは次のとおりです。

| | match | escape |
|---|---|---|
| 対象 | 式の値 | 式が起こしうるエラー |
| 網羅 | 必須（E0303） | 不要。受けなかったエラーは呼び出し元へ伝わる |
| 最上位のパターン | 何でもよい | エラーの構成子だけ（`_` や変数は E0320） |
| 冗長の警告 | W0301 | W0301。起きないエラーの腕は W0302 |

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
