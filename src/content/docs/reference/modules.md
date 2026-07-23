---
title: モジュールとインポート
description: モジュール単位 import・可視性・名前解決順位
---

コードはモジュール単位で構成します。import は **モジュール単位** で行い、モジュール外の関数呼び出しは
常に修飾形になります。effect の宣言と呼び出しゲートは [エフェクト](/reference/effects/) が、
trait の impl 可視性（孤児規則）は [トレイト](/reference/traits/) が定めます。

## モジュールと可視性

- **1ファイル1モジュール** です。ファイル先頭の `module Name` がモジュール名を与えます。
- `pub` を持つ定義（関数・enum・record・effect）が公開アイテムです。`pub` の無い定義はモジュール private で、importer からベア・修飾いずれの形でも参照できません。
- `pub fn` は型・effect を明示的に書きます。`uses` の明示は必須です（→ [推論と注釈](/reference/effects/#推論と注釈)）。

```emela
module user

pub fn get_user(id: UserId) -> Option<User> uses { Db } { ... }

fn decode(raw: String) -> User throws DecodeError { ... }   -- private
```

## import（モジュール単位）

import の対象はモジュールのみです。関数・型・effect を個別に import する形式はありません。

- **モジュール単位**：`import p1.….pn`（n ≥ 1）はモジュールを import します。最終セグメント `pn` がモジュール名です。`p1` が依存パッケージ名ならパッケージルート基準、そうでなければ import 元ファイル基準の相対パスで解決します。
- **束縛**：import は import 先モジュールの **公開アイテムのみ** を束縛します。
  - **公開関数**：修飾パスで参照可能になります。修飾子はモジュールパス `p1.….pn` の任意の非空 suffix です（`list.map(...)` / `std.list.map(...)`）。
  - **公開型アイテム（enum / record / effect）**：ベア名で型スコープに入ります。
- **ベア名の範囲**：ベア名の関数参照は、ローカル束縛 → 同一コンパイル単位の関数の順で解決します。import されたモジュールの関数に解決してはなりません（診断は修飾形を案内します）。
- **曖昧性は使用箇所で**：修飾パスが複数の import 先に一致する場合や、型アイテムのベア名が衝突する場合は、**使用箇所** で曖昧エラーとし、候補の full path を列挙します。import 時にはエラーにしません。
- [Core Prelude](/reference/runtime-boundary/#core-prelude) のベア名は import を要さず常に参照できます。

## 名前解決順位

パス `p1.….pk` の先頭 `p1` は次の順で解決します。

1. **ローカル束縛**（`let` / 引数）→ `p1.x` はフィールドアクセスまたは[レシーバ呼び出し](/reference/traits/#レシーバ構文)。
2. **大文字始まりならスコープ内の effect** → effect 操作呼び出し（→ [`uses` ゲート](/reference/effects/#effect-操作の呼び出しと-uses-ゲート)）。
3. **import 済みモジュールの修飾子** → 修飾関数呼び出し。

enum variant・型変換は二重コロン `::` で書く型パスで、`.` のパス解決とは構文的に分離されます。`::` の左辺は enum 型名であり、`Enum.Variant` はエラーです。

```emela
import std.io
import std.list

fn main() -> Unit uses { Io } {
    Io.print(list.length([1, 2, 3]))   -- Io.print: effect 操作 / list.length: 修飾関数
}
```

## backend シンボル

backend シンボルは所属モジュールで一律にマングルします（例：`std.list.map` → `std__list__map`、コンパイルルートはベア名のまま）。
パス解決は型検査時に確定し、lowering は解決済みのシンボルを emit します。
