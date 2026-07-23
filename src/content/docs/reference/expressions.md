---
title: 式と制御フロー
description: block・if・論理/比較演算子・pipeline・優先順位
---

Emela は式指向です。block・`if`・[`match`](/reference/data-types/#match-式) はすべて **式** であり、
文と式の区別も明示的な `return` もありません。

## block

block は式です。

```emela
{
    let x = 1
    let y = 2
    x + y        -- block の値
}
```

- block の型・値は **最後の式** によります。最後が束縛のときは `Unit` に fallback します。
- 関数本体も block 式です。
- 明示的な `return` はありません。

## if

```text
if cond { then_block } else { else_block }
```

- `cond` の型は `Bool` でなければなりません。
- `then_block` と `else_block` は [block 式](#block)で、その型は一致しなければなりません。この共通型 `T` が `if` 全体の型です。
- **`else` 節は必須** です。
- 評価は `cond` を評価し、`true` なら then のみ、`false` なら else のみを評価します（選ばれない分岐は評価しません）。
- [effect](/reference/effects/) は `cond`・両分岐の和集合です（実行時に分岐が決まるため、型検査では両分岐を合算します）。
- 文的に使いたいときは両分岐を `Unit` にします。

`else if` は現状 `else { if ... }` で書きます。

## match

`match` は式です。網羅性・pattern guard を含む詳細は [データ型の match](/reference/data-types/#match-式) が定めます。

## 論理演算子

`! && ||` は `Bool` 専用の **言語組み込み** で、トレイトメソッドへ desugar しません。

- `!e`：前置。`e` は `Bool`、結果は `Bool`。
- `a && b` ≡ `if a { b } else { false }`。
- `a || b` ≡ `if a { true } else { b }`。
- 両オペランドは `Bool`。`&&` / `||` は **短絡評価** します。
- effect は `effects(a) ∪ effects(b)`。

## 導出比較演算子

次の等価が規範です。新しいトレイトは導入せず、既存の [`Eq.eq` / `Ord.lt`](/reference/traits/#演算子のトレイト化) へ desugar します。

| 式 | 等価な式 | 経由するトレイト |
|---|---|---|
| `a != b` | `!(a == b)` | `Eq.eq` |
| `a > b` | `b < a` | `Ord.lt` |
| `a <= b` | `!(b < a)` | `Ord.lt` |
| `a >= b` | `!(a < b)` | `Ord.lt` |

- オペランド型への要求は `==` / `<` と同一です（`Eq` / `Ord` の instance が in-scope に必要）。ユーザー型に `impl Ord` を与えれば `> <= >=` も使えます。
- desugar は構文変換であり、評価回数・評価順（左→右）を変えません。`a > b` は `b < a` へ desugar されますが、評価は `a`、`b` の順です。

## pipeline `|>`

左辺の値を右辺呼び出しの第一引数へ流し込む純粋な糖衣です。型・effect・throws・実行時の意味はすべて脱糖後の呼び出しと一致します。

- **第一引数挿入**：右辺が呼び出し `f(a1, …, an)`（n ≥ 0）のとき、`lhs |> f(a1, …, an)` ≡ `f(lhs, a1, …, an)`。
- **bare 右辺**：右辺が呼び出しでない式 `e` のとき、`lhs |> e` ≡ `e(lhs)`。`e` は関数値に評価される必要があります。
- **最低優先順位・左結合**：`a |> f |> g` ≡ `g(f(a))`。`a + b |> f` ≡ `f(a + b)`。
- **末尾 `?`**：右辺末尾の [error 伝播 `?`](/reference/errors/#-operator) は挿入の **後** に適用します。`lhs |> g?` ≡ `(lhs |> g)?`。
- **評価順**：脱糖後の呼び出しに従い、左辺は常に最初に、ちょうど一度だけ評価されます。

```emela
xs |> map(double) |> filter(is_even) |> fold(0, add)
-- fold(filter(map(xs, double), is_even), 0, add)
```

## 優先順位

強い順（すべて左結合）：

```text
1. !                    (前置)
2. * / %
3. + - ++
4. == != < > <= >=
5. &&
6. ||
7. |>                   (最低)
```

- 比較（4）は算術（2, 3）より弱い：`a + 1 < b * 2` は `(a + 1) < (b * 2)`。
- `&&` は `||` より強い：`a || b && c` は `a || (b && c)`。
- 連鎖比較 `a < b < c` は `(a < b) < c` と解釈され、`Bool` に `Ord` が無いため通常は型エラーになります（連鎖比較構文はありません）。
