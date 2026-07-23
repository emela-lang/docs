---
title: 言語ツアー
description: Emela の主要な機能を、例とともに一巡りする
---

このページは Emela を上から順に読んで雰囲気をつかむためのツアーです。
正確な規則は各[リファレンス](/reference/values/)章にリンクしています。

## 束縛と関数

束縛は `let` で、すべて **不変**です。関数は `fn` で定義し、本体は block（式）です。

```emela
fn add(x: Int, y: Int) -> Int {
    let sum = x + y
    sum          -- block の最後の式が値になる。return は無い
}
```

関数は第一級の値で、無名関数（クロージャ）も書けます。

```emela
fn make_adder(n: Int) -> ((Int) -> Int) {
    fn (x: Int) -> Int { x + n }   -- n を capture
}
```

→ [束縛と関数](/reference/functions/)

## プリミティブ型

`Int` は i32、`Float` は f64、ほかに `Bool` / `Char` / `String` / `Unit` があります。

```emela
let n = 42          -- Int（i32）
let pi = 3.14       -- Float（f64）
let ok = true       -- Bool
let c = 'あ'        -- Char（1つの Unicode scalar）
let s = "hello"     -- String（immutable, scalar 単位）
```

整数演算にはいくつか約束があります。`+ - *` は 2³² で **wrap** し、`/` は0方向へ **切り捨て**、
**0除算は panic** します。文字列連結は `++` です。

```emela
7 / 2           -- 3（切り捨て）
"foo" ++ "bar"  -- "foobar"
```

→ [値と型](/reference/values/)

## 式指向の制御フロー

`if` は式で、`else` は必須、両分岐は同じ型を返します。

```emela
let label = if n % 2 == 0 { "even" } else { "odd" }
```

論理演算子 `! && ||` は短絡評価します。比較 `== != < > <= >=` はトレイト経由で、
`Int` / `Float` などに使えます。

**pipeline `|>`** は左辺を右辺呼び出しの第一引数に流し込む糖衣です。処理の流れを素直に書けます。

```emela
xs |> map(double) |> filter(is_even) |> fold(0, add)
-- fold(filter(map(xs, double), is_even), 0, add) と同じ
```

→ [式と制御フロー](/reference/expressions/)

## enum と match

`enum` は名前付き variant の直和型です。variant は `Enum::Variant` で構築・照合します（区切りは `::`）。

```emela
enum Color { Red  Green  Blue }
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

`match` は式で、enum に対しては **網羅的** でなければなりません。ガード（`pattern if cond`）も書けます。

→ [データ型](/reference/data-types/)

## record

`record` は名前付きフィールドの積型です。

```emela
record User { id: Int  name: String }

let u = User { id: 1, name: "alice" }
u.name   -- "alice"
```

→ [データ型](/reference/data-types/#record)

## Option（null の代わり）

「値があるかどうか」は `Option<T>` で表します。`Some` / `None` は import なしで使えます。

```emela
fn first(xs: Array<Int>) -> Option<Int> {
    array_get(xs, 0)   -- 範囲外は None
}

match first(xs) {
    Some(v) -> v
    None -> 0
}
```

→ [データ型 · Option](/reference/data-types/#option)

## ジェネリクスとトレイト

関数とデータ型は型パラメータ `<T>` を取れます。型パラメータは **不透明** で、
具体型固有の操作（算術・比較・フィールドアクセス）はそのままではできません。
必要な能力は **トレイトの境界** `<T: Trait>` で要求します。

```emela
fn identity<T>(x: T) -> T { x }

fn print_line<T: Show>(value: T) -> Unit uses { Io } {
    Io.print(value.to_string() ++ "\n")   -- Show 境界があるので to_string が呼べる
}
```

自分の型にトレイトを実装するには `impl` を書きます。演算子も `+`（`Add`）や `==`（`Eq`）などのトレイトの糖衣なので、
`impl` を与えればユーザー型で演算子が使えます。

```emela
record Vec2 { x: Int  y: Int }

impl Add for Vec2 {
    fn add(a: Vec2, b: Vec2) -> Vec2 {
        Vec2 { x: a.x + b.x, y: a.y + b.y }
    }
}

Vec2 { x: 1, y: 2 } + Vec2 { x: 3, y: 4 }   -- Vec2 { x: 4, y: 6 }
```

`x.method(...)` は `method(x, ...)` の糖衣（レシーバ構文）です。

→ [ジェネリクス](/reference/generics/) · [トレイト](/reference/traits/)

## エフェクト（uses）

副作用は関数型の `uses` 節に書きます。effect 操作は `Effect.op(...)` の形で呼び、
その effect が `uses` に無いと呼べません。

```emela
import std.io

fn shout(msg: String) -> Unit uses { Io } {
    Io.print(msg ++ "!\n")
}
```

`Io` のようにホストが実体を供給する effect（プリミティブ effect）と、
それを土台に純 Emela で実装する effect（派生 effect）があります。
派生 effect は **handler** で実装し、コンパイル時に解決・消去されます（コンパイル時 DI）。

```emela
effect Log {                       -- 派生 effect
    pub fn info(msg: String) -> Unit
}

handler for Log uses { Io } {      -- Io の上に実装
    fn info(msg: String) -> Unit { Io.write_stdout("[INFO] " ++ msg ++ "\n") }
}
```

→ [エフェクト（uses）](/reference/effects/)

## エラー（throws）

回復可能な失敗は関数型の `throws E` と `throw` 式で表します。`uses`（capability）とは
**独立した channel** です。throwing な呼び出しは `?` で伝播するか、`try` / `catch` で捕捉します。

```emela
fn load(path: Path) -> Config throws IoError uses { Fs } {
    let text = read(path)?     -- read が throws。? で呼び出し元へ伝播
    parse(text)?
}
```

`?` は `Option` には使えません。不在を error に橋渡しするには `Option.ok_or` を使います。

→ [エラー（throws）](/reference/errors/)

## モジュール

1ファイル1モジュール。`pub` を付けた定義だけが公開されます。他モジュールの関数は常に修飾形で呼びます。

```emela
module user

pub fn get(id: Int) -> Option<User> uses { Db } { ... }

fn decode(raw: String) -> User throws DecodeError { ... }   -- private
```

```emela
import std.io
import std.list

fn main() -> Unit uses { Io } {
    Io.print(list.length([1, 2, 3]))   -- Io.print: effect 操作 / list.length: 修飾関数
}
```

→ [モジュールとインポート](/reference/modules/)

## まとめの例

`std.list` を使い、1〜99 を「3 の倍数か 3 を含む数」で分類して出力する例です
（[実際のサンプル](https://github.com/emela-lang)より）。

```emela
import std.io
import std.list
import std.string

enum Nabeatsu {
    Fool(String)
    NotFool(String)
}

impl Show for Nabeatsu {
    fn to_string(self: Nabeatsu) -> String {
        match self {
            Nabeatsu::Fool(s) -> "アホ: " ++ s
            Nabeatsu::NotFool(s) -> s
        }
    }
}

fn nabeatsu(n: Int) -> Nabeatsu {
    let str = n.to_string()
    let contain_3 =
        str
        |> string.chars()
        |> list.from_array()
        |> list.contains('3')
    let divisible_by_3 = n % 3 == 0

    if contain_3 || divisible_by_3 {
        Nabeatsu::Fool(str)
    } else {
        Nabeatsu::NotFool(str)
    }
}

fn main() -> List<Unit> uses { Io } {
    list.range(1, 100)
        |> list.map(nabeatsu)
        |> list.map(fn (n: Nabeatsu) -> Unit uses { Io } {
            Io.print(n.to_string() ++ "\n")
        })
}
```

ここまでで主要な機能を一巡りしました。正確な規則は[リファレンス](/reference/values/)へどうぞ。
