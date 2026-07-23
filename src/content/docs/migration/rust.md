---
title: Rust から
description: Rust を書いてきた人のための Emela 入門
---

Rust から来ると、**trait・enum・`match`・`Option`・`?`・単相化・孤児規則** がそのまま通じます。
最大の違いは **所有権・借用・ライフタイムが無い** こと。メモリはランタイムが管理し、`&` も `mut` もありません。
その代わり **すべて不変** で、エラーは `Result` ではなく **`throws` channel** で扱います。

## 対応表

| Rust | Emela |
|---|---|
| `trait` / `impl` / 孤児規則 | `trait` / `impl` / 孤児規則（ほぼ同じ） |
| `enum` + `match`（網羅的） | `enum` + `match`（同じ） |
| `Option<T>`（`Some`/`None`） | `Option<T>`（同じ） |
| `Result<T, E>` | `throws E` channel |
| `?`（`Result`/`Option` に使える） | `?`（**throwing 呼び出し専用**。`Option` 不可） |
| ジェネリクス + 単相化 | ジェネリクス + 単相化（同じ） |
| 所有権・借用・ライフタイム | **無し**（ランタイム管理の非循環ヒープ + ARC） |
| `let mut` / 可変参照 | 無し（すべて不変） |
| `for` / `while` / `loop` | 再帰（自己末尾呼び出しはスタック安全） |
| イテレータアダプタ `.iter().map()` | `list` コンビネータ + `\|>` |
| マクロ | 無し |
| `panic!` | `panic` |
| Cargo / crates.io | Pome（git ベース・中央レジストリ無し） |

## いちばんの朗報：借用チェッカが無い

所有権・借用・ライフタイム・move セマンティクスはありません。`&T` / `&mut T` / `'a` を書くことも、
`clone` でライフタイムを回避することもありません。値はランタイムが管理する非循環ヒープに置かれ、
WASM backend では ARC で解放されます。

その代わり **可変性そのものがありません**。Rust の `let mut` に相当するものは無く、
「更新」は新しい値を作る操作になります。データ構造は永続的（persistent）に扱います。

## trait はほぼそのまま

trait 宣言・`impl`・境界・孤児規則・単相化・erasure まで、考え方は Rust とよく一致します。

```emela
trait Show {
    fn to_string(self: Self) -> String
}

record Vec2 { x: Int  y: Int }

impl Show for Vec2 {
    fn to_string(self: Vec2) -> String {
        "(" ++ self.x.to_string() ++ ", " ++ self.y.to_string() ++ ")"
    }
}

fn describe<T: Show>(x: T) -> String { "value: " ++ x.to_string() }
```

まだ無いもの：**トレイト継承（スーパートレイト）・関連型・トレイトオブジェクト（`dyn`）**。
境界は「単相化で静的に discharge できるもの」に限られ、辞書渡し / vtable は使いません。

## エラー：Result → throws、`?` の対象が違う

Rust では `Result<T, E>` を返し `?` で伝播しますが、Emela では失敗は型の `throws E` に現れます。

```rust
// Rust
fn load(path: &Path) -> Result<Config, IoError> {
    let text = read(path)?;
    parse(&text)
}
```

```emela
-- Emela
fn load(path: Path) -> Config throws IoError uses { Fs } {
    let text = read(path)?
    parse(text)?
}
```

重要な違い：**`?` は throwing な呼び出しにだけ使えて、`Option` には使えません**。
Rust のように `option?` とは書けず、不在の伝播は `match` かコンビネータ、
error への橋渡しは `Option.ok_or(o, e)?` を使います。捕捉は `try`–`catch` です。

## 副作用は型に出る（`uses`）

Rust に無い概念です。関数が使う capability を `uses` に書き、その集合がサンドボックスの権限表になります。
`no_std` で環境依存を切り分ける感覚に少し似ていますが、粒度は capability 単位で、型検査と実行時サンドボックスの二重で強制されます。

```emela
import std.io

fn run() -> Unit uses { Io } {
    Io.print("hello\n")
}
```

## 整数・文字列の違い

- **オーバーフロー**：Rust は debug で panic・release で wrap（明示には `wrapping_add` 等）ですが、Emela の `Int`（i32）は **常に wrap** します。0除算は panic。
- **文字列**：Rust の `String` はバイト添字（scalar は `.chars()`）ですが、Emela の `String` は **添字・長さがすべて Unicode scalar 単位** です。生バイトは不変の `Bytes`。

## 気をつけること

- **ループは無い**。`for`/`while`/`loop` の代わりに再帰と `list` コンビネータ。末尾自己再帰はスタック安全が保証されます。
- **ジェネリック関数は第一級にできない**（境界付き関数を値として渡せない）。高階には具体型の関数値を使います。
- **マクロ・`unsafe` は無い**。
- **`match` の `|` パターンや範囲パターン**など一部の Rust の便利機能は、まず基本形（variant・guard）で書きます。

→ 詳しくは [トレイト](/reference/traits/)・[エラー](/reference/errors/)・[エフェクト](/reference/effects/)
