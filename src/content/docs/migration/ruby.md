---
title: Ruby から
description: Ruby を書いてきた人のための Emela 入門
---

Ruby から来ると、**動的から静的へ**、そして **すべて不変・式指向** への転換が中心です。
ブロックとメソッドチェーンに慣れているなら、Emela のクロージャと [pipeline `|>`](/reference/expressions/#pipeline-) は馴染みやすいはずです。

## 対応表

| Ruby | Emela |
|---|---|
| 動的型・ダックタイピング | 静的型 + `trait` 境界 |
| すべてがオブジェクト・可変 | 値と不変束縛（`let`） |
| `nil` | `Option<T>`（`Some` / `None`） |
| `raise` / `begin`–`rescue` | `throw` / `try`–`catch`、型に `throws E` |
| `class` | `record` + `trait`/`impl` |
| `module`（mixin） | `trait`（mixin 的な共有） |
| ブロック `{ \|x\| ... }` | 無名関数 `fn (x: Int) -> ... { ... }` |
| `xs.map { }.select { }` | `xs \|> list.map(...) \|> list.filter(...)` |
| モンキーパッチ | 不可（**孤児規則** で impl の場所を制限） |
| gem / Bundler | Pome（`emela pome add`） |

## 型が付く・不変になる

Ruby では変数は再代入でき、多くのオブジェクトは破壊的に変更できます。Emela では束縛は不変で、
文字列も配列も immutable です。「変更」は新しい値を作る操作になります。

```ruby
s = "hello"
s << " world"   # 破壊的
```

```emela
let s = "hello"
let s2 = s ++ " world"   -- 新しい String。s は変わらない
```

## ブロック → 無名関数 + pipeline

Ruby のブロックとメソッドチェーンは、Emela では無名関数と pipeline に対応します。

```ruby
result = (1...100)
  .select { |n| n % 3 == 0 }
  .map { |n| n.to_s }
```

```emela
import std.list

let result =
    list.range(1, 100)
    |> list.filter(fn (n: Int) -> Bool { n % 3 == 0 })
    |> list.map(fn (n: Int) -> String { n.to_string() })
```

`x.map(...)` のようなレシーバ構文も使えます（`x.f(y)` は `f(x, y)` の糖衣）。

## nil は Option

```ruby
def find(id)
  # 見つからなければ nil
end
```

```emela
fn find(id: Int) -> Option<User> uses { Db } { ... }

match find(1) {
    Some(u) -> u.name
    None -> "unknown"
}
```

`nil` チェック忘れによる `NoMethodError` は、`Option` を `match` で開かないと値に触れないことで防がれます。

## クラス → record + trait

```ruby
class User
  attr_reader :name
  def initialize(name) = @name = name
  def greeting = "Hi #{@name}"
end
```

```emela
record User { id: Int  name: String }

fn greeting(u: User) -> String {
    "Hi " ++ u.name
}
```

共通の振る舞いを混ぜ込む Ruby の `module`（mixin）は、Emela では `trait` + `impl` が担います。

## モンキーパッチはできない

Ruby では既存クラスに後からメソッドを生やせますが、Emela の **孤児規則** は
`impl Trait for Type` を書ける場所を「trait を定義したモジュール」か「型を定義したモジュール」に限ります。
これにより (trait, 型) ごとに実装が大域一意になり、どこで何が拡張されたか追える状態を保ちます。

## 気をつけること

- **文字列の破壊的操作は無い**（`<<` や `gsub!` に相当するものは無い。`++` で連結した新しい値を作る）。
- **`import` はモジュール単位**。`list.map(...)` と修飾して呼びます。
- **`puts` は capability**。出力する関数には `uses { Io }` が要ります。
- **式指向**。`if`/`case` に相当する `if`/`match` は値を返す式で、`if` の `else` は必須です。
- **整数は i32 で wrap**。Ruby の多倍長整数とは異なります。

→ 詳しくは [言語ツアー](/guides/tour/) と [トレイト](/reference/traits/)
