---
title: Go から
description: Go を書いてきた人のための Emela 入門
---

Go から来ると、静的型・コンパイル・「継承より合成」といった感覚は共通しています。
大きく変わるのは、**すべて不変・式指向** になること、**`nil` が無い** こと、
そして interface が **構造的（暗黙）から名前的（明示 impl）** になることです。
`if err != nil` のボイラープレートは `?` に置き換わります。

## 対応表

| Go | Emela |
|---|---|
| `struct` | `record` |
| `interface`（構造的・暗黙的に満たす） | `trait`（**名前的・明示的な `impl`**） |
| `nil`（ポインタ / map / slice / interface） | `Option<T>`（`Some` / `None`） |
| `value, err := f()` / `if err != nil` | `throws E` + `?` |
| `panic` / `recover` | `panic`（recover は無し） |
| ゼロ値 | 無し（すべて明示的に構築） |
| `for` / `range` | 再帰 + `list.map` / `filter` / `fold` |
| 型パラメータ + constraint（1.18+） | ジェネリクス + `trait` 境界 |
| メソッド `func (u User) M()` | レシーバ構文 `u.m()` ≡ `m(u)` |
| goroutine / channel | 言語コアには未定義（I/O は effect） |
| `go.mod` / Go Modules | Pome（`Pome.toml` / `emela pome add`） |

## エラー処理：`if err != nil` → `?`

Go の「値とエラーを一緒に返して毎回チェックする」スタイルは、Emela では error channel `throws E` と `?` になります。

```go
// Go
func Load(path string) (Config, error) {
    text, err := read(path)
    if err != nil {
        return Config{}, err
    }
    return parse(text)
}
```

```emela
-- Emela
fn load(path: Path) -> Config throws IoError uses { Fs } {
    let text = read(path)?
    parse(text)?
}
```

`err` を握りつぶす事故は起きません。throwing な呼び出しは `?`（伝播）か `try`–`catch`（捕捉）で必ず扱います。
なお Go の「複数戻り値」は、Emela では戻り値（成功値）＋ `throws`（失敗）で表し、
純粋に複数の値を返したいときは `record` にまとめます。

## interface は構造的 → 名前的

Go の interface は、メソッドが揃っていれば **暗黙に** 満たされます。Emela の trait は **明示的な `impl`** が必要で、
さらに [孤児規則](/reference/traits/#コヒーレンス孤児規則) により実装を書ける場所が制限されます（(trait, 型) ごとに実装は大域一意）。

```go
// Go：Stringer は自動で満たされる
type User struct{ Name string }
func (u User) String() string { return "User " + u.Name }
```

```emela
-- Emela：impl を明示する
record User { id: Int  name: String }

impl Show for User {
    fn to_string(u: User) -> String { "User " ++ u.name }
}
```

「たまたま同じ形だから満たしてしまう」ことは無く、意図した trait だけを実装します。

## ゼロ値が無い

Go では宣言しただけの変数がゼロ値（`0` / `""` / `nil`）を持ちますが、Emela に暗黙のゼロ値はありません。
すべての値は明示的に構築し、「初期化し忘れた `nil` map」のような落とし穴はありません。
「無いかもしれない」は必ず `Option<T>` として型に現れます。

```go
var u *User          // nil。参照すると panic
```

```emela
let u: Option<User> = None   -- 「無い」は Option で明示
```

## ループ → 再帰・コンビネータ

`for` / `range` はありません。反復は再帰か `list` コンビネータ + [pipeline](/reference/expressions/#pipeline-) で書きます。
末尾自己再帰はスタックを消費しません。

```emela
import std.list

names |> list.map(fn (u: User) -> String { u.name })
```

## ジェネリクスと constraint

Go 1.18 の型パラメータと constraint は、Emela のジェネリクスと trait 境界に対応します。
Emela の型パラメータは不透明で、必要な能力は `<T: Trait>` で要求します。

```emela
fn max_by<T: Ord>(a: T, b: T) -> T {
    if a < b { b } else { a }
}
```

## 気をつけること

- **可変性が無い**。`x = x + 1` のような再代入や、slice / map の破壊的更新はできません。更新は新しい値を作ります。
- **`nil` の代わりに `Option`**。map の未登録キーやゼロ値に頼る書き方は `Option` で明示します。
- **goroutine / channel に相当する並行機構は、言語コアの仕様にはまだありません**。I/O は effect（`uses`）で扱います。
- **`import` はモジュール単位**。関数は `list.map(...)` と修飾して呼びます。
- **`recover` は無い**。`panic` は回復不能で、回復可能な失敗は `throws` / `Option` で表します。

→ 詳しくは [トレイト](/reference/traits/) と [エラー](/reference/errors/)
