---
title: モジュールと名前の解決
description: ファイルからモジュール名を決める規則、プロジェクトと単独ファイル、import、pub と opaque、名前空間と名前の引き方
---

使い方の説明は [モジュールと公開範囲](/guide/modules/) にあります。このページは、モジュールと名前の解決についてコンパイラが従う規則をまとめたものです。import と宣言の構文は [文法](/reference/grammar/) にあります。

## モジュール名

1つのファイルが1つのモジュールです。ソースのルートからのパスを、区切りごとに snake_case から PascalCase へ変えて `.` でつないだものがモジュール名になります。

- ファイル名とディレクトリ名は小文字の snake_case でなければなりません。`Foo.emel` は E0201、`My-Dir/` は E0202 です。
- 変換後の名前は型名（大文字で始まり、小文字を1つ以上含む）でなければなりません。`a.emel`（`A`）や `x_y.emel`（`XY`）は E0201 です。
- `_` の直後の数字はそのまま残ります。`http_2.emel` は `Http2` になり、`http2.emel` と重複します。
- 同じモジュール名になるファイルが2つあれば E0204 です。大文字小文字だけが違うファイルも重複として扱います。
- `.` で始まるファイルとディレクトリ、`.emel` 以外のファイルは無視します。
- ソースのルート直下の `prelude.emel`、core のモジュールと同じ名前のファイル（`list.emel`、`string.emel` など）、`std.emel` と `std/` は予約されていて置けません（E0203）。

## プロジェクトと単独ファイル

`Pome.toml` を置いたディレクトリがプロジェクトで、`src/` がソースのルートです。

- `emela run` にディレクトリを渡すと（省けばカレントディレクトリ）、祖先をたどって `Pome.toml` を探します。見つからなければ E0207 です。
- プロジェクトのエントリは `src/main.emel`、ライブラリのルートは `src/lib.emel` です。両方を置いてもかまいません。
- ファイルを渡して `Pome.toml` が見つからなければ、単独ファイルとして扱います。そのファイルがエントリで、モジュールは同じディレクトリの直下の `.emel` だけです。サブディレクトリは見ません。
- 単独ファイルでは、エントリから import でたどれるファイルだけを読んで検査します。

## import

- `import A.B` は最後の名前 `B` をモジュールとしてスコープに入れます。波括弧の形（`import A.B.{x}`）でも `B` はスコープに入ります。
- 波括弧で列挙した名前はその名前を持つすべての名前空間から取り込みます。type なら型と構成子の両方です。enum のバリアントも名前で個別に取り込めます。
- import はファイルの先頭に置きます。宣言より後ろの import は E0127 です（コメントは宣言として数えません）。
- import した名前は再公開しません。ほかのモジュールから引けるのは、そのモジュールが定義した名前だけです。
- モジュールどうしの import の循環は E0206 です。自分自身の import も循環に含みます。

```emela check=error
fn main() {}

import Std.Console    # error[E0127]: imports must come before declarations
```

### core と Std

- 同梱の core のモジュール（`List`、`String`、`Int`、`Int64`、`Float`、`Option`）は、import なしで `.` の左に書けます。
- 型の位置では、`List`、`Option` などの core の型も import なしで使えます。
- 同梱の std のモジュールは `Std` の下にあり、import が要ります。import せずに `Std` を書くと E0211 です。

```emela check=error
fn main() {
  out = use Std.Console.Console   # error[E0211]: cannot find module or trait `Std` in this scope
}
```

## pub

- 宣言は既定で非公開です。`pub` を付けられるのはトップレベルの宣言（`fn` `type` `enum` `error` `effect` `handler` `layer` `const` `trait`）だけです。
- 非公開の定義をほかのモジュールから参照すると E0214 です。
- フィールドやバリアントを個別に公開・非公開にする指定はありません。type の構成子と enum のバリアントは、親の型の `pub` と `opaque` に従います。
- 公開する関数の戻り値の型、`fails` 節、`use` 節は省けますが、省くと linter が警告します。LSP は推論した型を挿入できます。

## opaque

`opaque` は type と enum にだけ、`pub` と一緒に付けます。それ以外に付けると E0131 です。

| 宣言 | 型名 | 構築 | パターンマッチ | フィールドの参照 |
|---|---|---|---|---|
| `pub type` / `pub enum` | 公開 | 公開 | 公開 | 公開 |
| `pub opaque type` / `pub opaque enum` | 公開 | 定義モジュールの中だけ | 定義モジュールの中だけ | 定義モジュールの中だけ |

- 定義モジュールの外での構築は E0215 です。部分更新（`..式`）も構築として扱うので、外では E0215 になります。
- 外でのフィールドの参照は E0315、パターンでの分解は E0216 です。
- 定義したモジュールの中では、ふつうの type と enum と同じに扱います。

## 名前空間

名前は型・構成子・値の3つの名前空間と、モジュール名に分かれます。

| 名前空間 | 含まれるもの |
|---|---|
| 型 | type、enum、error、effect、handler、layer、trait |
| 構成子 | type の構成子、enum のバリアント、error、フィールドのある handler |
| 値 | fn、const |

どの名前空間を引くかは名前を書いた位置で決まります。

- `.` の左では、モジュールと Trait だけを引きます。
- 型の位置では、型だけを引きます。
- 式とパターンの型名では、構成子だけを引きます。

そのため、モジュール `Email` とその中の型 `Email` は衝突しません。`import Email` だけで型 `Email` を修飾なしで書くと E0217（`expected type, found module`）です。`Email.Email` と書くか、`import Email.{Email}` で型を取り込みます。

### 重複と隠すこと

- 同じ名前空間での定義の重複は E0213 です。同じモジュールの2つの enum が同じ名前のバリアントを持つ場合や、`type Green` とバリアント `Green` も重複です。
- 1つのパターンか引数の並びで同じ名前を2回束縛すると E0220 です。
- モジュールの定義と import は Prelude の同じ名前を隠せます。隠したときは警告します（W0202）。Prelude に名前が足されても、既存のコードが壊れないようにするためです。

```emela check
enum Maybe {
  Some(Int)       # warning[W0202]: `Some` shadows the prelude's `Some`
  Nothing
}

fn main() {
  dbg(Some(1))    # このモジュールの Some
}
```
