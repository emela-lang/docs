---
title: データ型
description: type（直積）、enum（直和）、Option、タプルと Unit、部分更新、const
---

Emela のデータは、type（直積）、enum（直和）、タプルの3つで定義します。宣言、構築、パターンはどれも同じ `( )` の形をとるので、作るときと取り出すときで書き方が変わりません。

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

- type は、型と、同じ名前の構成子を1つ定義します。バリアントが1つの enum と同じものです。
- フィールドには名前と型を書きます。区切りはカンマで、末尾のカンマは書いても書かなくてもかまいません。
- 構築は `User(id: 1, name: "a")` です。構成子の呼び出しも関数の呼び出しと同じ規則なので、位置でも名前付きでも書けます（[束縛と関数](/guide/functions/)）。
- フィールドの参照は `user.name` と書きます。
- 型は名前で区別します（nominal）。フィールドが同じでも、名前が違えば別の型です。
- 無名のレコード型（`{ x: Int, y: Int }` のような型）はありません。名前を付けて宣言します。

```emela check=error
type Point(x: Int, y: Int)
type Vec(x: Int, y: Int)

fn norm(p: Point) -> Int {
  p.x * p.x + p.y * p.y
}

fn main() {
  dbg(norm(Vec(x: 1, y: 2)))   # E0301: type mismatch: expected `Point`, found `Vec`
}
```

フィールドの参照 `x.name` は、その時点で `x` の型が分かっている必要があります。フィールドの名前から型を逆算することはしません（E0314）。無名関数の引数でフィールドを読むときは、引数の型が呼び出し先から決まるか、型を書きます。

### 部分更新

一部のフィールドだけを変えた値は、構成子の呼び出しの末尾に `..式` を書いて作ります。書いたフィールド以外は、`..` の後の値から引き継ぎます。

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

- 元の値は変わりません。新しい値を作ります。
- 使えるのは構成子が1つのもの（type、error、フィールドのある handler）だけです。enum のバリアントには使えません（E0222）。`..` の値がそのバリアントだと型で保証できないためです。
- 変えるフィールドは名前付きで書きます。位置では書けません（E0223）。
- `..` の後の式の型は、その構成子の型でなければなりません。型引数は変わってかまいません。上の `q` は `Pair[Int, Bool]` から作った `Pair[String, Bool]` です。
- opaque な型は、定義したモジュールの外では更新もできません（[モジュールと公開範囲](/guide/modules/)）。
- フィールドを全部書いたうえで `..` も書いたとき、1つも書かずに `..` だけを書いたときは、linter が警告します。

```emela check=error
enum Shape {
  Circle(radius: Float)
}

fn main() {
  c = Circle(radius: 1.0)
  d = Circle(radius: 2.0, ..c)    # E0222: cannot update enum variant `Circle` with `..`
}
```

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

- enum は閉じた直和型です。宣言の後からバリアントを足すことはできません。
- バリアントの中身は、なし、位置引数、名前付きの3形式から選びます。1つの enum に形式の違うバリアントを並べてかまいません。
- 1つのバリアントの中で、名前のないフィールドと名前付きのフィールドは混ぜられません（E0128）。
- バリアントの区切りは改行かカンマです。
- enum は1つ以上のバリアントを持ちます。値を持たない型は Never だけです。
- 一般の union 型（`Int | String`）はありません。union が現れるのはエラーの集合だけです（[エラー](/guide/errors/)）。

### バリアントは型ではない

バリアントは親の型の値を作る構成子で、それ自体は型ではありません。`fn f(c: Circle)` とは書けず、`Shape` を受けて match で分けます。

```emela check=error
enum Shape {
  Circle(radius: Float)
  Empty
}

fn radius(c: Circle) -> Float {   # E0211: cannot find type `Circle` in this scope
  c.radius
}
```

1つのバリアントの中身を型として扱いたいときは、type を宣言してバリアントに持たせます（`type Circle(radius: Float)` と `enum Shape { CircleShape(Circle), Empty }`）。

### enum の値はフィールドを参照できない

フィールドを参照できるのは、type、error、フィールドのある handler の値だけです。enum の値は、バリアントが1つでも、名前付きのフィールドでも、`.` で参照できません（E0313）。中身は match で取り出します。

```emela check=error
enum Shape {
  Circle(radius: Float)
}

fn main() {
  c = Circle(radius: 1.0)
  dbg(c.radius)     # E0313: type `Shape` has no fields
}
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

- 型は `(Int, String)`、値は `(1, "a")`、パターンは `(n, s)` と書きます。要素は2つ以上です。
- 要素0個のタプル `()` が Unit です。
- 要素1個のタプルはありません。式の `(x)` と型の `(T)` はただの括弧です。パターンの `(a)` は書けません。
- 要素はパターンで取り出します。`t.0` のような番号での参照はありません。

## 括弧の役割

| 括弧 | 役割 |
|---|---|
| `( )` | 値の世界: 関数の呼び出し、構築、パターン、フィールドの宣言、タプル |
| `[ ]` | 型引数とリストリテラル |
| `{ }` | ブロックと宣言の本体 |

### 添字アクセスはない

`xs[0]` のような添字の構文はありません。`[ ]` は型引数とリストのためだけにあります。要素は `List.get(xs, 0)` で取り、範囲外なら `None` が返ります。

```emela check
fn main() {
  xs = [10, 20, 30]
  second = List.get(xs, 1) match {
    Some(n) -> n
    None -> 0
  }
  dbg(second)       # 20
}
```

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

- 名前は大文字名（`MAX_RETRY`）で書きます。
- 右辺は純粋な式に限ります。`use` や `fail` は書けず、失敗しうる関数やエフェクトを使う関数も呼べません（E0318、E0402）。純粋な関数の呼び出しは書けます（`const TIMEOUT = Duration.seconds(5)`）。
- 型は書いても省いてもかまいません（`const MAX: Int = 3`）。型を書いていない const の型は汎化します。`const EMPTY = []` は、どの要素型のリストとしても使えます。

### 評価は最初の参照で1回

右辺は、最初に参照したときに1回だけ評価し、その値を覚えます。起動時に全部を評価しないので、使っていない const の defect がプログラムやほかのテストを止めることはありません。

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

評価の途中の defect は、最初に参照したところで起き、文面に const の名前が入ります。defect も覚えるので、次の参照でも同じ defect が起きます。

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

### 循環

- 名前だけで循環している const（`const A = B` と `const B = A`）はコンパイル時のエラーです（E0231）。リストやタプルの中を通る循環も同じです。
- 関数の中を通る循環は実行時に見つけ、defect にします（`const A refers to itself while being evaluated`）。

```emela check=error
const A = B
const B = A     # E0231: constants refer to each other: `A` -> `B` -> `A`

fn main() {}
```

### パターンでの const

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

右辺が値だけでできた const は、網羅と冗長の判定でもその値として扱います。関数の呼び出しを含む const は、ガードの付いた腕と同じく網羅の判定に数えません。束縛のパターンには書けません（E0317）。詳しくは [パターンマッチ](/guide/pattern-matching/) にあります。
