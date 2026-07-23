---
title: C / C++ から
description: C・C++ を書いてきた人のための Emela 入門
---

C / C++ から来ると、パラダイムの違い（手続き型・OOP → 関数型）が大きいですが、
「メモリを手で管理しない」「未定義動作が無い」「null が無い」という点でむしろ楽になります。
低レベルの制御と引き換えに、**移植可能で定義された意味論** を得ます。

## 対応表

| C / C++ | Emela |
|---|---|
| 手動メモリ管理（`malloc`/`free`, `new`/`delete`） | ランタイム管理の非循環ヒープ（所有権・借用は無い） |
| ポインタ・`nullptr` | 参照はランタイム管理・null 無し → `Option<T>` |
| 符号付きオーバーフロー = 未定義動作 | `Int`（i32）は **定義された wrap** |
| `struct` | `record` |
| `union` / tagged union | `enum`（直和型）+ `match` |
| `class` / 継承 / 仮想関数 | `record` + `trait`/`impl`（継承は無し） |
| テンプレート | ジェネリクス（単相化） |
| `#include` / ヘッダ | `import`（モジュール単位） |
| `extern "C"` / FFI | `extern fn`（[platform 関数](/reference/runtime-boundary/)）※通常は stdlib が宣言 |
| Make / CMake | Pome（`emela build`） |

## メモリは管理しなくてよい

`malloc`/`free` も `new`/`delete` も、`unique_ptr` のような所有権の概念もありません。
値はランタイムが管理する非循環ヒープに置かれ、参照は自動で解放されます（WASM backend では ARC）。
ダングリングポインタ・二重解放・リークを気にする必要はありません。

## null の代わりに Option

```cpp
Node* find(Tree* t, int key);  // 見つからなければ nullptr
```

```emela
fn find(t: Tree, key: Int) -> Option<Node> { ... }

match find(tree, 42) {
    Some(node) -> use_node(node)
    None -> default()
}
```

`nullptr` の参照外しに相当するクラッシュは、型が `Option` を要求することで防がれます。

## 未定義動作が無い

C/C++ では符号付き整数のオーバーフローは未定義動作ですが、Emela の `Int` は i32 に固定され、
`+ - *` は **2³² で wrap** します（全 backend で同じ結果）。除算は0方向へ切り捨て、0除算は panic します。

```emela
2147483647 + 1   -- -2147483648（定義された wrap。UB ではない）
7 / 2            -- 3
```

## struct / union → record / enum

```c
struct Point { int x; int y; };

enum ShapeKind { CIRCLE, RECT };
struct Shape { enum ShapeKind kind; /* ... */ };
```

```emela
record Point { x: Int  y: Int }

enum Shape {
    Circle(Float)
    Rect(Float, Float)
}

fn area(s: Shape) -> Float {
    match s {                 -- tag の分岐は match（網羅的）
        Circle(r) -> 3.14 * r * r
        Rect(w, h) -> w * h
    }
}
```

タグ付き union を手で書く代わりに `enum` を使い、`match` は全 variant を網羅していないとコンパイルエラーになります。

## 仮想関数・継承 → trait

実行時の vtable ディスパッチ（仮想関数）ではなく、Emela の trait は **単相化で静的に解決** されます。
継承階層は作れません。共通の振る舞いは trait 境界で表します。

```emela
trait Show {
    fn to_string(self: Self) -> String
}

fn describe<T: Show>(x: T) -> String { "value: " ++ x.to_string() }
```

## ループ → 再帰

`for` / `while` はありません。カウントダウンのような処理も再帰で書き、末尾再帰はスタックを消費しません。

```emela
fn count_down(n: Int) -> Unit uses { Io } {
    if n == 0 {
        Io.print("done\n")
    } else {
        Io.print(n)
        count_down(n - 1)   -- 末尾位置：スタック安全
    }
}
```

## 気をつけること

- **ポインタ演算・生メモリ操作は無い**。生バイト列が必要なら不変の `Bytes` を使います。
- **`extern fn` は自由に書けない**。ホスト関数は registry に載ったものだけで、通常は stdlib のラッパ経由です（→ [ランタイム境界](/reference/runtime-boundary/)）。
- **副作用は `uses` に出る**。I/O をする関数は capability を宣言します。
- **式指向**。`if` は式で `else` 必須、`return` はありません。

→ 詳しくは [値と型](/reference/values/) と [ランタイム境界](/reference/runtime-boundary/)
