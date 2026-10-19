---
title: データ型
description: type（直積）、enum（直和）、Option、タプルと Unit、部分更新、const
---

データは type（直積）、enum（直和）、タプルで定義します。宣言も構築もパターンも同じ `( )` の形なので、作るときと取り出すときで書き方が変わりません。

```emela check
type User(id: Int, name: String)

enum Shape {
  Circle(radius: Float)
  Rect(Float, Float)
  Empty
}

fn main() {
  user = User(id: 1, name: "alice")
  dbg(user.name)                        # "alice"

  shapes = [Circle(radius: 1.0), Rect(2.0, 3.0), Empty]
  dbg(List.length(shapes))              # 3

  pair = (user.id, "admin")
  dbg(pair)                             # (1, "admin")
}
```

## type

```emela check
type User(id: Int, name: String)

type Pair[A, B](first: A, second: B)

type Todo(
  id:        Int,
  title:     String,
  completed: Bool,
)

fn main() {
  todo = Todo(id: 1, title: "Write docs", completed: False)
  dbg(todo.title)                       # "Write docs"
  dbg(Todo(2, "Review", completed: True))
  # Todo(id: 2, title: "Review", completed: True)
  dbg(Pair(first: 1, second: "one"))    # Pair(first: 1, second: "one")
}
```

type を宣言すると、型と同じ名前の構成子が1つできます。構成子も関数と同じ規則で呼ぶので、`Todo(2, "Review", completed: True)` のように位置引数と名前付き引数を混ぜられます（[束縛と関数](/guide/functions/)）。フィールドは `todo.title` で読みます。

型は名前で区別します。フィールドが同じでも、名前が違えば別の型です。

```emela check=error
type Point(x: Int, y: Int)
type Vec(x: Int, y: Int)

fn norm(p: Point) -> Int {
  p.x * p.x + p.y * p.y
}

fn main() {
  dbg(norm(Vec(x: 1, y: 2)))
}
```

```text
type mismatch: expected `Point`, found `Vec`
```

`{ x: Int, y: Int }` のような無名のレコード型はないので、名前を付けて宣言します。

フィールドを読むときは、その時点で値の型が分かっている必要があります。フィールドの名前から型を逆算しないので、無名関数の引数でフィールドを読むときは、引数の型が呼び出し先から決まるか、型を書きます。

### 部分更新

一部のフィールドだけを変えた値は、構成子の呼び出しの末尾に `..式` を書いて作ります。書いたフィールド以外は `..` の後の値から引き継ぎます。

```emela check
type Todo(id: Int, title: String, completed: Bool)

type Pair[A, B](first: A, second: B)

fn main() {
  todo = Todo(id: 1, title: "Write docs", completed: False)
  done = Todo(completed: True, ..todo)
  dbg(done)       # Todo(id: 1, title: "Write docs", completed: True)
  dbg(todo)       # Todo(id: 1, title: "Write docs", completed: False)

  p = Pair(first: 1, second: True)
  q = Pair(first: "s", ..p)
  dbg(q)          # Pair(first: "s", second: True)
}
```

元の `todo` は変わらず、新しい値ができます。変えるフィールドは名前付きで書きます。型引数は変わってよく、上の `q` は `Pair[Int, Bool]` から作った `Pair[String, Bool]` です。

部分更新は、構成子が1つの type や error に使えます。enum のバリアントには使えません。

```emela check=error
enum Shape {
  Circle(radius: Float)
}

fn main() {
  c = Circle(radius: 1.0)
  d = Circle(radius: 2.0, ..c)
}
```

```text
cannot update enum variant `Circle` with `..`
```

`c` の型は `Shape` で、中身が `Circle` かどうかは型で分かりません。

## enum

```emela check
enum Shape {
  Circle(radius: Float)     # 名前付き
  Rect(Float, Float)        # 位置引数
  Empty                     # 中身なし
}

enum Color { Red, Green, Blue }

fn area(shape: Shape) -> Float {
  shape match {
    Circle(radius:) -> 3.14 * radius * radius
    Rect(w, h) -> w * h
    Empty -> 0.0
  }
}

fn main() {
  dbg(area(Rect(2.0, 3.0)))     # 6.0
  dbg([Red, Green])             # [Red, Green]
}
```

enum は閉じた直和型で、宣言の後からバリアントを足すことはできません。バリアントの中身は、なし、位置引数、名前付きのどれでもよく、1つの enum に違う形を並べられます。区切りは改行かカンマです。

`Int | String` のような一般の union 型はありません。union が現れるのはエラーの集合だけです（[エラー](/guide/errors/)）。

### バリアントの中身を取り出す

バリアントは親の型の値を作る構成子で、それ自体は型ではありません。`fn f(c: Circle)` とは書けないので、`Shape` を受けて match で分けます。

```emela check=error
enum Shape {
  Circle(radius: Float)
  Empty
}

fn radius(c: Circle) -> Float {
  c.radius
}
```

```text
cannot find type `Circle` in this scope
```

1つのバリアントの中身を型として扱いたいときは、type を宣言してバリアントに持たせます（`type Circle(radius: Float)` と `enum Shape { CircleShape(Circle), Empty }`）。

enum の値は名前付きのフィールドでも `.` で読めません。中身は match で取り出します。

```emela check=error
enum Shape {
  Circle(radius: Float)
}

fn main() {
  c = Circle(radius: 1.0)
  dbg(c.radius)
}
```

```text
type `Shape` has no fields
```

## Option

値があるかないかは、Prelude の enum `Option` で表します。null はありません。

```emela
enum Option[A] {
  Some(A)
  None
}
```

```emela check
fn main() {
  xs = [10, 20, 30]
  dbg(List.get(xs, 0))                            # Some(10)
  dbg(List.get(xs, 5))                            # None
  dbg(List.head(xs) |> Option.map(fn(n) { n + 1 }))   # Some(11)
  dbg(List.get(xs, 5) |> Option.or(0))            # 0

  label = List.find(xs, fn(n) { n > 15 }) match {
    Some(n) -> "found #{n}"
    None -> "none"
  }
  dbg(label)                                      # "found 20"
}
```

`Option.map`、`and_then`、`or`、`is_some`、`is_none`、`or_fail` が core にあります（[core のモジュール](/std/core/)）。`Option.or_fail(opt, err)` は `None` をエラーに変えます（[エラー](/guide/errors/)）。

`xs[0]` のような添字の構文はないので、リストの要素は上のように `List.get(xs, 0)` で取ります。範囲外なら `None` が返ります。

## タプルと Unit

```emela check
fn min_max(xs: List[Int]) -> (Int, Int) {
  List.fold(xs, from: (0, 0), f: fn(acc, x) {
    (lo, hi) = acc
    (if x < lo { x } else { lo }, if x > hi { x } else { hi })
  })
}

fn main() {
  (lo, hi) = min_max([3, -1, 4])
  dbg(lo)                       # -1
  dbg(hi)                       # 4
  t: (Int, String, Bool) = (1, "x", True)
  dbg(t)                        # (1, "x", True)
  dbg(())                       # ()
}
```

型は `(Int, String)`、値は `(1, "a")`、パターンは `(n, s)` と書き、要素は2つ以上です。`t.0` のような番号での参照はないので、要素はパターンで取り出します。要素0個の `()` が Unit です。

## const

```emela check
type Config(host: String, port: Int)

const MAX_RETRY = 3
const DEFAULT_CONFIG = Config(host: "localhost", port: 8080)
const LIMITS = [10, 100, 1000]

fn main() {
  dbg(MAX_RETRY + 1)            # 4
  dbg(DEFAULT_CONFIG.port)      # 8080
  dbg(List.length(LIMITS))      # 3
}
```

const の名前は `MAX_RETRY` のような大文字名で書きます。右辺に書けるのは純粋な式で、`const TIMEOUT = Duration.seconds(5)` のように純粋な関数は呼べますが、失敗する関数やエフェクトを使う関数は呼べません。型を書かなければ汎化するので、`const EMPTY = []` はどの要素型のリストとしても使えます。

右辺は最初に参照したときに1回だけ評価します。

```emela check
const LIMIT = compute()

fn compute() -> Int {
  dbg("computing")
  100
}

fn main() {
  dbg("start")
  dbg(LIMIT)
  dbg(LIMIT)
}
```

```text
"start"
"computing"
100
100
```

起動時に全部を評価しないので、使っていない const の defect がプログラムやほかのテストを止めることはありません。評価中の defect は最初に参照したところで起き、文面に const の名前が入ります。

```emela check
const RATIO = 10 / zero()

fn zero() -> Int {
  0
}

fn main() {
  dbg(RATIO)
}
```

```text
defect: while evaluating const RATIO: division by zero
```

const どうしが名前だけで互いを参照しているとエラーです。

```emela check=error
const A = B
const B = A

fn main() {}
```

```text
constants refer to each other: `A` -> `B` -> `A`
```

パターンに const を書くと、その値との照合（`==`）になります。

```emela check
const ORIGIN = (0, 0)

fn where_is(p: (Int, Int)) -> String {
  p match {
    ORIGIN -> "origin"
    (0, _) -> "on the y axis"
    _ -> "elsewhere"
  }
}

fn main() {
  dbg(where_is((0, 0)))     # "origin"
  dbg(where_is((0, 5)))     # "on the y axis"
}
```

評価の細かい規則は [実行時の意味](/reference/semantics/) にあります。
