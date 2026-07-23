---
title: Python から
description: Python を書いてきた人のための Emela 入門
---

Python から来ると、いちばん大きいのは **動的型から静的型へ**、そして **すべてが不変・式指向** になる点です。
`for` ループ・可変変数・クラス継承・例外に頼らない書き方に慣れると、Emela はスムーズです。

## 対応表

| Python | Emela |
|---|---|
| 動的型・ダックタイピング | 静的型 + `trait` 境界 |
| `x = 1`（再代入可） | `let x = 1`（不変） |
| `for` / `while` | 再帰 + `list.map` / `filter` / `fold` |
| `None` | `Option<T>`（`Some` / `None`） |
| `raise` / `try`/`except` | `throw` / `try`–`catch`、型に `throws E` |
| `class` | `record` + `trait`/`impl` |
| `def f(x): ...` | `fn f(x: Int) -> Int { ... }` |
| `[x*2 for x in xs]` | `xs \|> list.map(...)` |
| `import`（関数単位も可） | `import`（**モジュール単位のみ**） |
| pip / venv | Pome（`emela pome add`） |
| `print(...)` | `Io.print(...)`（`uses { Io }` が要る） |

## 型は必須、推論は控えめ

Python の型ヒントと違い、Emela の型は必須です。関数の引数・戻り値には型を書きます。
一方、`let` 束縛の型やジェネリクスの型引数は推論されます。

```emela
fn add(x: Int, y: Int) -> Int {
    let sum = x + y   -- 型は推論される
    sum
}
```

## ループの代わりに再帰とコンビネータ

```python
# Python
total = 0
for x in xs:
    if x % 2 == 0:
        total += x * 2
```

```emela
import std.list

-- Emela：不変。pipeline とコンビネータで
let total =
    xs
    |> list.filter(fn (x: Int) -> Bool { x % 2 == 0 })
    |> list.map(fn (x: Int) -> Int { x * 2 })
    |> list.fold(0, fn (acc: Int, x: Int) -> Int { acc + x })
```

## None は Option に

Python の `None` はどんな値にも化けますが、Emela の `Option<T>` は型に現れ、`match` で必ず両方を扱います。

```python
def first(xs):
    return xs[0] if xs else None
```

```emela
fn first(xs: Array<Int>) -> Option<Int> {
    array_get(xs, 0)   -- 範囲外は None
}

match first(xs) {
    Some(v) -> v
    None -> 0
}
```

## クラスは record + trait

Python のクラス（データ + メソッド）は、データの `record` と振る舞いの `trait`/`impl` に分かれます。
継承はありません。多態はダックタイピングではなく `trait` 境界で表します。

```python
class User:
    def __init__(self, id, name):
        self.id = id
        self.name = name
    def greeting(self):
        return f"Hi {self.name}"
```

```emela
record User { id: Int  name: String }

fn greeting(u: User) -> String {
    "Hi " ++ u.name
}

let u = User { id: 1, name: "alice" }
u.greeting()   -- レシーバ構文。greeting(u) と同じ
```

## 例外は型に出る

Python では任意の関数がどんな例外でも投げられますが、Emela では失敗しうる関数は `throws E` を宣言し、
呼び出し側は `?`（伝播）か `try`–`catch`（捕捉）で必ず扱います。

```emela
fn load(path: Path) -> Config throws IoError uses { Fs } {
    let text = read(path)?   -- 失敗したら呼び出し元へ伝播
    parse(text)?
}
```

## 気をつけること

- **文字列は immutable**。`s += x` のような破壊的変更はできません（`++` は新しい `String` を返す）。
- **`import` はモジュール単位**。`from std.list import map` のような関数単位 import はできません。`list.map(...)` と修飾して呼びます。
- **`print` は capability**。`Io.print` を使う関数には `uses { Io }` が必要です。
- **整数は i32 で wrap**。Python の多倍長整数とは違い、オーバーフローすると折り返します。

→ 詳しくは [言語ツアー](/guides/tour/) と [リファレンス](/reference/values/)
