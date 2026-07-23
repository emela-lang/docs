---
title: Gleam から
description: Gleam を書いてきた人のための Emela 入門
---

Gleam は Emela にいちばん近い言語です。**不変・式指向・パターンマッチ・null 無し・pipeline** といった土台を共有しています。
違いは大きく2つ：Emela には **エフェクト追跡（`uses`）** と **トレイト** があり、
エラーは `Result` を値で回すのではなく **専用の `throws` channel** で扱います。

## 対応表

| Gleam | Emela |
|---|---|
| `let x = 1`（不変） | `let x = 1`（同じ） |
| custom type `pub type T { .. }` | `enum`（直和型）+ `record`（積型） |
| `case x { .. }` | `match x { .. }`（網羅的・式） |
| `Option(t)`（`Some`/`None`） | `Option<T>`（`Some`/`None`。同じ） |
| `Result(t, e)`（`Ok`/`Error`） | `throws E` + `?`（error channel） |
| `use` 式 / `result.try` | `?` / `try`–`catch` |
| `\|>`（第一引数） | `\|>`（同じ） |
| `panic` / `todo` | `panic` |
| 型クラス無し | **`trait`/`impl` あり** |
| エフェクト追跡無し | **`uses`（capability）あり** |
| `import gleam/list.{map}`（非修飾も可） | `import`（**モジュール単位のみ**、修飾呼び出し） |
| Erlang / JavaScript ターゲット | WebAssembly / Native ターゲット |

## ほぼそのまま移せるもの

パターンマッチ・pipeline・custom type は考え方がほぼ同じです。

```emela
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

xs |> list.filter(is_even) |> list.map(double)
```

## エラー：Result を回す → throws channel

Gleam ではエラーを `Result(t, e)` の値として関数から関数へ手渡し、`use`/`result.try` で連鎖させます。
Emela では、失敗しうることは型の `throws E` に現れ、`?` で伝播します。値としての Result を明示的に組み立てる必要はありません。

```gleam
// Gleam
pub fn load(path) -> Result(Config, IoError) {
  use text <- result.try(read(path))
  parse(text)
}
```

```emela
-- Emela
fn load(path: Path) -> Config throws IoError uses { Fs } {
    let text = read(path)?
    parse(text)?
}
```

捕捉は `try`–`catch` で行います。なお **`?` は `Option` には使えません**（Gleam で `Result` と `Option` を区別するのと同様、Emela でも別扱い）。
`Option` の不在を error に橋渡しするには `Option.ok_or` を使います。

```emela
let user = option.ok_or(find_user(id), UserError::NotFound)?
```

## 新しく増えるもの1：トレイト

Gleam には型クラスがなく、多態は普通の関数と型引数で表しますが、Emela には **trait** があります。
アドホック多態（型ごとの実装の切り替え）が書け、演算子もトレイトの糖衣です。

- Gleam は整数加算 `+` と浮動小数加算 `+.` を字句的に分けますが、Emela は **どちらも `+`**（`Int` と `Float` それぞれの `Add` 実装で解決）。
- `to_string` などは trait `Show` のメソッドとして、`x.to_string()` のレシーバ構文で呼べます。

```emela
record Vec2 { x: Int  y: Int }

impl Add for Vec2 {
    fn add(a: Vec2, b: Vec2) -> Vec2 { Vec2 { x: a.x + b.x, y: a.y + b.y } }
}

Vec2 { x: 1, y: 2 } + Vec2 { x: 3, y: 4 }   -- ユーザー型で + が使える
```

## 新しく増えるもの2：エフェクト（uses）

Gleam は副作用を型で追跡しませんが、Emela は関数が使う capability を `uses` に書きます。
I/O をする関数はそれが型に現れ、その集合がサンドボックスの権限表になります。

```emela
import std.io

fn greet(name: String) -> Unit uses { Io } {
    Io.print("hello, " ++ name ++ "\n")
}
```

## 気をつけること

- **`import` はモジュール単位のみ**。`import gleam/list.{map}` のような非修飾 import は無く、`list.map(...)` と修飾して呼びます。
- **`Int` は i32 で wrap**。Gleam の（Erlang 上の）多倍長整数とは異なります。
- **文字列の単位**は Unicode scalar（`Char`）。Gleam の grapheme 単位とは数え方が違う場合があります。
- **ラベル付き引数は無い**。引数は位置で渡します。
- **カリー化・部分適用は無い**（Gleam と同様）。連鎖は pipeline で書きます。

→ 詳しくは [エフェクト](/reference/effects/)・[トレイト](/reference/traits/)・[エラー](/reference/errors/)
