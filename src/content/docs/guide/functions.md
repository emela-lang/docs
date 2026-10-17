---
title: 束縛と関数
description: 束縛と束縛し直し、ブロック、fn の宣言、引数名と名前付き引数、無名関数、関数の値、パイプ
---

Emela の文は束縛（`パターン = 式`）だけで、それ以外はすべて式です。関数は `fn` で宣言し、本体のブロックの最後の式が戻り値になります。呼び出しの形は `名前(引数)` の1種類で、関数も構成子も同じ規則に従います。

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

- 束縛は `パターン = 式` と書きます。`let` や `val` のような宣言のキーワードはありません。
- 変数は不変です。再代入はなく、同じ名前で束縛し直すと、以降は新しい束縛が見えます。前の値が書き換わるわけではないので、先に作った無名関数が捕まえた値は変わりません。
- `名前: 型 = 式` で型注釈を付けられます。省けば推論します。
- 右辺を先に解決してから左辺の名前を入れるので、`count = count + 1` の右辺の `count` は前の束縛です。

### 分割束縛

左辺には、タプルや構成子のパターンを書けます。

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

束縛のパターンは、必ず照合に成功するもの（反駁不能なもの）に限ります。`Some(x) = opt` のように失敗しうる形は E0317 になるので、[match](/guide/pattern-matching/) で書きます。

## ブロック

`{ ... }` はブロックで、最後の式の値がブロックの値です。最後が束縛なら、値は `()` です。

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

ブロックの中の束縛は、ブロックの外からは見えません。

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

- トップレベルの fn では、引数の型が必須です。省くと E0316 になります。
- 戻り値の型、`fails` 節、`use` 節は省けます。省いたときはコンパイラが推論します。
- 戻り値の型を書いたときは、`fails` 節に書いていないエラーを起こせません（`-> User` だけなら「失敗しない」）。詳しくは [エラー](/guide/errors/) にあります。
- `use` 節は書かなくても常に推論します。詳しくは [エフェクト](/guide/effects/) にあります。
- 本体の最後の式が戻り値です。`return` はありません。途中で抜けたいときは if や match で分岐を分けます。
- 公開する関数（`pub fn`）の戻り値の型と節は書いておくのが慣習です。省くと linter が警告し、LSP が推論した型を挿入できます。

```emela check=error
fn add(x, y: Int) -> Int {    # E0316: parameter `x` of a top-level function needs a type
  x + y
}
```

## 引数名と名前付き引数

仮引数の名前が、そのまま呼び出しで書く引数名になります。

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

- 位置引数を先に、名前付き引数を後に書きます。名前付きの後に位置引数を書くと E0120 です。
- 名前付き引数どうしの順序は自由です。
- 仮引数名は公開 API の一部です。名前を変えると、名前付きで呼んでいる側が壊れます。
- 名前を間違えると E0306（`no parameter named ...`）です。

### 引数名の省略

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

パターンでも同じで、`Point(x:, y:)` は `x` と `y` を束縛します。名前付きフィールドを持つ構成子も同じ規則に従うので、`Point(1, 2)` と `Point(x: 1, y: 2)` のどちらでも書けます。

### 名前付きで呼べる場所

名前付き引数で呼べるのは、次のときだけです。

- fn と構成子を名前で指して呼ぶとき（`connect(port: 1, host: "a")`）
- 能力の値の操作を呼ぶとき（`log.info(msg: "hi")`。引数名はエフェクトの操作の宣言の仮引数名）

局所変数や無名関数などの関数の値は仮引数の名前を持たないので、位置引数でだけ呼べます。関数型 `fn(Int) -> Int` に名前がないためです。

```emela check=error
fn main() {
  inc = fn(n: Int) { n + 1 }
  dbg(inc(n: 1))    # E0306: no parameter named `n`: a function value has no parameter names
}
```

## 無名関数

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

- 書き方は `fn(引数) { 本体 }` の1形式だけです。`x => x + 1` や `{ it + 1 }` のような短縮記法はありません。
- 引数の型は省けます（`fn(s: String) { ... }` と書いてもよい）。戻り値の型は書かず、本体から推論します。呼び出し先の引数の型から決まります（`List.map(users, fn(u) { u.name })` の `u` は `users` の要素の型）。
- 外側の変数を捕まえられます。変数は不変なので、捕まえた値が後で変わることはありません。

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

`x |> f(a)` は `f(x, a)` と同じです。左辺の値が、右辺の呼び出しの第1位置引数に入ります。右辺が呼び出しでなければ、`x |> f` は `f(x)` です。

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

- 同梱のライブラリは対象を第1引数に置いているので、`xs |> List.map(f)` の形で書けます。
- パイプは比較や `&&` より弱く結合します（[基本の型](/guide/types/) の優先順位の表）。
- 行頭の `|>` は前の行に続きます（[基本の構文](/guide/basics/)）。

## 関数型

関数の型は `fn(A, B) -> C` と書きます。後ろに `fails E` と `use R` を付けて、エラーとエフェクトを書けます。

```emela
fn(Int) -> String
fn(String) -> User fails NotFound use Db
fn(A) -> B fails {} use {}        # 失敗せず、効果も持たない関数だけ
```

引数の型に書いた `fn(A) -> B` は「どんなエラーと効果を持っていてもよい」という意味です。渡した関数のエラーと効果は、それを呼ぶ側にそのまま伝わります。`List.map(xs, f)` は、`f` が失敗しうるなら失敗しうる関数として、エフェクトを使うならそのエフェクトを使う関数として型が付きます。純粋版と効果版を分けて用意する必要はありません。

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

節の省略が位置によってどう読まれるか、型引数で集合を受ける書き方は、[エラー](/guide/errors/)、[エフェクト](/guide/effects/)、[型の体系](/reference/type-system/) にあります。
