---
title: 制御の流れ
description: if 式、&& と || の短絡、再帰と List の関数による繰り返し、末尾呼び出しの保証
---

Emela の分岐は `if` と `match` の2つで、どちらも値を返す式です。for や while はなく、繰り返しは再帰か `List.map` や `List.fold` のような関数で書きます。自分自身への末尾呼び出しはスタックを消費しないことが保証されているので、深い再帰もループと同じように書けます。

```emela check
fn sum(xs: List[Int], acc: Int) -> Int {
  xs match {
    [] -> acc
    [x, ..rest] -> sum(rest, acc + x)    # 末尾呼び出し
  }
}

fn main() {
  dbg(sum(List.range(1, 10001), 0))    # 50005000
}
```

## if

```emela check
error Invalid(input: String)

fn sign(n: Int) -> String {
  if n > 0 { "positive" } else if n < 0 { "negative" } else { "zero" }
}

fn validate(input: String) -> String fails Invalid {
  if String.length(input) == 0 { fail Invalid(input:) }
  input
}

fn main() {
  dbg(sign(-3))                               # "negative"
  label = if 3 > 0 { "あり" } else { "なし" }
  dbg(label)                                  # "あり"
  dbg(validate("ok") escape { Invalid(_) -> "?" })   # "ok"
}
```

- if は式です。条件の型は Bool に限ります。数値や Option を条件にはできません。
- 条件を囲む括弧は要りません。本体の `{ }` は省けません。
- 値として使うときは `else` が必須です。両方の分岐の型がそろっている必要があります。
- `else` のない if の型は `()` です。本体の型も `()` か Never でなければなりません。`if !valid { fail Invalid(input:) }` のように、条件付きで抜けるときに使います。
- `else if` で続けられます。`else` は次の行の先頭に書いても前の行に続きます。

```emela check=error
fn main() {
  x = if True { 1 }     # E0301: type mismatch: expected `()`, found `Int`
}
```

### 三項演算子はない

`c ? a : b` はありません。if がそのまま式なので、`if c { a } else { b }` と書きます。

## && と || の短絡

`&&` と `||` は左から評価し、結果が決まった時点で右辺を評価しません。

```emela check
fn crash() -> Bool {
  panic("evaluated")
}

fn main() {
  dbg(False && crash())     # False   crash は呼ばれない
  dbg(True || crash())      # True
}
```

`a && b` は `if a { b } else { False }`、`a || b` は `if a { True } else { b }` と同じ意味です。否定は `!x` です。

## 繰り返し

ループの構文はありません。リストを処理するときは、まず `List` の関数を使います。

```emela check
type Item(name: String, price: Int)

fn main() {
  items = [Item(name: "pen", price: 120), Item(name: "book", price: 1500), Item(name: "cup", price: 800)]

  names = List.map(items, fn(i) { i.name })
  dbg(names)                          # ["pen", "book", "cup"]

  cheap = List.filter(items, fn(i) { i.price < 1000 })
  dbg(List.length(cheap))             # 2

  total = List.fold(items, from: 0, f: fn(acc, i) { acc + i.price })
  dbg(total)                          # 2420

  dbg(List.any(items, fn(i) { i.price > 1000 }))   # True
  dbg(List.range(0, 5))               # [0, 1, 2, 3, 4]
}
```

決まった回数の繰り返しは `List.range(from, to)` で作ったリストに関数を当てるか、再帰で書きます。リストの関数の一覧は [core のモジュール](/std/core/) にあります。

### 再帰

```emela check
fn count_down(n: Int, acc: List[Int]) -> List[Int] {
  if n == 0 { acc } else { count_down(n - 1, [n, ..acc]) }
}

fn gcd(a: Int, b: Int) -> Int {
  if b == 0 { a } else { gcd(b, a % b) }
}

fn main() {
  dbg(count_down(5, []))      # [1, 2, 3, 4, 5]
  dbg(gcd(48, 18))            # 6
}
```

関数は、宣言の順序に関係なく、同じモジュールのほかの関数と自分自身を呼べます。

## 自己末尾呼び出しの保証

自分自身への末尾呼び出しは、スタックを消費しないことがすべてのターゲットで保証されています。suspend な操作を含む関数でも同じです。100万回の再帰でもスタックはあふれません。

```emela check
fn count(n: Int, acc: Int) -> Int {
  if n == 0 { acc } else { count(n - 1, acc + 1) }
}

fn all_positive(xs: List[Int]) -> Bool {
  xs match {
    [] -> True
    [x, ..rest] -> x > 0 && all_positive(rest)   # && の右辺も末尾位置
  }
}

fn main() {
  dbg(count(1000000, 0))                       # 1000000
  dbg(all_positive(List.range(1, 1000000)))    # True
}
```

末尾でない再帰（`x + sum(rest)` のように、呼んだ後に計算が残るもの）の深さの上限は実装に依ります。深くなりうるときは、累積の引数を足して末尾呼び出しの形にします。

### 末尾位置

次の位置が末尾位置です。

- 関数の本体のブロックの最後の式
- 末尾位置にある if の両方の分岐、match の各腕の本体、ブロックの最後の式
- 末尾位置にある `&&` と `||` の右辺

次の中は、見た目が最後の式でも末尾位置ではありません。

- 無名関数の本体（そもそも自分自身への呼び出しにならない）
- `escape` の対象の式（後で escape の腕が走りうる）
- `with` の本体（後でハンドラの release が走る）

```emela check
error Retry

fn attempt(n: Int) -> Int fails Retry {
  if n < 3 { fail Retry } else { n }
}

fn retry(n: Int) -> Int {
  attempt(n) escape {
    Retry -> retry(n + 1)        # 腕の本体は末尾位置
  }
}

fn main() {
  dbg(retry(0))     # 3
}
```

上の `retry(n + 1)` は escape の腕の本体にあるので末尾位置です。逆に `retry(n + 1) escape { ... }` のように escape の対象の側に置いた呼び出しは、腕が後に走りうるので末尾位置ではありません。escape の対象と with の本体の中の、末尾呼び出しに見える自分自身への呼び出しは、linter が「保証されない」と警告します。

### 相互再帰は保証しない

2つ以上の関数が互いを末尾で呼ぶ形（相互再帰）は、スタックを消費しないことを保証しません。

```emela check
fn is_even(n: Int) -> Bool {
  if n == 0 { True } else { is_odd(n - 1) }
}

fn is_odd(n: Int) -> Bool {
  if n == 0 { False } else { is_even(n - 1) }
}

fn main() {
  dbg(is_even(10))      # True
}
```

`is_even(1000000)` は JavaScript のターゲットでスタックがあふれます。深くなりうる相互再帰は、1つの関数にまとめて状態を引数で渡す形に書き直します。仕様では、コンパイラが相互再帰の末尾呼び出しを検出して警告することになっていますが、今のコンパイラ（0.20.1）はまだ警告しません。

## return はない

途中で関数を抜ける `return`、ループの `break` と `continue` はありません。関数の値は常に本体の最後の式です。早く抜けたい場合は次のどれかで書きます。

- 分岐を if や match で分け、それぞれの分岐の最後に値を置く
- 失敗として抜けるなら `fail`（[エラー](/guide/errors/)）
- 条件付きで抜けるだけなら `if 条件 { fail ... }` を本体の先頭に並べる

## match

値の形で分けるときは `match` を使います。後置で `式 match { 腕 }` と書きます。

```emela check
fn describe(n: Int) -> String {
  n match {
    0 -> "zero"
    n if n < 0 -> "negative"
    _ -> "positive"
  }
}

fn main() {
  dbg(describe(-2))     # "negative"
}
```

パターンの種類と網羅性の検査は [パターンマッチ](/guide/pattern-matching/) にあります。
