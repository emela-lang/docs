---
title: ランタイム境界
description: platform 関数・intrinsic・Core Prelude・capability manifest・host.*
---

コンパイラは副作用も純粋プリミティブ演算の意味も **実装しません**。実体は境界の外側が供給します。
コンパイラが保持するプリミティブ知識は **(a) 値の表現**（`Int` = i32 など）と
**(b) intrinsic → 命令の対応表** の2つだけです。

境界は2種類あります。

| 境界 | 宣言 | 供給者 | lower 先 | 純度 |
|---|---|---|---|---|
| **platform 関数** | `extern fn` | Runtime（ホスト） | Runtime への **呼び出し** | effectful（[capability](/reference/effects/)を発生） |
| **intrinsic** | `intrinsic fn` | backend | native 命令へ **インライン** | 純粋（常に `uses {}`） |

## platform 関数（副作用の唯一の源）

[capability effect](/reference/effects/) を発生させる手段は platform 関数の呼び出しのみです。コンパイラは capability effect を持つ組み込み演算を提供してはなりません。

- **registry**：本仕様が platform 関数を列挙します。各エントリは修飾名（`io.write_stdout`）・引数型・戻り値型・capability を持ちます。個々のプログラムが任意に定義するものではありません。
- **`extern fn` 宣言**：Emela コードは platform 関数を `extern fn` で宣言し、本体を持ちません。シグネチャは registry エントリと一致しなければなりません。registry に無い platform 関数の `extern fn` はコンパイルエラーです。backend を名指し / 分岐する構文は存在しません——ゆえに `extern fn` を含むソースは backend 非依存です。
- **供給契約**：各 target / backend は registry の **部分集合** を実装してよいです。executable が、選択された target の提供しない platform 関数を推移的に要求する場合、コンパイルはエラーになります。
- **canonical 名**：platform 名は **モジュール名** で修飾します（`io.write_stdout`）。effect 名（`Io`）は `uses` row・呼び出し構文・診断にのみ現れ、backend シンボル・capability 検証には影響しません。

慣習として `extern fn` は標準ライブラリ（[effect ブロック](/reference/effects/#effect-の宣言)内）が宣言し、`pub fn` で包みます。アプリケーションはラッパーを通じて使い、`extern fn` を直接書く必要はありません。

## 失敗する platform 関数

registry エントリと `extern fn` は `throws E` を宣言してよいです。ホストの失敗は通常の [Emela error](/reference/errors/#ホストの失敗fallible-platform-関数) として呼び出し側に届きます。`throws` の有無は `uses` row・カバレッジ検査・manifest に影響しません。

## カバレッジ検査

- capability effect の発生源は platform 関数のみなので、プログラムが実行しうる effect 全体は、`main` から推移的に到達可能な platform 関数の集合に等しくなります。これが Runtime が解決すべき契約です。
- 各 backend は供給する platform 関数（および intrinsic）の集合を宣言し、コンパイラは **要求 ⊆ 供給** を検査します。不足があればエラーです。
- library（`main` を持たない compilation unit）は、要求集合を metadata として保持してよいです。

## intrinsic（純粋演算）

純粋なプリミティブ演算は `intrinsic fn` で宣言します。構文は `extern fn` と同型で本体を持ちません。

```emela
intrinsic fn i32_add(a: Int, b: Int) -> Int uses {}
intrinsic fn array_get_unchecked<T>(a: Array<T>, i: Int) -> T uses {}
```

- `intrinsic fn` は **純粋** でなければならず、常に `uses {}` です。capability effect を持ってはならず、本体を書けません。backend 名指し構文はありません。
- 呼び出しは backend が **native 命令または式へインライン** に lower します（platform 関数が Runtime への呼び出しに lower するのと対照的）。同一の intrinsic 名は、どの backend でも観測可能な意味が一致するように lower されなければなりません。
- ジェネリック intrinsic は引数型から型引数を推論して単相化されます。
- intrinsic の集合もカバレッジ検査の対象です。
- 演算子（[演算子 trait](/reference/traits/#演算子のトレイト化)）の組み込み型実装、`Char`/`String` 変換（`char_from_code` など）、`Array` 基本操作（`array_length<T>` など）はすべて intrinsic として供給されます。

## Core Prelude

コンパイラは、指定するコアモジュール（`std.core`）を全コンパイル単位に **暗黙に import** します。Core Prelude は特別なコンパイラ組み込みではなく通常の Emela ソースです。

- Core Prelude は[演算子 trait](/reference/traits/#演算子のトレイト化)（`Add`/`Sub`/…/`Eq`/`Ord`/`Concat`）と `Monoid`、および `Int`/`Float`/`String`/`Char` に対するそれらの `impl`（本体が `intrinsic fn` を呼ぶ）を置きます。この暗黙 import により `1 + 2` やリテラルの `Int` 型が明示 import なしに解決します。
- Core Prelude が宣言する `intrinsic fn` は、**全コンパイル単位からベア名で可視** です。`char_from_code` / `string_from_char` / `array_length` / `array_get` / `array_push` が無 import のベア名で使えます。
- prelude 以外のモジュールが宣言する intrinsic は、その宣言モジュール内でのみベア可視で、公開 API は `pub fn` ラッパが担います。
- 名前解決は[通常の import](/reference/modules/#名前解決順位)に従い、ローカル束縛・同一 entry の関数は prelude を shadow できます。

```emela
fn main() -> Int uses {} {
    1 + 2
    -- 1 + 2 →(Traits) Add.add(1, 2) → impl Add for Int → i32_add(1, 2) →(backend) i32.add
}
```

## capability manifest

コンパイラは executable の **要求集合** を静的に確定し、生成物に機械可読な manifest として埋め込みます。ホストはインスタンス化の前に要求権限を監査できます。

- **要求集合の計算**：`main` から推移的に到達可能な platform 関数（`requires`）、その capability（`capabilities`）、intrinsic（`intrinsics`）。**実際の到達可能性** から計算し、`uses` の過大宣言は要求集合を増やしません。
- **埋め込み**：WASM 出力では custom section `emela:capabilities` に JSON として格納します。非 WASM backend は同内容を添付すべきです。
- **真実性**：manifest は計算された要求集合と正確に一致しなければなりません。過少申告・過大申告のいずれも禁止です。
- **決定性**：配列はソート済み・重複なし、キー順固定、余分な空白なし。同一プログラムから同一バイト列を生成します（reproducible build）。

```json
{"format":1,"requires":["io.write_stdout"],"capabilities":["Io"],"intrinsics":["string_concat"],"entry":true}
```

- **ホスト側の利用**：ホストは manifest を読み、`requires ⊆ 供給` でないモジュールのインスタンス化を拒否できます。これはコンパイル時カバレッジ検査の配布後の対です。最終的な強制は常にサンドボックス側にあります（[二重保証](/reference/effects/#モデル)）。

## embedder 定義 capability（`host.*`）

embedder（ホスト実装者）は標準 registry を `host.*` 名前空間で拡張できます。デバイス固有の API（GPIO・センサー・独自プロトコル）を、標準 capability と同じ規律の下で公開します。

- capability 識別子 `host.<ident>` を導入します。`host` は単独では使えず、常に `host.<cap>` の形で用います（`uses { host.gpio }`）。標準 registry のモジュールパスと `host.*` は互いに素です。
- embedder は **host interface package**（`host.` 配下のモジュールに `extern fn` を宣言した Emela ソース群）をビルド入力として供給できます。`extern fn` の規則は標準と同一で、宣言する capability はモジュールパスに対応する `host.<ident>` でなければなりません。
- `host.*` の platform 関数はカバレッジ検査と manifest の対象です。package を供給しないビルドで `host.*` を参照すれば未定義エラーです。
- `host.*` を参照しないソースの backend 非依存性は変化しません。`host.*` を参照するソースは、その host interface を供給する embedder に対してのみ有効な **宣言された特殊化** であり、manifest に明示されます。
