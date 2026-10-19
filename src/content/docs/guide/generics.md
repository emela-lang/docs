---
title: 型引数
description: 型引数の宣言と適用、推論と汎化、制約、エラーと効果の集合を受ける型引数
---

型引数を使うと、要素の型に依らない関数やデータを1つの定義で書けます。宣言も適用も `[ ]` で書き、呼び出し側では書かずに引数から推論します。

```emela check
type Pair[A, B](first: A, second: B)

fn swap[A, B](p: Pair[A, B]) -> Pair[B, A] {
  Pair(first: p.second, second: p.first)
}

fn main() {
  p = Pair(first: 1, second: "one")
  dbg(swap(p))                  # Pair(first: "one", second: 1)
  dbg(swap(Pair(first: True, second: 2.5)))   # Pair(first: 2.5, second: True)
}
```

`swap[A, B]` のように名前の後に型引数を宣言します。fn、type、enum、effect に書けます。型に適用するときも `[ ]` を使い、`List[Int]`、`Pair[String, List[Int]]` のようになります。`swap(p)` の `A` と `B` は `p` の型から決まります。

```emela check
enum Tree[A] {
  Leaf
  Node(Tree[A], A, Tree[A])
}

fn size[A](t: Tree[A]) -> Int {
  t match {
    Leaf -> 0
    Node(l, _, r) -> size(l) + 1 + size(r)
  }
}

fn main() {
  t = Node(Node(Leaf, 1, Leaf), 2, Leaf)
  dbg(size(t))      # 2
}
```

型引数の名前は `A` や `T` のような大文字名のほか、`Key` や `Item` のような型名でも書けます。意味のある名前を付けたいときは型名を使います。

```emela check
fn group_first[Key, Value](pairs: List[(Key, Value)]) -> Option[Key] {
  pairs match {
    [(k, _), ..] -> Some(k)
    [] -> None
  }
}

fn main() {
  dbg(group_first([("a", 1), ("b", 2)]))    # Some("a")
}
```

型名で書いた型引数が外側の同じ名前の型を隠すと、警告が出ます。

```emela check
type Item(name: String)

fn first[Item](xs: List[Item]) -> Option[Item] {   # type parameter `Item` shadows an outer definition
  List.head(xs)
}

fn main() {
  dbg(first([1, 2]))    # Some(1)
}
```

## 推論と汎化

型は Hindley-Milner 方式で推論します。どの型でも使える多相な定義になるのは、トップレベルの関数と const だけです。

```emela check
fn wrap[A](x: A) {
  [x]                   # 戻り値の型 List[A] は推論する
}

const EMPTY = []

fn main() {
  dbg(wrap(1))          # [1]
  dbg(wrap("s"))        # ["s"]
  ints: List[Int] = EMPTY
  strings: List[String] = EMPTY
  dbg(ints)             # []
}
```

トップレベルの fn は引数の型を省けないので、多相な関数は型引数を宣言して書きます。戻り値の型は推論に任せられます。

ブロックの中の束縛は多相になりません。無名関数を変数に入れて、別の型で2回使うとエラーです。

```emela check=error
fn main() {
  id = fn(x) { x }
  a = id(1)
  b = id("s")
}
```

```text
type mismatch: expected `Int`, found `String`
```

最初の `id(1)` で `x` の型が Int に決まります。いろいろな型で使いたい関数はトップレベルの fn にします。

## 制約

型引数に `[A: Ord]` の形で制約を書けます。制約は Trait の名前で、`[A: Ord + Show]` のように `+` で並べます。

```emela
fn max_of[A: Ord](a: A, b: A) -> A {
  if a > b { a } else { b }
}
```

Prelude には Eq、Ord、Show、Hash の4つの Trait があります。`==` は Eq、`<` は Ord、文字列の補間は Show を求めます。

:::caution[0.21 で入る予定]
`trait`、`impl`、`derive` と、制約の検査は 0.21 で入ります。今のコンパイラは `[A: Ord]` の構文を受け付けますが、制約を検査せず、型引数の値に `<` や `>` を使う関数（上の `max_of`）はまだコンパイルできません。`==` と補間は構造のまま、すべての型で動きます。Trait の詳細は [Trait](/guide/traits/) にあります。
:::

効果の集合に付ける `Immediate` の制約（`[R: Immediate]`）は 0.20 で動きます。中断しない関数だけを受けたい場所で使います（[外部関数](/guide/external/)）。

`List` や `Option` のような型構成子そのものを型引数に渡すこと（高カインド型）はできません。`List.map` と `Option.map` は別々の関数です。

## エラーと効果の集合を受ける

型引数はふつうの型のほかに、エラーの集合と効果の集合も受けられます。失敗しうる関数や効果を使う関数をフィールドに持つ型を作るときに使います。

```emela check
import Std.Console.{Console, SystemConsole}

type Request(path: String)
type Response(status: Int, body: String)

error NotFound(path: String)

type Handler[E, R](run: fn(Request) -> Response fails E use R)

fn hello(req: Request) -> Response {
  Response(status: 200, body: "hello #{req.path}")
}

fn logged(req: Request) -> Response fails NotFound use Console {
  out = use Console
  out.print_line("GET #{req.path}")
  if req.path == "/" { Response(status: 200, body: "ok") } else { fail NotFound(path: req.path) }
}

fn serve[E, R](h: Handler[E, R], req: Request) -> Response fails E use R {
  h.run(req)
}

fn main() {
  pure: Handler[{}, {}] = Handler(run: hello)
  dbg(serve(pure, Request(path: "/a")))     # Response(status: 200, body: "hello /a")

  noisy: Handler[NotFound, Console] = Handler(run: logged)
  with SystemConsole {
    r = serve(noisy, Request(path: "/x")) escape {
      NotFound(path:) -> Response(status: 404, body: path)
    }
    dbg(r)                                  # Response(status: 404, body: "/x")
  }
}
```

type のフィールドに書いた関数型で `fails` と `use` を省くと、「失敗せず、効果も持たない」の意味になります。効果のある関数を持たせるときは、上の `Handler[E, R]` のように型引数で受けます。`E` がエラーの集合で `R` が効果の集合だということは、`fails E` と `use R` という使われ方から推論されます。

集合を渡すときは fails 節と use 節と同じ形で、`Handler[NotFound | Timeout, { Db, Log }]` と書きます。空なら `Handler[{}, {}]`、要素が1つなら `Handler[NotFound, Console]` のように囲まずに書けます。

細かい規則は [型と効果の体系](/reference/type-system/) にあります。
