---
title: Prelude と core
description: import なしで使える Prelude と、Bool、Int、Int64、Float、String、List、Option のモジュール
---

Prelude と core は import なしで使える標準ライブラリです。Prelude の名前は修飾なしで書き、core のモジュールの関数は `List.map` のようにモジュール名で修飾して呼びます。どれも純粋で、ホストに触れません。

```emela check
fn main() {
  words = String.split("emela is a functional language", " ")
  dbg(List.length(words)) # 5
  dbg(words |> List.filter(|w| String.length(w) > 2)) # ["emela", "functional", "language"]
  _ = dbg(Int.parse("42") escape { ParseError(..) -> 0 }) # 42
}
```

関数の一覧は API リファレンスの [Prelude](/std/api/prelude/)、[Bool](/std/api/bool/)、[Int](/std/api/int/)、[Int64](/std/api/int64/)、[Float](/std/api/float/)、[String](/std/api/string/)、[List](/std/api/list/)、[Option](/std/api/option/) にあります。

## Prelude

Prelude の名前は、どのモジュールからも import なしで見えます。

| 分類 | 名前 |
|---|---|
| 型 | `Int` `Int64` `Float` `Bool` `String` `Never` `List` `Option` `Ordering` |
| 構成子 | `True` `False` `Some` `None` `Less` `Equal` `Greater` |
| Trait | `Eq` `Ord` `Show` |
| 関数 | `panic` `todo` `dbg` `inspect` |
| error | `ParseError` |

`panic(message)` は `message` を説明にした defect を起こし、`todo()` はまだ書いていない場所の印として defect を起こします。defect は型に出ない異常終了で、`emela run` では終了コード 101 になります（[エラー](/guide/errors/)）。

`dbg` と `inspect` はどちらも値を見るためのものです。

- `dbg(value)` は値の表示を標準エラーに1行書き、値をそのまま返します。Show を求めず、Show のない型の値も構成子の形で表示します。出力は副作用ですが、デバッグ用の例外として `use` に出さず、式の途中に挟めます（`xs |> dbg |> List.length`）。
- `inspect(value)` は Show による表示を String で返します。いちばん外側の String も `"` で囲みます。

```emela check
type Point(x: Int, y: Int) derive Show

fn main() {
  p = Point(x: 1, y: 2)
  dbg("#{p}") # "Point(x: 1, y: 2)"
  dbg(inspect("a")) # "\"a\""
  _ = dbg(inspect([Some(1), None])) # "[Some(1), None]"
}
```

補間（`"#{p}"`）は Show を使います。いちばん外側の String は囲まず、`inspect` は囲む、という違いだけです。Trait と `derive` の書き方は [Trait](/guide/traits/) にあります。

## 数値

`Int` は32ビット、`Int64` は64ビットの符号付き整数で、`Float` は IEEE 754 の倍精度です。整数のリテラルは、文脈が Int64 か Float を求めればその型になります。型の間の変換は暗黙には行わず、`Float.from_int`、`Int64.from_int` と丸めの関数（`Float.floor`、`ceil`、`round`、`truncate`）で明示します。

| 項目 | 規則 |
|---|---|
| 整数のあふれ | 2の補数で巻き戻る。defect にはならない |
| 整数の除算 | 0 の方向へ切り捨てる。剰余の符号は被除数に従う（`-7 / 2` は -3、`-7 % 2` は -1） |
| 整数のゼロ除算 | defect |
| Float のゼロ除算 | IEEE のとおり無限大か NaN。`%` の符号は被除数に従う |
| Float から Int への丸め | 結果が Int の範囲の外か、NaN か ±Infinity なら defect |

あふれを検出したいときは `Int.checked_add` を使います。ビット演算の演算子はなく、`Int.bit_and` などの関数をパイプでつなぎます。数値の意味はどのターゲットでも同じです（[ターゲット](/reference/targets/)）。

```emela check
fn average(xs: List[Int]) -> Float {
  sum = List.fold(xs, from: 0, f: |acc, x| acc + x)
  Float.from_int(sum) / Float.from_int(List.length(xs))
}

fn main() {
  dbg(2147483647 + 1) # -2147483648（巻き戻る）
  dbg(Int.checked_add(2147483647, 1)) # None
  dbg(Int.max(3, -7) |> Int.abs) # 3
  dbg(average([1, 2, 4])) # 2.3333333333333335
  dbg(Float.round(2.5)) # 3
  _ = dbg(Int64.to_string(Int64.from_int(2147483647) + 1)) # "2147483648"
}
```

Float の `==` は IEEE のとおりで、NaN はそれ自身とも等しくありません。NaN を含む値を並べるときは、NaN を最後に置く `Float.compare` を使います。Float は Ord を持たないので、`Float.max` と `Float.min` もこの順で比べます。

## String

Unicode の文字の列です。内部の符号化は観測できません。文字の型はなく、1文字は長さ1の String です。位置を数値で指定する関数はなく、走査は `chars` や `split` で書きます。

- `length` は見た目の文字（書記素クラスタ）の数で、`byte_size` は UTF-8 にしたときのバイト数です。`String.length("👍")` は 1、`String.byte_size("👍")` は 4 です。
- `split` は空の要素も残し、`List.join(String.split(s, sep), sep) == s` が成り立ちます。
- 大小比較（`<`）はコードポイントの辞書順です。大文字と小文字をそろえるのは ASCII の範囲だけで（`to_ascii_lowercase`）、ほかの文字は変えません。

```emela check
fn initials(name: String) -> String {
  String.split(String.trim(name), " ")
    |> List.filter(|w| w != "")
    |> List.map(|w| Option.or(List.head(String.chars(w)), ""))
    |> String.concat
}

fn main() {
  dbg(initials("  Ada  Lovelace ")) # "AL"
  dbg(String.split("a,b,,c", ",")) # ["a", "b", "", "c"]
  dbg(["a", "b", "", "c"].join(",")) # "a,b,,c"
  _ = dbg(String.to_ascii_uppercase("émela")) # "éMELA"
}
```

文字列を区切りでつなぐ関数は `List.join` です。`String.join` は移行のために残している古い名前で、いずれ取り除かれます。

## List

不変の単方向リストです。リストを最初の引数 `xs` に取ります。長いリストでもスタックを使い切らないように書かれています。並べ替え（`sort`、`sort_by`）は安定です。位置で読むことが多いなら `Std.Array` を、キーで引くなら `Std.Map` を使います（[コレクション](/std/collections/)）。

```emela check
fn main() {
  (evens, odds) = List.range(1, 7) |> List.partition(|x| x % 2 == 0)
  dbg(evens) # [2, 4, 6]
  dbg(List.zip(evens, ["a", "b"])) # [(2, "a"), (4, "b")]
  dbg(odds |> List.take(2)) # [1, 3]
  dbg([3, 1, 2] |> List.sort) # [1, 2, 3]
  longest_first = |a, b| Ord.compare(String.length(b), String.length(a))
  dbg(["bb", "a", "ccc"] |> List.sort_by(longest_first)) # ["ccc", "bb", "a"]
  _ = dbg(List.get(evens, 5)) # None
}
```

## Option

値があるか、ないかを表す Prelude の enum `Option[A]` の関数です。Option を最初の引数 `opt` に取ります。`Option.or` が既定値を与え、`Option.and_then` が Option を返す関数をつなぎます。`Option.or_fail` は `None` をエラーに変え、逆にエラーを Option に変えるときは escape を使います。

```emela check
error MissingName(key: String)

fn lookup(pairs: List[(String, String)], key: String) -> Option[String] {
  List.find(pairs, |p| {
    (k, _) = p
    k == key
  }) |> Option.map(|p| {
    (_, v) = p
    v
  })
}

fn main() {
  pairs = [("name", "emela"), ("license", "MIT")]
  dbg(lookup(pairs, "name") |> Option.or("unknown")) # "emela"
  dbg(lookup(pairs, "author") |> Option.is_none) # True
  name = lookup(pairs, "author") |> Option.or_fail(MissingName(key: "author")) escape {
    MissingName(key:) -> "no #{key}"
  }
  _ = dbg(name) # "no author"
}
```

## Bool

`Bool` は Prelude の enum で、`False < True` です。否定は `!`、論理積と論理和は `&&` と `||` で、どちらも右辺を必要なときだけ評価します。`Bool.to_string` と `Bool.parse` は `"True"` と `"False"` だけを書き、読みます。

```emela check
fn main() {
  ready = True
  dbg(!ready || List.is_empty([1])) # False
  dbg(Bool.to_string(ready)) # "True"
  _ = dbg(Bool.parse("true") escape { ParseError(..) -> False }) # False（大文字小文字を区別する）
}
```
