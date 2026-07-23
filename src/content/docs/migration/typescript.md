---
title: TypeScript から
description: TypeScript を書いてきた人のための Emela 入門
---

TypeScript から来ると、静的型・ジェネリクス・discriminated union の感覚は活きます。
変わるのは、型が **構造的から名前的** になること、**`null` / `undefined` が無い** こと、
`any` のような抜け道が無く **すべて不変** なこと、そして数値が `number` 一本ではなく `Int` / `Float` に分かれることです。

## 対応表

| TypeScript | Emela |
|---|---|
| `interface` / `type`（構造的） | `record` + `trait`（**名前的・明示 `impl`**） |
| discriminated union + `switch (x.kind)` | `enum` + `match`（網羅的） |
| `null` / `undefined` / `T \| null` | `Option<T>`（`Some` / `None`） |
| `throw` / `try`/`catch`（何でも投げられる） | `throw` / `try`–`catch`、型に `throws E` |
| `class` / 継承 | `record` + `trait`/`impl`（継承は無し） |
| ジェネリクス `<T extends C>` | ジェネリクス + `trait` 境界 `<T: C>` |
| `number`（常に f64） | `Int`（i32）と `Float`（f64）に分離 |
| `const`（束縛のみ不変） | `let`（**値ごと不変**） |
| `any` / `unknown` | 無し（完全に静的） |
| `Promise` / `async`/`await` | 言語コアには未定義（I/O は effect） |
| npm / `package.json` | Pome（`Pome.toml` / `emela pome add`） |

## discriminated union → enum + match

TypeScript でいちばん近いのはタグ付き union です。Emela の `enum` + `match` にそのまま対応し、
網羅チェック（TS で `never` を使って書くもの）は言語に組み込まれています。

```typescript
// TypeScript
type Shape =
  | { kind: "circle"; r: number }
  | { kind: "rect"; w: number; h: number };

function area(s: Shape): number {
  switch (s.kind) {
    case "circle": return Math.PI * s.r * s.r;
    case "rect":   return s.w * s.h;
  }
}
```

```emela
-- Emela
enum Shape {
    Circle(Float)
    Rect(Float, Float)
}

fn area(s: Shape) -> Float {
    match s {
        Circle(r) -> 3.14 * r * r
        Rect(w, h) -> w * h
    }
}
```

variant を1つ足して `match` を更新し忘れると、コンパイルエラーになります。

## null / undefined は Option

`strictNullChecks` で `T | null | undefined` を扱ってきたなら、`Option<T>` は馴染みやすいはずです。
違いは、`?.` や `??` のような暗黙の穴埋めではなく、必ず `match` かコンビネータで開くことです。

```typescript
function find(id: number): User | undefined
```

```emela
fn find(id: Int) -> Option<User> uses { Db } { ... }

match find(1) {
    Some(u) -> u.name
    None -> "unknown"
}
```

## 例外は型に出る

TypeScript の `throw` は何でも投げられ、型に現れません（`catch (e)` は `unknown`）。
Emela では失敗しうる関数が `throws E` を宣言し、`E` は単一の型です。伝播は `?`、捕捉は `try`–`catch`。

```emela
fn load(path: Path) -> Config throws IoError uses { Fs } {
    let text = read(path)?
    parse(text)?
}
```

## 構造的 → 名前的な型

TypeScript の型は形が合えば互換（構造的）ですが、Emela の `record` と `trait` は **名前的** です。
同じフィールドを持つ別の record は別の型で、trait は明示的な `impl` がある型だけが満たします
（[孤児規則](/reference/traits/#コヒーレンス孤児規則)により実装は大域一意）。任意の `A | B` のような即席 union は作れず、
選択肢は名前付きの `enum` で表します。

## 数値は Int と Float に分かれる

TypeScript の `number` は常に倍精度浮動小数ですが、Emela は整数 `Int`（i32）と浮動小数 `Float`（f64）を分けます。

- `Int` の `+ - *` は **2³² で wrap**、除算は切り捨て、0除算は panic。
- `Float` は IEEE-754。`%` は `Int` 専用です。
- `Int` と `Float` は暗黙に混ざりません。

```emela
7 / 2       -- 3（Int の切り捨て除算）
7.0 / 2.0   -- 3.5（Float）
```

## 気をつけること

- **`any` / `unknown` / 型アサーションは無い**。抜け道なしで型が付きます。
- **すべて不変**。`const` はオブジェクトの中身の変更を許しますが、Emela の値は中身ごと不変です。更新は新しい値を作ります。
- **`Promise` / `async`/`await` に相当する非同期機構は、言語コアの仕様にはまだありません**。I/O は effect（`uses`）で扱います。
- **`import` はモジュール単位**。`import { map } from ...` のような名前付き import は無く、`list.map(...)` と修飾します。
- **文字列は Unicode scalar 単位**（TS の UTF-16 とは数え方が違う場合があります）。

→ 詳しくは [データ型](/reference/data-types/) と [エラー](/reference/errors/)
