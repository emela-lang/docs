---
title: 束縛と関数
description: 束縛と束縛し直し、ブロック、fn の宣言、局所関数、引数名と名前付き引数、無名関数、関数の値、パイプ、メソッド呼び出し
---

文は束縛（`パターン = 式`）だけで、ほかはすべて式です。関数は `fn` で宣言し、本体のブロックの最後の式が戻り値になります。

```emela check
fn area(width: Int, height: Int) -> Int {
  width * height
}

fn main() {
  w = 3
  h = 4
  dbg(area(w, h)) # 12
  dbg(area(width: 5, height: 2)) # 10
  dbg([1, 2, 3] |> List.map(|n| n * n)) # [1, 4, 9]
  ()
}
```

## 束縛

`let` や `val` のようなキーワードはなく、`名前 = 式` で値に名前を付けます。

```emela check
fn main() {
  count = 0
  count = count + 1 # 同じ名前で束縛し直す
  dbg(count) # 1

  (evens, odds) = List.partition([1, 2, 3, 4], |n| n % 2 == 0)
  dbg(evens) # [2, 4]
  dbg(odds) # [1, 3]

  pairs: List[(String, Int)] = List.zip(["a", "b"], [1, 2])
  dbg(pairs) # [("a", 1), ("b", 2)]
  ()
}
```

変数は不変で、再代入はありません。`count = count + 1` は前の値を書き換えるのではなく、同じ名前で新しく束縛し直します。右辺の `count` は前の束縛を指し、以降は新しい束縛が見えます。先に作った無名関数が捕まえた値は変わりません。

型注釈は `名前: 型 = 式` で付けます。省けば推論します。

左辺にはタプルや構成子のパターンも書けます。

```emela check
type User(id: Int, name: String)

fn main() {
  (x, y) = (1, 2)
  dbg(x + y) # 3

  user = User(id: 7, name: "alice")
  User(name:, ..) = user # name を取り出す
  dbg(name) # "alice"
  ()
}
```

書けるのは必ず照合に成功するパターンだけです。`Some(x) = opt` のように失敗しうる形は [match](/guide/pattern-matching/) で書きます。

## ブロック

`{ ... }` はブロックで、最後の式の値がブロックの値です。最後が束縛なら、値は `()` になります。

```emela check
fn main() {
  total = {
    a = 1
    b = 2
    a + b
  }
  dbg(total) # 3
  ()
}
```

ブロックの中の束縛はブロックの外からは見えません。

## fn の宣言

```emela check
error NotFound(id: Int)

type User(id: Int, name: String)

fn add(x: Int, y: Int) -> Int {
  x + y
}

fn greet(name: String) {
  "hello, #{name}" # 戻り値の型 String は推論する
}

fn find(id: Int) -> User fails NotFound {
  if id == 1 { User(id:, name: "alice") } else { fail NotFound(id:) }
}

fn main() {
  dbg(add(1, 2)) # 3
  dbg(greet("emela")) # "hello, emela"
  dbg(find(1) escape { NotFound(_) -> User(id: 0, name: "guest") })
  # User(id: 1, name: "alice")
  ()
}
```

fn では引数の型を必ず書きます。戻り値の型と、失敗を書く `fails` 節、エフェクトを書く `uses` 節は省けて、省けばコンパイラが推論します。

戻り値の型を書いたときは、`fails` 節に書いていないエラーを起こせません。`-> User` だけなら「失敗しない」という意味です（[エラー](/guide/errors/)）。`uses` 節は書かなくても推論します（[エフェクト](/guide/effects/)）。

`return` はありません。途中で抜けたいときは if や match で分岐を分けます。

## 局所関数

ブロックの中にも `fn` で名前の付いた関数を書けます。書き方はトップレベルの fn と同じで、引数の型を書きます。

```emela check
fn sum_to(n: Int) -> Int {
  fn go(i: Int, acc: Int) -> Int {
    if i > n { acc } else { go(i + 1, acc + i) } # n は外側の引数
  }
  go(1, 0)
}

fn main() {
  dbg(sum_to(100)) # 5050
  ()
}
```

局所関数の名前は、宣言の後と自分自身の本体の中で見えます。自分を呼べるので、補助の再帰をその関数の中に閉じ込められます。自分自身への末尾呼び出しはスタックを消費しません（[制御の流れ](/guide/control-flow/)）。宣言の時点で見えている変数は、無名関数と同じく捕まえます。

型引数は宣言できず、局所関数自体は多相になりません。外側の fn の型引数は使えます。宣言より前からは見えないので、局所関数どうしの相互再帰は書けません。ブロックの最後の文にも置けません。

## 引数名と名前付き引数

仮引数の名前がそのまま呼び出しで書く引数名になります。

```emela check
fn connect(host: String, port: Int) -> String {
  "#{host}:#{port}"
}

fn main() {
  dbg(connect("localhost", 5432)) # "localhost:5432"
  dbg(connect("localhost", port: 5432)) # "localhost:5432"
  dbg(connect(host: "localhost", port: 5432)) # "localhost:5432"
  dbg(connect(port: 5432, host: "localhost")) # "localhost:5432"
  ()
}
```

位置引数を先に、名前付き引数を後に書きます。名前付き引数どうしの順序は自由です。仮引数名は公開 API の一部なので、名前を変えると名前付きで呼んでいる側が壊れます。

変数名と引数名が同じときは、`名前:` だけ書けば値を省けます。

```emela check
error NotFound(id: Int)

type Point(x: Int, y: Int)

fn main() {
  id = 42
  x = 1
  y = 2
  dbg(NotFound(id:)) # NotFound(id: 42)
  dbg(Point(x:, y:)) # Point(x: 1, y: 2)
  ()
}
```

構成子も関数と同じ規則に従うので、`Point(1, 2)` と `Point(x: 1, y: 2)` のどちらでも書けます。パターンでも `Point(x:, y:)` は `x` と `y` を束縛します。

名前付きで呼べるのは、fn（局所関数も含む）と構成子を名前で指して呼ぶときと、`log.info(msg: "hi")` のように能力の値の操作を呼ぶときです。局所変数に入れた関数の値は仮引数の名前を持たないので、位置引数で呼びます。

```emela check=error
fn main() {
  inc = |n: Int| n + 1
  dbg(inc(n: 1))
}
```

```text
no parameter named `n`: a function value has no parameter names
```

## 無名関数

無名関数は `|引数| 本体` と書きます。引数がなければ `|| 本体` です。本体に文を並べるときは `|x| { ... }` とブロックにします。

```emela check
fn main() {
  inc = |n| n + 1
  dbg(inc(41)) # 42
  dbg(List.map([1, 2, 3], |n| n * 10)) # [10, 20, 30]
  dbg(List.fold([1, 2, 3], from: 0, f: |acc, n| acc + n)) # 6
  typed = |s: String| String.length(s)
  dbg(typed("abc")) # 3
  later = || 6 * 7
  dbg(later()) # 42
  ()
}
```

引数の型は省けて、渡す先の引数の型から決まります。`List.map(users, |u| u.name)` の `u` は `users` の要素の型です。戻り値の型は書かず、本体から推論します。

外側の変数も捕まえられます。変数は不変なので、捕まえた値が後で変わることはありません。

引数の位置には、必ず照合に成功するパターンも書けます。タプルの要素や構成子のフィールドを、引数を受けたその場で取り出せます。

```emela check
type User(id: Int, name: String)

fn main() {
  pairs = [("a", 1), ("b", 2)]
  dbg(List.map(pairs, |(key, value)| "#{key}=#{value}")) # ["a=1", "b=2"]
  users = [User(id: 1, name: "alice")]
  dbg(List.map(users, |User(name:, ..)| name)) # ["alice"]
  ()
}
```

無名関数は、呼び出しの引数や束縛の右辺に置いて使います。ブロックの途中に無名関数だけの文を置くと、値が必ず捨てられるのでエラーです。

## 関数の値

fn（トップレベルと局所）と、フィールドのある構成子は、呼ばずに名前を書くと関数の値になります。

```emela check
type Point(x: Int, y: Int)

fn double(n: Int) -> Int {
  n * 2
}

fn add(a: Int, b: Int) -> Int {
  a + b
}

fn main() {
  dbg(List.map([1, 2, 3], double)) # [2, 4, 6]
  dbg(List.map([1, 2], Some)) # [Some(1), Some(2)]
  dbg(List.map([1, 2, 3], Int.to_string)) # ["1", "2", "3"]
  dbg(List.fold([1, 2, 3], from: 0, f: add)) # 6
  make: fn(Int, Int) -> Point = Point
  dbg(make(1, 2)) # Point(x: 1, y: 2)
  ()
}
```

関数を返す関数も書けます。

```emela check
fn adder(n: Int) -> fn(Int) -> Int {
  |x| x + n
}

fn compose[A, B, C](f: fn(A) -> B, g: fn(B) -> C) -> fn(A) -> C {
  |x| g(f(x))
}

fn main() {
  add3 = adder(3)
  dbg(add3(4)) # 7
  show_double = compose(|n| n * 2, Int.to_string)
  dbg(show_double(21)) # "42"
  ()
}
```

## パイプ

`x |> f(a)` は `f(x, a)` と同じで、左辺の値が右辺の呼び出しの第1引数に入ります。右辺が呼び出しでなければ、`x |> f` は `f(x)` です。

```emela check
fn is_valid(n: Int) -> Bool {
  n >= 0
}

fn add(a: Int, b: Int) -> Int {
  a + b
}

fn main() {
  total = [3, -1, 4]
    |> List.filter(is_valid)
    |> List.fold(from: 0, f: add)
  dbg(total) # 7

  "emela" |> String.length |> dbg # 5
  ()
}
```

同梱のライブラリは対象を第1引数に置いているので、`xs |> List.map(f)` の形でつなげられます。

## メソッド呼び出し

`x.f(a)` は、`x` の型を定義したモジュールの関数 `f` を `M.f(x, a)` として呼びます。探すのは、そのモジュールの関数のうち最初の引数が `x` の型のものです。そのモジュールを `import` していなくても呼べます。

```emela check
type Point(x: Int, y: Int)

fn shifted(p: Point, by: Int) -> Point {
  Point(x: p.x + by, y: p.y + by)
}

fn main() {
  p = Point(x: 1, y: 2)
  dbg(p.shifted(by: 3).x) # 4
  dbg([1, 2, 3].map(|n| n * 10)) # [10, 20, 30]
  dbg("emela".length()) # 5
  ()
}
```

- `f` を探すのは、`x` の型のフィールド、その型を定義したモジュールの関数、呼ぶ側のモジュールから名前で見える Trait の `self` を取る関数の 3 つです（[Trait と導出](/guide/traits/)）。フィールドは関数の値として呼びます
- 名前付きの引数、評価の順、型に出るエラーと能力は `M.f(x, a)` と同じです
- 局所関数はメソッド呼び出しで見つかりません
- `x` の型がその時点で決まっていなければエラー（E3005）です。型の注釈を足して決めます

`xs.map(f)` と `xs |> List.map(f)` は同じ呼び出しです。`x` の型のモジュールにない関数（自分のモジュールの関数など）へつなげるときはパイプを使います。

## 関数型

関数の型は `fn(A, B) -> C` と書きます。後ろに `fails E` と `uses { R }` を付けて、エラーとエフェクトを書けます。

```emela
fn(Int) -> String
fn(String) -> User fails NotFound uses { Db }
fn(A) -> B fails {} uses {}       # 失敗せず、効果も持たない関数だけ
```

引数の型に `fn(A) -> B` と書くと、どんなエラーと効果を持つ関数でも受け取れます。渡した関数のエラーと効果は、それを呼ぶ側にそのまま伝わります。

```emela check
error Negative(n: Int)

fn check(n: Int) -> Int fails Negative {
  if n < 0 { fail Negative(n:) } else { n }
}

fn main() {
  ok = List.map([1, 2], check) escape { Negative(_) -> [] }
  dbg(ok) # [1, 2]
  bad = List.map([1, -2], check) escape { Negative(n:) -> [n] }
  dbg(bad) # [-2]
  ()
}
```

`check` は失敗しうるので、`List.map([1, 2], check)` も失敗しうる式になり、`escape` で受けています。`List.map` を純粋な版と失敗する版に分けて用意する必要はありません。

節を省いたときの意味の細かい規則は [型と効果の体系](/reference/type-system/) にあります。
