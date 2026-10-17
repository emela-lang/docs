---
title: 型引数
description: 型引数の宣言と適用、推論と汎化、制約、エラーと効果の集合を受ける型引数
---

型引数を使うと、要素の型に依らない関数やデータを1つの定義で書けます。宣言も適用も `[ ]` で書きます。呼び出し側で型引数を書くことはなく、引数から推論します。

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

## 宣言と適用

- 型引数は、名前の後の `[A, B]` で宣言します。fn、type、enum、effect に書けます。
- 型に適用するときも `[ ]` です。`List[Int]`、`Option[User]`、`Pair[String, List[Int]]`
- 型引数を宣言できるのは `[ ]` の中だけで、参照できるのは型の位置だけです。宣言していない名前を型に書くと「未定義」のエラーです（`fn id(x: A) -> A` は E0211）。
- 型引数の数が合わなければ E0304 です（`List[Int, Int]`）。
- 関数の型引数は、呼び出しで書きません。`swap(p)` の `A` と `B` は `p` の型から決まります。

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

### 型名で書く型引数

型引数の名前は、大文字名（`A`、`T`）でも型名（`Item`、`Key`）でも書けます。意味のある名前を付けたいときは型名を使います。

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

型引数は、外側の同じ名前の型やエフェクトを隠します。型名で書いた型引数が既存の型を隠したときは、警告が出ます（W0201）。後から同じ名前の型を足したとき（Prelude への追加を含む）に、既存のコードの意味が黙って変わらないようにするためです。

```emela check
type Item(name: String)

fn first[Item](xs: List[Item]) -> Option[Item] {   # W0201: type parameter `Item` shadows an outer definition
  List.head(xs)
}

fn main() {
  dbg(first([1, 2]))    # Some(1)
}
```

## 推論と汎化

型は Hindley-Milner 方式で推論します。多相になる（どの型でも使える）のは、トップレベルの関数と const だけです。

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

ブロックの中の束縛は汎化しません。無名関数を変数に入れて、別の型で2回使うことはできません。

```emela check=error
fn main() {
  id = fn(x) { x }
  a = id(1)
  b = id("s")       # E0301: type mismatch: expected `Int`, found `String`
}
```

最初の `id(1)` で `x` の型が Int に決まります。いろいろな型で使いたい関数は、トップレベルの fn にします。

- トップレベルの fn の引数の型は必須なので、多相な関数は型引数を宣言して書きます。戻り値の型は推論に任せてもかまいません。
- 互いに呼び合う関数のまとまりの中では、単相の型で参照します。同じまとまりの中で同じ関数を別の型に使うことはできません（多相再帰はありません）。

## 制約

型引数に `[A: Ord]` の形で制約を書けます。制約は Trait の名前で、`+` で並べられます（`[A: Ord + Show]`）。

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

## 高カインド型はない

型引数に、型構成子そのもの（`List` や `Option` の、型を受け取る前の形）を渡すことはできません。`fn map[F, A, B](x: F[A], ...)` のように、「何かのコンテナ」を抽象する書き方はありません。`List.map` と `Option.map` は別々の関数です。

## エラーと効果の集合を受ける型引数

型引数は、ふつうの型のほかに、エラーの集合 E と効果の集合 R も受けられます。宣言の中で、失敗しうる関数や効果を使う関数をフィールドに持つときに使います。

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

- 宣言の中（type や enum のフィールドなど）に書いた関数型の `fails` と `use` を省くと、「失敗せず、効果も持たない」の意味になります。効果のある関数を持つときは、上のように型引数で明示します。そうすると、`Handler` が効果を持ちうることが型の名前 `Handler[E, R]` に現れます。
- 型引数がふつうの型か、エラーの集合か、効果の集合かは、使われた位置（`fails E`、`use R`）から推論します。種を書く構文はありません。
- 集合を渡すときの書き方は、fails 節と use 節にそろえます。`Handler[NotFound | Timeout, { Db, Log }]`、空なら `Handler[{}, {}]`。要素が1つなら囲まずに書けます（`Handler[NotFound, Console]`）。

位置ごとの省略の意味、集合の型引数の汎化と表示は [型の体系](/reference/type-system/) にあります。エラーとエフェクトそのものは [エラー](/guide/errors/) と [エフェクト](/guide/effects/) で説明します。
