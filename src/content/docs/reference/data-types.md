---
title: データ型
description: enum・match・record・ジェネリックデータ型・Option
---

ユーザー定義の直和型（`enum`）と積型（`record`）、それらの総称版、`match` による分解を定めます。
`Option` はこの機構で定義される Core Prelude の enum です。

## enum

```emela
enum Color { Red  Green  Blue }
enum Either<L, R> { Left(L)  Right(R) }
```

- variant は enum 名で修飾した **型パス** `Enum::Variant` で参照・構築します。区切りは二重コロン `::` です（`.` ではありません。`Color.Red` はエラー）。
- payload のない variant（`Color::Red`）はそれ自体が値です。payload を持つ variant（`Either::Left(1)`）は引数を伴って構築します。

## match 式

`match` は式で、すべての arm は同じ型を返します。pattern は上から順に判定されます。

```emela
match value {
    Some(v) -> v
    None -> 0
}
```

- enum に対する match は **網羅的（exhaustive）** でなければなりません。到達しない pattern はエラーです。
- pattern の variant は裸の `Variant` または `Enum::Variant` で書けます。
- **pattern guard**：`pattern if cond -> expr`。pattern が一致した後に `cond`（型は `Bool`）を評価し、`true` の arm のみ本体を評価します。guard 内では pattern で束縛した変数を参照できます。
- guard 付き arm は網羅性で **完全な coverage とみなしません**（guard が false になりうるため）。また同じ pattern の guard なし arm より **前** に置かなければなりません。
- [effect](/reference/effects/) は次の和集合です。

```text
effects(match) = effects(scrutinee) ∪ effects(all guards) ∪ effects(reachable arm bodies)
```

## record

```emela
record User { id: Int  name: String }

let user = User { id: 1, name: "alice" }
user.name   -- "alice"
```

- record は名前付きフィールドを持ちます。構築時に全フィールドを与え、`r.field` でアクセスします。
- record は **組み込みの構造的等価を持ちません**。`==` を使うには [`impl Eq`](/reference/traits/#演算子のトレイト化) を与えます。

## ジェネリックデータ型

```emela
enum Either<L, R> { Left(L)  Right(R) }
record Pair<A, B> { first: A  second: B }
enum List<T> { Nil  Cons(T, List<T>) }
```

- 型パラメータは型名の直後の `<...>` に並べます（空リストは不可）。payload 型・フィールド型の中で型として使えます。
- 型パラメータに **境界（`<T: Show>`）は付けられません**。データ型は能力を要求しません。能力は使用側の[関数の境界](/reference/traits/#境界bounds)や[パラメータ付き impl](/reference/traits/#impl-宣言)が要求します。
- 名前付き型は自身（および相互に）を payload / フィールド位置で参照できます（**再帰型**）。payload / record は常にヒープ参照なので有限表現を持ち、構築順により非循環です。
- `Name<C1, …, Cn>` を型位置に書けます。型引数の数は宣言と一致しなければならず、部分適用（`Either<Int>`）はできません。
- **構築と型引数の決定**：payload / フィールドの実引数型から[構造対応付け](/reference/generics/#推論)で推論します。payload に現れない型パラメータや payload の無い variant（`Nil` など）は **期待型** から決定します。期待型からも決まらなければエラーです。

## Option

`Option` は Core Prelude が提供するジェネリック enum で、値の不在を表します。

```emela
enum Option<T> { Some(T)  None }
```

- 型検査・match・単相化はジェネリック機構で扱います（`Option` 専用の組み込み型ではありません）。
- `Some` / `None` は **修飾なしのベア名** で構築・照合できます（import 不要）。これは lang-item の特権です。
- **`?` は `Option` に対して定義しません**（→ [エラー](/reference/errors/#-operator)）。不在の伝播は `match` またはコンビネータ（`std.option`）で行い、error channel へ橋渡しするには `Option.ok_or` を使います。
- `Option` は予約名で、ユーザーソースが再定義することはできません。

```emela
match array_get(xs, i) {
    Some(v) -> v
    None -> 0
}
```
