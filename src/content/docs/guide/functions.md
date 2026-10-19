---
title: 束縛と関数
description: 束縛と束縛し直し、ブロック、fn の宣言、引数名と名前付き引数、無名関数、関数の値、パイプ
---

文は束縛（`パターン = 式`）だけで、ほかはすべて式です。関数は `fn` で宣言し、本体のブロックの最後の式が戻り値になります。

```emela check
fn area(width: Int, height: Int) -> Int {
  width * height
}

fn main() {
  w = 3
  h = 4
  dbg(area(w, h))                   # 12
  dbg(area(width: 5, height: 2))    # 10
  dbg([1, 2, 3] |> List.map(fn(n) { n * n }))   # [1, 4, 9]
}
```

## 束縛

`let` や `val` のようなキーワードはなく、`名前 = 式` で値に名前を付けます。

```emela check
fn main() {
  count = 0
  count = count + 1             # 同じ名前で束縛し直す
  dbg(count)                    # 1

  (evens, odds) = List.partition([1, 2, 3, 4], fn(n) { n % 2 == 0 })
  dbg(evens)                    # [2, 4]
  dbg(odds)                     # [1, 3]

  pairs: List[(String, Int)] = List.zip(["a", "b"], [1, 2])
  dbg(pairs)                    # [("a", 1), ("b", 2)]
}
```

変数は不変で、再代入はありません。`count = count + 1` は前の値を書き換えるのではなく、同じ名前で新しく束縛し直します。右辺の `count` は前の束縛を指し、以降は新しい束縛が見えます。先に作った無名関数が捕まえた値は変わりません。

型注釈は `名前: 型 = 式` で付けます。省けば推論します。

左辺にはタプルや構成子のパターンも書けます。

```emela check
type User(id: Int, name: String)

fn main() {
  (x, y) = (1, 2)
  dbg(x + y)                    # 3

  user = User(id: 7, name: "alice")
  User(name:, ..) = user        # name を取り出す
  dbg(name)                     # "alice"
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
  dbg(total)        # 3
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
  "hello, #{name}"              # 戻り値の型 String は推論する
}

fn find(id: Int) -> User fails NotFound {
  if id == 1 { User(id:, name: "alice") } else { fail NotFound(id:) }
}

fn main() {
  dbg(add(1, 2))                # 3
  dbg(greet("emela"))           # "hello, emela"
  dbg(find(1) escape { NotFound(_) -> User(id: 0, name: "guest") })
  # User(id: 1, name: "alice")
}
```

トップレベルの fn では引数の型を必ず書きます。戻り値の型と、失敗を書く `fails` 節、エフェクトを書く `use` 節は省けて、省けばコンパイラが推論します。

戻り値の型を書いたときは、`fails` 節に書いていないエラーを起こせません。`-> User` だけなら「失敗しない」という意味です（[エラー](/guide/errors/)）。`use` 節は書かなくても推論します（[エフェクト](/guide/effects/)）。

`return` はありません。途中で抜けたいときは if や match で分岐を分けます。

## 引数名と名前付き引数

仮引数の名前がそのまま呼び出しで書く引数名になります。

```emela check
fn connect(host: String, port: Int) -> String {
  "#{host}:#{port}"
}

fn main() {
  dbg(connect("localhost", 5432))               # "localhost:5432"
  dbg(connect("localhost", port: 5432))         # "localhost:5432"
  dbg(connect(host: "localhost", port: 5432))   # "localhost:5432"
  dbg(connect(port: 5432, host: "localhost"))   # "localhost:5432"
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
  dbg(NotFound(id:))        # NotFound(id: 42)
  dbg(Point(x:, y:))        # Point(x: 1, y: 2)
}
```

構成子も関数と同じ規則に従うので、`Point(1, 2)` と `Point(x: 1, y: 2)` のどちらでも書けます。パターンでも `Point(x:, y:)` は `x` と `y` を束縛します。

名前付きで呼べるのは、fn と構成子を名前で指して呼ぶときと、`log.info(msg: "hi")` のように能力の値の操作を呼ぶときです。局所変数に入れた関数の値は仮引数の名前を持たないので、位置引数で呼びます。

```emela check=error
fn main() {
  inc = fn(n: Int) { n + 1 }
  dbg(inc(n: 1))
}
```

```text
no parameter named `n`: a function value has no parameter names
```

## 無名関数

無名関数は `fn(引数) { 本体 }` と書きます。`x => x + 1` のような短縮記法はありません。

```emela check
fn main() {
  inc = fn(n) { n + 1 }
  dbg(inc(41))                                  # 42
  dbg(List.map([1, 2, 3], fn(n) { n * 10 }))    # [10, 20, 30]
  dbg(List.fold([1, 2, 3], from: 0, f: fn(acc, n) { acc + n }))  # 6
  typed = fn(s: String) { String.length(s) }
  dbg(typed("abc"))                             # 3
}
```

引数の型は省けて、渡す先の引数の型から決まります。`List.map(users, fn(u) { u.name })` の `u` は `users` の要素の型です。戻り値の型は書かず、本体から推論します。

外側の変数も捕まえられます。変数は不変なので、捕まえた値が後で変わることはありません。

## 関数の値

トップレベルの fn と、フィールドのある構成子は、呼ばずに名前を書くと関数の値になります。

```emela check
type Point(x: Int, y: Int)

fn double(n: Int) -> Int {
  n * 2
}

fn add(a: Int, b: Int) -> Int {
  a + b
}

fn main() {
  dbg(List.map([1, 2, 3], double))          # [2, 4, 6]
  dbg(List.map([1, 2], Some))               # [Some(1), Some(2)]
  dbg(List.map([1, 2, 3], Int.to_string))   # ["1", "2", "3"]
  dbg(List.fold([1, 2, 3], from: 0, f: add))  # 6
  make: fn(Int, Int) -> Point = Point
  dbg(make(1, 2))                           # Point(x: 1, y: 2)
}
```

関数を返す関数も書けます。

```emela check
fn adder(n: Int) -> fn(Int) -> Int {
  fn(x) { x + n }
}

fn compose[A, B, C](f: fn(A) -> B, g: fn(B) -> C) -> fn(A) -> C {
  fn(x) { g(f(x)) }
}

fn main() {
  add3 = adder(3)
  dbg(add3(4))                                # 7
  show_double = compose(fn(n) { n * 2 }, Int.to_string)
  dbg(show_double(21))                        # "42"
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
  dbg(total)                    # 7

  "emela" |> String.length |> dbg   # 5
}
```

同梱のライブラリは対象を第1引数に置いているので、`xs |> List.map(f)` の形でつなげられます。

## 関数型

関数の型は `fn(A, B) -> C` と書きます。後ろに `fails E` と `use R` を付けて、エラーとエフェクトを書けます。

```emela
fn(Int) -> String
fn(String) -> User fails NotFound use Db
fn(A) -> B fails {} use {}        # 失敗せず、効果も持たない関数だけ
```

引数の型に `fn(A) -> B` と書くと、どんなエラーと効果を持つ関数でも受け取れます。渡した関数のエラーと効果は、それを呼ぶ側にそのまま伝わります。

```emela check
error Negative(n: Int)

fn check(n: Int) -> Int fails Negative {
  if n < 0 { fail Negative(n:) } else { n }
}

fn main() {
  ok = List.map([1, 2], check) escape { Negative(_) -> [] }
  dbg(ok)                           # [1, 2]
  bad = List.map([1, -2], check) escape { Negative(n:) -> [n] }
  dbg(bad)                          # [-2]
}
```

`check` は失敗しうるので、`List.map([1, 2], check)` も失敗しうる式になり、`escape` で受けています。`List.map` を純粋な版と失敗する版に分けて用意する必要はありません。

節を省いたときの意味の細かい規則は [型と効果の体系](/reference/type-system/) にあります。
