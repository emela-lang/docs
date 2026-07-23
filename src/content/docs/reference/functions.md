---
title: 束縛と関数
description: 不変束縛・第一級関数・クロージャ・自己末尾呼び出し
---

束縛は不変で、反復は再帰で書きます。関数は第一級の値で、その型は引数型・戻り値型に加えて
[`throws`](/reference/errors/) と [`uses`](/reference/effects/) を持ちます。

## 束縛

変数はすべて **不変** です。再代入はできません。束縛には `let` を用います。

```emela
let x = 1
let y = x + 1
```

## 関数定義

```emela
fn add(x: Int, y: Int) -> Int {
    x + y
}
```

- `fn` で関数を定義します。本体は [block 式](/reference/expressions/#block)です。
- 関数は **第一級の値** です。名前付き関数は関数値への束縛と解釈できます。
- 関数は lexical scope を持ちます。トップレベル関数の再帰・相互再帰が使えます。
- 引数は **左から右へ** 評価します。`f(g(), h())` は `g()` → `h()` → `f(...)` の順で、各式はちょうど一度だけ評価されます。
- カリー化・部分適用はありません。多引数関数の連鎖は [pipeline `|>`](/reference/expressions/#pipeline-) で書きます。

## 関数値・クロージャ

関数は値であり、束縛・引数渡し・戻り値にできます。無名関数の構文：

```emela
fn (parameter_list) -> ReturnType uses EffectRow { block }
```

無名関数は外側の lexical scope の値を capture できます（クロージャ）。

```emela
fn make_adder(n: Int) -> ((Int) -> Int uses {}) uses {} {
    fn (x: Int) -> Int uses {} { x + n }   -- n を capture
}
```

関数を返す関数型は括弧で明確化します（`((Int) -> Int uses {}) uses {}`）。

## 関数型

関数型は引数型・戻り値型・[`throws E`](/reference/errors/#throws-と-throw)・[`uses F`](/reference/effects/#関数型の-effect-row) からなります。

```text
(A, B) -> T throws E uses F
```

- `uses {}`（純粋）は省略できます。`(Int) -> Int uses {}` と `(Int) -> Int` は等価です。
- `throws` / `uses` は型の一部です。これらが異なる関数型は異なる型です。ただし effect row の[部分集合方向の適合（subsumption）](/reference/effects/#subsumption-と-row-拡張)は許されます。
- effect row を型変数で受ける総称版は [effect-row 多相](/reference/effects/#effect-row-多相)、型パラメータ付きは [ジェネリクス](/reference/generics/) が定めます。

```emela
fn apply<T>(x: T, f: (T) -> T uses 'e) -> T uses 'e { f(x) }
```

## 自己末尾呼び出し

Emela はループ構文を持たず、反復は再帰で書きます。無限に回る処理（サーバーの accept ループなど）を書けるよう、
**自己末尾呼び出しはスタックを消費しないことが保証** されます。

- **保証**：トップレベル関数 `f` の本体の **末尾位置** にある `f` 自身への直接呼び出し（ベア名 `f(...)`）は、スタックを消費しません。深さによらず一定のスタックで実行されます。
- これは最適化ではなく **規範的な保証** です。観測可能な意味・評価順・effect row・`throws` は不変です。
- **末尾位置** は構文的に定まります：関数本体 block の最終式／末尾位置の block の最終式／末尾位置の `if` の両分岐の最終式／末尾位置の `match` の各 arm 本体の最終式／末尾位置の `try`–`catch` の各 **catch arm** 本体の最終式。`try` block の内部・`?` の対象・引数位置・演算子の被演算子・pipeline の左辺は **末尾位置ではありません**。
- **対象外**：相互再帰、関数値経由の呼び出し、トレイトメソッド経由の呼び出し、末尾位置にない自己呼び出し。

```emela
fn count_down(n: Int) -> Unit uses { Io } {
    if n == 0 {
        Io.print("done\n")
    } else {
        Io.print(n)
        count_down(n - 1)   -- 末尾位置：スタックを消費しない
    }
}

fn fact(n: Int) -> Int uses {} {
    if n == 0 { 1 } else { n * fact(n - 1) }   -- `*` の被演算子：末尾位置ではない
}
```
