---
title: 値と型
description: 値・型の分類とプリミティブ演算の意味論
---

Emela の値と型、その実行時分類、プリミティブ演算の観測可能な意味を定めます。
null は持たず、値の不在は [`Option`](/reference/data-types/#option) で表します。
所有権・借用・move は導入しません。

## 型の分類

| 型 | 分類 | 実行時表現 |
|---|---|---|
| `Unit` `Bool` `Int` `Float` `Char` | primitive | 値（コピー可能） |
| `String` `Array<T>` `Record` `Enum` payload・closure 環境 | heap | ランタイム管理の参照 |

- **primitive 値** はコピー可能です。
- **heap 値** はランタイムが参照として管理します。メモリは非循環ヒープで、所有権・借用・move はありません。
- null はありません。nullable な値は `Option<T>` で表します。

## Int

`Int` は `i32`（32bit・2の補数・符号付き）に固定されています。

- 算術 `+ - *` は **modulo 2³² で wrap** します。overflow は trap も panic もしません。例：`2147483647 + 1 == -2147483648`。WASM の `i32.add` などと一致し、全 backend で同じ結果になります。
- 除算 `/` は **0方向への切り捨て**（truncated）。例：`7 / 2 == 3`、`-7 / 2 == -3`。
- 剰余 `%` は被除数の符号を持ち、`a == (a / b) * b + (a % b)` を満たします。例：`7 % 2 == 1`、`-7 % 2 == -1`。
- **0 による整数の除算・剰余は panic** します（[回復不能](/reference/errors/#panic)）。
- **`-2147483648 / -1` は panic** します（結果が i32 で表現できないため）。`-2147483648 % -1` は `0` です。
- checked / saturating 算術は言語組み込みには無く、必要なら stdlib 関数として使います。

## Float

`Float` は `f64`（IEEE-754 binary64）に固定です。演算は IEEE-754 に従います（`inf` / `nan` を含む）。

- `/` は実数除算。`Float / 0.0` は IEEE-754 に従い（`inf` / `nan`）**trap しません**。
- `%` は `Float` には使えません（`%` は `Int % Int -> Int` のみ）。

## Bool・Unit

- `Bool` は `true` / `false`。論理演算子と `if` の条件は `Bool` を要求します（→ [式と制御フロー](/reference/expressions/)）。
- `Unit` は値を1つだけ持つ型。block の最終式が束縛のときなど、値を持たない位置の型になります。

## Char・String

- **`Char`** は1つの Unicode scalar value を表す primitive 型（コピー可能）です。文字リテラルは `'x'`（エスケープは `\n \t \\ \' \"`）。
- **`String`** は immutable なテキストです。内部表現は UTF-8 のバイト列ですが、**ユーザーから見える要素と長さの単位は Unicode scalar value（`Char`）** で、バイトではありません。添字・長さ・部分文字列はすべて scalar 単位で数えます。

純粋操作（すべて `uses {}`、`throws` 無し）：

```emela
a ++ b                          -- String ++ String -> String（連結。新しい String を生成し両辺は不変）
char_from_code(n: Int) -> Char  -- コードポイント n の Char
string_from_char(c: Char) -> String  -- 1文字の String
```

## Array

`Array<T>` は **固定長・不変** の配列です。要素は同一型 `T`。`array_push` は末尾に足した **新しい配列** を返します（元は変更しません）。

基本操作は [intrinsic](/reference/runtime-boundary/#intrinsic純粋演算)（Core Prelude が宣言）と、その安全ラッパで供給されます。

```emela
intrinsic fn array_length<T>(a: Array<T>) -> Int uses {}
intrinsic fn array_get_unchecked<T>(a: Array<T>, i: Int) -> T uses {}   -- 0 <= i < length 前提
intrinsic fn array_push<T>(a: Array<T>, x: T) -> Array<T> uses {}
```

安全な添字アクセスは `array_get<T>(a: Array<T>, i: Int) -> Option<T>` です。範囲外は `None` を返し、panic しません。

配列リテラルは `[1, 2, 3]` の形です。要素型が文脈から決まらない空配列は型注釈が要ります（`let empty: Array<T> = []`）。

## Bytes

`Bytes` は **解釈を持たない生バイトの列**（immutable）です。要素は byte（`Int` で 0–255）で、長さ・添字はすべて **byte 単位** で数えます（`String` の scalar 単位と対比）。

- 基本操作は intrinsic ＋ `std.bytes` の安全ラッパ：`bytes_length` / `bytes_get_unchecked` / `bytes_slice`（半開区間 `[start, end)`、範囲はクランプ）/ `bytes_concat`、`byte_at(b, i) -> Option<Int>`（範囲外は `None`）。
- `String` ⇄ `Bytes`：`to_bytes(s) -> Bytes`（UTF-8 encode、全域）／`string_from_bytes(b) -> Option<String>`（UTF-8 decode、不正なら `None`）。
- 演算子 `++`（`Concat`）と `==`（`Eq`、byte 列の逐次比較）が使えます。
- 空の `Bytes` は `to_bytes("")` で得ます（専用リテラル `b"..."` は未導入）。

## Never

`Never` は値を持たない bottom type です。`Never` 型の値は存在しません。

- 値を生成せずに終わる式の型が `Never` です。[`throw`](/reference/errors/#throws-と-throw) 式と [`panic`](/reference/errors/#panic) 式の型は `Never` です。
- `Never` はすべての型の部分型です（`Never <: T`）。ゆえに `throw` / `panic` を任意の分岐・任意の期待型の位置に置けます。
- `throws Never` は「送出しない」と等価です。

## 演算子の意味論

`/` `%` `++` `==` などの演算子は[対応するトレイトメソッドへ desugar](/reference/traits/#演算子のトレイト化) されます。上記の観測可能な意味（切り捨て・0除算 panic・wrap・連結）は、組み込み instance を backing する [intrinsic の lowering](/reference/runtime-boundary/#intrinsic純粋演算) によって保存されます。
