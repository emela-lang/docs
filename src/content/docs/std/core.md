---
title: Prelude と core
description: Prelude の型と関数、core のモジュール Int、Int64、Float、String、List、Option の全関数
---

Prelude と core は import なしで使える標準ライブラリです。Prelude の名前は修飾なしで、core のモジュールの関数は `List.map` のようにモジュール名で修飾して呼びます。どれも純粋で、ホストに触れません。

```emela check
fn main() {
  words = String.split("emela is a functional language", " ")
  dbg(List.length(words))                         # 5
  dbg(words |> List.filter(fn(w) { String.length(w) > 2 }))
  dbg(Int.parse("42") escape { ParseError(..) -> 0 })
}
```

## Prelude

Prelude の名前はどのモジュールからも import なしで見えます。

| 分類 | 名前 |
|---|---|
| 型 | `Int` `Int64` `Float` `Bool` `String` `Never` `List` `Option` `Ordering` |
| 構成子 | `True` `False` `Some` `None` `Less` `Equal` `Greater` |
| Trait | `Eq` `Ord` `Show` `Hash` |
| 関数 | `panic` `todo` `dbg` |
| error | `ParseError` |

Prelude で宣言している enum は次の3つです。`Bool` は `False` を先に置いているので、`False < True` です。

```emela
pub enum Bool { False, True }
pub enum Option[A] { Some(A), None }
pub enum Ordering { Less, Equal, Greater }
```

| 宣言 | シグネチャ | 説明 |
|---|---|---|
| `panic` | `panic(message: String) -> Never` | `message` を説明にした defect を起こす |
| `todo` | `todo() -> Never` | まだ書いていない場所の印。`not yet implemented` の defect を起こす |
| `dbg` | `dbg[A: Show](value: A) -> A` | 値の表示を標準エラーに1行出し、値をそのまま返す |
| `ParseError` | `error ParseError(input: String)` | `parse` の入力の形が正しくない。`input` は入力の全体 |

`dbg` の出力は副作用ですが、デバッグ用の例外として `use` に出さず、純粋な関数として扱います。そのため式の途中に挟めます（`xs |> dbg |> List.length`）。defect は型に出ない異常終了で、`emela run` では終了コード 101 になります（[エラー](/guide/errors/)）。

:::caution[0.21 で入る予定]
`trait` と `impl` と `derive`、Trait の制約の検査は 0.21 で入ります。0.20 では、`==` や `<`、補間、`dbg` の表示は、Trait を見ずに構造のまま全部の型で動きます。関数の値だけは表示できません。
:::

## Int

32ビットの符号付き整数です。あふれは2の補数で巻き戻ります。

| 関数 | シグネチャ | 説明 |
|---|---|---|
| `to_string` | `to_string(n: Int) -> String` | 10進の文字列。負なら `-` を付ける |
| `parse` | `parse(s: String) -> Int fails ParseError` | 10進の数字と、先頭の `-` か `+` を読む。それ以外の文字（空白も）と範囲外は `ParseError` |
| `checked_add` | `checked_add(a: Int, b: Int) -> Option[Int]` | 和。あふれたら `None` |
| `bit_and` | `bit_and(a: Int, b: Int) -> Int` | ビットごとの論理積 |
| `bit_or` | `bit_or(a: Int, b: Int) -> Int` | ビットごとの論理和 |
| `bit_xor` | `bit_xor(a: Int, b: Int) -> Int` | ビットごとの排他的論理和 |
| `bit_not` | `bit_not(n: Int) -> Int` | ビットの反転。`-n - 1` と同じ |
| `shift_left` | `shift_left(n: Int, by: Int) -> Int` | 左シフト。`by` が 32 以上なら 0 |
| `shift_right` | `shift_right(n: Int, by: Int) -> Int` | 算術右シフト（上位を符号で埋める）。`by` が 32 以上なら 0 か -1 |
| `shift_right_unsigned` | `shift_right_unsigned(n: Int, by: Int) -> Int` | 論理右シフト（上位を 0 で埋める）。`by` が 32 以上なら 0 |

シフト量が負なら defect です。ビット演算の演算子はなく、関数をパイプでつなぎます（`flags |> Int.bit_and(MASK)`）。

```emela check
const READ: Int = 4
const WRITE: Int = 2

fn main() {
  dbg(2147483647 + 1)                          # -2147483648（巻き戻る）
  dbg(Int.checked_add(2147483647, 1))          # None
  dbg(Int.bit_or(READ, WRITE) |> Int.bit_and(WRITE)) # 2
  dbg(Int.parse(" 42") escape { ParseError(input:) -> String.length(input) }) # 3
}
```

## Int64

64ビットの符号付き整数です。あふれは Int と同じく巻き戻ります。整数のリテラルは、文脈が Int64 を求めれば Int64 になります。

| 関数 | シグネチャ | 説明 |
|---|---|---|
| `from_int` | `from_int(n: Int) -> Int64` | Int から作る |
| `to_int` | `to_int(n: Int64) -> Int` | 下位32ビットを残す（巻き戻る） |
| `to_string` | `to_string(n: Int64) -> String` | 10進の文字列。接尾辞は付けない |
| `bit_and` | `bit_and(a: Int64, b: Int64) -> Int64` | ビットごとの論理積 |
| `bit_or` | `bit_or(a: Int64, b: Int64) -> Int64` | ビットごとの論理和 |
| `bit_xor` | `bit_xor(a: Int64, b: Int64) -> Int64` | ビットごとの排他的論理和 |
| `bit_not` | `bit_not(n: Int64) -> Int64` | ビットの反転 |
| `shift_left` | `shift_left(n: Int64, by: Int) -> Int64` | 左シフト。`by` が 64 以上なら 0、負なら defect |
| `shift_right` | `shift_right(n: Int64, by: Int) -> Int64` | 算術右シフト。`by` が 64 以上なら 0 か -1、負なら defect |
| `shift_right_unsigned` | `shift_right_unsigned(n: Int64, by: Int) -> Int64` | 論理右シフト。`by` が 64 以上なら 0、負なら defect |

```emela check
fn main() {
  big = Int64.from_int(2147483647) + Int64.from_int(1)
  dbg(Int64.to_string(big)) # "2147483648"
  dbg(Int64.to_int(big))    # -2147483648（下位32ビット）
}
```

## Float

IEEE 754 の倍精度（binary64）です。

| 関数 | シグネチャ | 説明 |
|---|---|---|
| `from_int` | `from_int(n: Int) -> Float` | Float にする。どの Int も正確に表せる |
| `parse` | `parse(s: String) -> Float fails ParseError` | `to_string` が書く形（`1.5`、`1e+21`、`Infinity`、`-Infinity`、`NaN`、先頭の符号）を読む。それ以外は `ParseError` |
| `to_string` | `to_string(x: Float) -> String` | 往復できる最短の桁。整数の値なら `.0` を付ける（`1.0`） |
| `floor` | `floor(x: Float) -> Int` | 負の無限大の方向へ丸める |
| `ceil` | `ceil(x: Float) -> Int` | 正の無限大の方向へ丸める |
| `round` | `round(x: Float) -> Int` | 最も近い整数。ちょうど半分は 0 から遠い方へ（`2.5` は 3、`-2.5` は -3） |
| `truncate` | `truncate(x: Float) -> Int` | 0 の方向へ丸める |

- Int への丸めの結果が Int の範囲外か、`NaN`、±`Infinity` なら defect です。巻き戻しも飽和もしません。
- Float のゼロ除算は IEEE のとおり無限大か NaN になり、defect になりません。`%` は fmod で、符号は被除数に従います。
- Int と Float は暗黙に変換されません。`Float.from_int` と丸めの関数で明示します。

```emela check
fn average(xs: List[Int]) -> Float {
  sum = List.fold(xs, from: 0, f: fn(acc, x) { acc + x })
  Float.from_int(sum) / Float.from_int(List.length(xs))
}

fn main() {
  dbg(average([1, 2, 4]))         # 2.3333333333333335
  dbg(Float.round(2.5))           # 3
  dbg(Float.truncate(-2.7))       # -2
  dbg(Float.to_string(0.1 + 0.2)) # "0.30000000000000004"
}
```

## String

Unicode 文字の列です。内部の符号化は観測できません。文字の型はなく、1文字は長さ1の String です。位置を数値で指定する関数はありません。走査は `chars` や `split` で書きます。

| 関数 | シグネチャ | 説明 |
|---|---|---|
| `length` | `length(s: String) -> Int` | 見た目の文字の数（書記素クラスタの数）。`length("👍")` は 1 |
| `byte_size` | `byte_size(s: String) -> Int` | UTF-8 にしたときのバイト数 |
| `append` | `append(a: String, b: String) -> String` | 2つをつなぐ |
| `concat` | `concat(parts: List[String]) -> String` | 全部を順につなぐ。`join(parts, "")` と同じ |
| `join` | `join(parts: List[String], sep: String) -> String` | `sep` を挟んでつなぐ |
| `contains` | `contains(s: String, sub: String) -> Bool` | `sub` を含むか |
| `starts_with` | `starts_with(s: String, prefix: String) -> Bool` | `prefix` で始まるか |
| `ends_with` | `ends_with(s: String, suffix: String) -> Bool` | `suffix` で終わるか |
| `split` | `split(s: String, sep: String) -> List[String]` | `sep` で分ける。`sep` が空なら書記素クラスタごと |
| `chars` | `chars(s: String) -> List[String]` | 書記素クラスタごとのリスト |
| `trim` | `trim(s: String) -> String` | 前後の空白（Unicode の White_Space）を取り除く |
| `code_points` | `code_points(s: String) -> List[Int]` | コードポイントの値のリスト |
| `from_code_point` | `from_code_point(n: Int) -> Option[String]` | コードポイント1つの文字列。`n` が Unicode のスカラー値（0〜10FFFF でサロゲートを除く）でなければ `None` |

- `split` は `join(split(s, sep), sep) == s` が成り立つように分けます。空の要素も残します（`split("a,,b", ",")` は `["a", "", "b"]`）。`split("", "")` は `[]`、`split("", ",")` は `[""]` です。
- `contains`、`starts_with`、`ends_with`、`split` はコードポイントの列で照合し、書記素の境界は見ません。
- `trim` が取り除くのは White_Space 特性の25文字で、表は固定です。U+FEFF（BOM）と U+200B は含みません。
- 文字列の大小比較（`<`）はコードポイントの辞書順です。
- 書記素クラスタの境界は Unicode の版で変わります。ターゲットの間で結果をそろえるために、使う Unicode の版を固定する予定です（版はまだ決まっていません）。

```emela check
fn initials(name: String) -> String {
  String.split(String.trim(name), " ")
    |> List.filter(fn(w) { w != "" })
    |> List.map(fn(w) { Option.or(List.head(String.chars(w)), "") })
    |> String.concat
}

fn main() {
  dbg(initials("  Ada  Lovelace "))       # "AL"
  dbg(String.length("👍"))                # 1
  dbg(String.byte_size("👍"))             # 4
  dbg(String.split("a,b,,c", ","))        # ["a", "b", "", "c"]
  dbg(String.code_points("A"))            # [65]
}
```

:::caution[C のターゲット]
`String.length` は書記素クラスタの表が要るので、`--target c` ではまだ使えません（使うとコンパイルのエラーになります）。`String.length` を中で使う `Instant.to_string` も同じです。
:::

## List

不変の単方向リストです。リストを最初の引数 `xs` に取ります。長いリストでもスタックを使い切らないよう、ループは自分への末尾呼び出しで書かれています。

| 関数 | シグネチャ | 説明 |
|---|---|---|
| `map` | `map[A, B](xs: List[A], f: fn(A) -> B) -> List[B]` | 各要素に `f` を適用する |
| `filter` | `filter[A](xs: List[A], f: fn(A) -> Bool) -> List[A]` | `f` が True の要素だけを、順を保って残す |
| `fold` | `fold[A, B](xs: List[A], from: B, f: fn(B, A) -> B) -> B` | 先頭から畳み込む。`f(f(f(from, x0), x1), x2)` |
| `length` | `length[A](xs: List[A]) -> Int` | 要素の数 |
| `is_empty` | `is_empty[A](xs: List[A]) -> Bool` | 空か |
| `get` | `get[A](xs: List[A], index: Int) -> Option[A]` | `index` 番目（0 始まり）。範囲外と負は `None` |
| `head` | `head[A](xs: List[A]) -> Option[A]` | 先頭の要素。空なら `None` |
| `tail` | `tail[A](xs: List[A]) -> List[A]` | 先頭を除いた残り。空なら空 |
| `reverse` | `reverse[A](xs: List[A]) -> List[A]` | 逆順 |
| `append` | `append[A](xs: List[A], ys: List[A]) -> List[A]` | 2つのリストをつなぐ |
| `flatten` | `flatten[A](xss: List[List[A]]) -> List[A]` | リストのリストを、順を保って平らにする |
| `partition` | `partition[A](xs: List[A], f: fn(A) -> Bool) -> (List[A], List[A])` | `f` が True の要素と False の要素に、順を保って分ける |
| `any` | `any[A](xs: List[A], f: fn(A) -> Bool) -> Bool` | True になる要素があるか。見つけたら止める。空なら False |
| `all` | `all[A](xs: List[A], f: fn(A) -> Bool) -> Bool` | すべて True か。False で止める。空なら True |
| `find` | `find[A](xs: List[A], f: fn(A) -> Bool) -> Option[A]` | True になる最初の要素 |
| `range` | `range(from: Int, to: Int) -> List[Int]` | `from` 以上 `to` 未満の整数を昇順に。`to <= from` なら空 |
| `zip` | `zip[A, B](xs: List[A], ys: List[B]) -> List[(A, B)]` | 同じ位置の要素の組。短い方に合わせる |

```emela check
fn main() {
  (evens, odds) = List.range(1, 7) |> List.partition(fn(x) { x % 2 == 0 })
  dbg(evens)                               # [2, 4, 6]
  dbg(odds)                                # [1, 3, 5]
  dbg(List.zip(evens, ["a", "b"]))         # [(2, "a"), (4, "b")]
  dbg(List.get(evens, 5))                  # None
  dbg(List.fold(odds, from: 0, f: fn(acc, x) { acc + x })) # 9
}
```

## Option

値があるか、ないかを表す Prelude の enum `Option[A]` の関数です。Option を最初の引数 `opt` に取ります。

| 関数 | シグネチャ | 説明 |
|---|---|---|
| `map` | `map[A, B](opt: Option[A], f: fn(A) -> B) -> Option[B]` | 中身に `f` を適用する |
| `and_then` | `and_then[A, B](opt: Option[A], f: fn(A) -> Option[B]) -> Option[B]` | Option を返す `f` を適用して平らにする |
| `or` | `or[A](opt: Option[A], default: A) -> A` | 中身か、`None` なら `default` |
| `is_some` | `is_some[A](opt: Option[A]) -> Bool` | `Some` か |
| `is_none` | `is_none[A](opt: Option[A]) -> Bool` | `None` か |
| `or_fail` | `or_fail[A, E](opt: Option[A], err: E) -> A fails E` | 中身か、`None` なら `err` で fail する |

`or_fail` は Option をエラーに変えます。逆に、エラーを Option に変えるときは escape を使います。

```emela check
error MissingName(key: String)

fn lookup(pairs: List[(String, String)], key: String) -> Option[String] {
  List.find(pairs, fn(p) {
    (k, _) = p
    k == key
  }) |> Option.map(fn(p) {
    (_, v) = p
    v
  })
}

fn main() {
  pairs = [("name", "emela"), ("version", "0.20")]
  dbg(lookup(pairs, "name") |> Option.or("unknown"))  # "emela"
  dbg(lookup(pairs, "license") |> Option.is_none)      # True
  name = lookup(pairs, "author") |> Option.or_fail(MissingName(key: "author")) escape {
    MissingName(key:) -> "no #{key}"
  }
  dbg(name)                                            # "no author"
}
```

## Bool

`Bool` は Prelude の enum で、0.20 には `Bool.to_string` のように呼べる関数のモジュールがありません。否定は `!`、論理積と論理和は `&&` と `||` で、どちらも右辺を必要なときだけ評価します。文字列にするときは補間（`"#{flag}"`）を使います。

```emela check
fn main() {
  ready = True
  dbg(!ready || List.is_empty([1]))  # False
  dbg("ready: #{ready}")             # "ready: True"
}
```

## 数値の意味

| 項目 | 規則 |
|---|---|
| Int の範囲 | -2,147,483,648 から 2,147,483,647 |
| Int64 の範囲 | -2^63 から 2^63 - 1 |
| 整数のあふれ | 2の補数で巻き戻る。defect にはならない（`-2147483648 / -1` も巻き戻る） |
| 整数の除算 | 0 の方向へ切り捨てる。剰余の符号は被除数に従う（`-7 / 2` は -3、`-7 % 2` は -1） |
| 整数のゼロ除算 | defect |
| Float のゼロ除算 | IEEE のとおり無限大か NaN |
| 型の変換 | 暗黙には行わない |

あふれを検出したいときは `Int.checked_add` を使います。数値の意味はどのターゲットでも同じです。詳しくは [ターゲット](/reference/targets/) にあります。
