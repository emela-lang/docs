---
title: 基本の型
description: Int、Int64、Float、Bool、String、Unit、Never、リテラルの形、数値と文字列の意味、演算子の優先順位
---

Emela の基本の型は7つです。数値と文字列の意味（あふれ、除算、文字数の数え方）はターゲットに依らず決まっていて、同じプログラムは JavaScript でも C でも同じ結果を返します。型どうしの暗黙の変換はありません。

```emela check
fn main() {
  count: Int = 42
  big: Int64 = 9_000_000_000
  ratio: Float = 0.75
  done: Bool = False
  name: String = "emela"
  nothing: () = ()
  dbg("#{name}: #{count}, #{big}, #{ratio}, #{done}, #{nothing}")
  # "emela: 42, 9000000000, 0.75, False, ()"
}
```

| 型 | 内容 |
|---|---|
| `Int` | 32ビット符号付き整数 |
| `Int64` | 64ビット符号付き整数 |
| `Float` | 64ビット浮動小数点数（IEEE 754 binary64） |
| `Bool` | `True` か `False` |
| `String` | Unicode 文字の列 |
| `()` | Unit。値は `()` の1つだけ |
| `Never` | 値を持たない型。`fail` や `panic` の式の型 |

`List`、`Option`、`Ordering` も Prelude にある型です。`Option` は [データ型](/guide/data/)、`List` は [core のモジュール](/std/core/) を見てください。

## 整数リテラル

```emela check
fn main() {
  dbg(1_000_000)        # 1000000
  dbg(0xFF)             # 255
  dbg(0b1010)           # 10
  mask: Int64 = 0xFFFF_FFFF
  dbg(mask)             # 4294967295
  later = Int64.from_int(1) + 2
  dbg(later)            # 3
}
```

- `_` は桁の区切りで、値には影響しません。
- `0x` は16進、`0b` は2進です。接頭辞は小文字だけで、16進の数字は大文字でも小文字でもかまいません。8進はありません。
- 整数リテラルの型は、文脈が Int64 を求めれば Int64、それ以外は Int です。Float にはなりません（`1.0` と書きます）。上の `Int64.from_int(1) + 2` の `2` は Int64 です。
- 値が文脈の型の範囲を超えるとエラーになります（E0311）。`3000000000` は Int では書けず、Int64 の文脈なら書けます。2の補数として読み替えることはしないので、`0xFFFF_FFFF` も Int では書けません。
- 負の数はリテラルではなく、単項マイナスを付けた式です。リテラル自体は正の数として範囲を見るので、Int の最小値 `-2147483648` は式では書けません（`-2147483647 - 1` と書きます）。パターンの中だけは `-2147483648` を1つの値として書けます（[パターンマッチ](/guide/pattern-matching/)）。

```emela check=error
fn main() {
  n = 3000000000    # E0311: integer literal `3000000000` is out of range for `Int`
}
```

## 浮動小数点リテラル

```emela check
fn main() {
  dbg(3.14)         # 3.14
  dbg(1.0e9)        # 1000000000.0
  dbg(2.5e-3)       # 0.0025
}
```

- 小数点の前後に数字が要ります。`.5` や `1.` は書けません。
- 指数は小数点のある形にだけ付けられます。`1e9` は E0104 になるので、`1.0e9` と書きます。
- 数値の直後に英字が続く形（`3px`）も E0104 です。
- `1..2` は `1`、`..`、`2`、`1.x` は `1` のフィールド参照の形に読みます。小数点の後に数字がなければ浮動小数点にしません。

## 文字列

```emela check
fn main() {
  name = "emela"
  count = 3
  dbg("hello, #{name}!")            # "hello, emela!"
  dbg("#{count + 1} items")         # "4 items"
  dbg("list: #{[1, 2]}, #{Some(1.5)}")  # "list: [1, 2], Some(1.5)"
  dbg("say \"hi\"")                 # "say \"hi\""
  dbg("literal \#{name}")           # "literal \#{name}"  表示も \# の形
}
```

- `#{式}` で値を埋め込みます（補間）。中の式の型は Show を満たす必要があります。
- `#{ }` の中は普通のコードとして読みます。改行やコメントも書けて、改行は `(` の中と同じく継続になります。
- 文字列は改行をまたげません（E0101）。複数行は `"""` で書きます。
- エスケープを解釈しない生の文字列はありません。

:::caution[0.21 で入る予定]
補間の式が Show を満たすかの検査は、Trait とともに 0.21 で入ります。今は構造をそのまま表示する形で、すべての型の値を補間できます。
:::

### エスケープ

| エスケープ | 意味 |
|---|---|
| `\"` | `"` |
| `\\` | `\` |
| `\n` | 改行（U+000A） |
| `\t` | タブ（U+0009） |
| `\r` | 復帰（U+000D） |
| `\#` | `#`。`#{` を補間でなく文字として書くとき |
| `\u{...}` | 1〜6桁の16進で書いた Unicode のコードポイント |

この7つ以外の `\` はエラーです（E0107）。`\u{...}` にサロゲート（D800〜DFFF）や 10FFFF を超える値を書くと E0108 になります。

```emela check=error
fn main() {
  s = "C:\temp\q"   # E0107: unknown escape sequence `\q`
}
```

:::caution[実装との違い]
今のコンパイラ（0.20.1）は、`\"` `\\` `\n` `\#` だけを文字に直します。`\t`、`\r`、`\u{...}` は検査は通りますが、実行時の文字列には `\t` のような2文字以上の並びのまま残ります。
:::

### 複数行の文字列

```emela check
fn main() {
  id = 1
  query = """
    SELECT *
    FROM users
    WHERE id = #{id}
    """
  # query は "SELECT *\nFROM users\nWHERE id = 1"
}
```

- 開く `"""` の直後は改行でなければなりません。閉じる `"""` はそれだけで1行に置きます。
- 閉じる `"""` の行のインデントを、各行の先頭から取り除きます。上の例では各行の先頭の空白4つが消えます。
- 開く `"""` の直後の改行と、閉じる `"""` の直前の改行は、値に含めません。
- 閉じる `"""` より浅くインデントした行（空行を除く）は E0109 です。インデントは文字の並びとして比べるので、タブと空白が違う行も浅いとみなします。
- 補間とエスケープは普通の文字列と同じく使えます。

```emela check=error
fn main() {
  s = """
  one
    """             # E0109: one の行が閉じる """ より浅い
}
```

:::caution[実装との違い]
今のコンパイラ（0.20.1）は、複数行の文字列の形の検査（E0109）はしますが、インデントと前後の改行を取り除きません。上の `query` は、各行の先頭の空白と最初と最後の改行を含んだ文字列になります。
:::

### Char の型はない

1文字は長さ1の String で表します。文字の型（Char）はありません。文字ごとに分けるときは `String.chars`、コードポイントの数値が要るときは `String.code_points` と `String.from_code_point` を使います。

```emela check
fn main() {
  dbg(String.chars("añ👍"))           # ["a", "ñ", "👍"]
  dbg(String.code_points("A"))        # [65]
  dbg(String.from_code_point(65))     # Some("A")
}
```

## 数値の意味

```emela check
fn main() {
  dbg(2147483647 + 1)       # -2147483648   あふれは巻き戻る
  dbg(Int.checked_add(2147483647, 1))   # None
  dbg(-7 / 2)               # -3   0 の方向へ切り捨て
  dbg(-7 % 2)               # -1   剰余の符号は被除数に従う
  dbg(7 % -2)               # 1
  dbg(1.0 / 0.0)            # Infinity
  dbg(0.0 / 0.0)            # NaN
  dbg(-5.5 % 2.0)           # -1.5
}
```

| 項目 | 規則 |
|---|---|
| Int の範囲 | -2,147,483,648 から 2,147,483,647 |
| Int64 の範囲 | -2^63 から 2^63 - 1 |
| 整数のあふれ | 2の補数で巻き戻る。defect にはならない。`-2147483648 / -1` も巻き戻る |
| 整数の除算 | 0 の方向へ切り捨てる。剰余の符号は被除数に従う |
| 整数のゼロ除算 | defect |
| Float | IEEE 754 binary64。ゼロ除算は IEEE のとおり無限大か NaN。`%` は fmod（被除数の符号） |

あふれを検出したいときは `Int.checked_add` のような関数を使います。

整数のゼロ除算は、型に出ない異常終了（defect）です。プログラムはそこで止まります。

```emela check
fn divide(a: Int, b: Int) -> Int {
  a / b
}

fn main() {
  dbg(divide(10, 0))
}
```

```text
defect: division by zero
```

失敗しうることを型で示したいときは、`b == 0` を先に確かめて [エラー](/guide/errors/) を `fail` します。

### 暗黙の変換はない

算術演算子（`+` `-` `*` `/` `%`）と単項マイナスは Int、Int64、Float にだけ使えます。両辺は同じ型でなければなりません。

```emela check=error
fn main() {
  x = 1 + 1.5       # E0301: type mismatch: expected `Int`, found `Float`
}
```

型を変えるときは関数で明示します。

```emela check
fn main() {
  dbg(Float.from_int(3) + 1.5)          # 4.5
  dbg(Int64.from_int(5))                # 5
  dbg(Int64.to_int(Int64.from_int(7)))  # 7
  dbg(Float.floor(-1.5))                # -2
  dbg(Float.ceil(1.2))                  # 2
  dbg(Float.round(2.5))                 # 3
  dbg(Float.round(-2.5))                # -3
  dbg(Float.truncate(-1.5))             # -1
  dbg(Int.to_string(42))                # "42"
}
```

- `Float.floor`、`ceil`、`round`、`truncate` は Float を Int にします。結果が Int の範囲外か、NaN、±Infinity なら defect です（巻き戻しも飽和もしません）。
- `Float.round` は 0.5 を 0 から遠い方へ丸めます（`2.5` は 3、`-2.5` は -3）。
- `Int64.to_int` は下位32ビットに巻き戻します。
- 文字列からの変換 `Int.parse` と `Float.parse` は、形が誤っていれば `ParseError` で失敗します。
- 型が決まらない数値の式は Int になります。数値の型を抽象する型引数はありません。

### ビット演算は関数で書く

ビット演算の演算子（`&` `|` `<<` など）はありません。core の関数で書きます。

```emela check
const MASK = 0b1100

fn main() {
  dbg(Int.bit_and(0b1010, MASK))        # 8
  dbg(0b1010 |> Int.bit_or(MASK))       # 14
  dbg(Int.shift_left(1, 4))             # 16
  dbg(Int.shift_left(1, 40))            # 0   幅以上のシフトは全部押し出す
  dbg(Int.shift_right(-8, 1))           # -4  符号を保つ
  dbg(Int.shift_right_unsigned(-1, 0))  # -1
}
```

- `Int.bit_and`、`bit_or`、`bit_xor`、`bit_not`、`shift_left`、`shift_right`（符号を保つ）、`shift_right_unsigned` があります。Int64 にも同じものがあります。
- シフト量は Int64 の版でも Int です。負なら defect になります。
- シフト量が型の幅（32 か 64）以上なら、全部のビットを押し出した値になります。`shift_left` と `shift_right_unsigned` は 0、`shift_right` は符号に応じて 0 か -1 です（幅で剰余を取りません）。

## 文字列の意味

```emela check
fn main() {
  dbg(String.length("emela"))     # 5
  dbg(String.length("👍"))        # 1   見た目の文字数
  dbg(String.byte_size("👍"))     # 4   UTF-8 のバイト数
  dbg(String.append("ab", "cd"))  # "abcd"
  dbg(String.concat(["a", "b", "c"]))  # "abc"
  dbg("abc" < "abd")              # True
}
```

- `String.length` は見た目の文字数（書記素クラスタの数）を返します。UTF-16 の長さ（JavaScript の `length`）とも、バイト数とも違います。バイト数は `String.byte_size` です。
- 内部の符号化は観測できません。位置を数値で指す API（`s[3]` や `substring(3, 5)`）はなく、`String.chars` や `String.split` で走査します。
- 大小比較はコードポイントの辞書順です。
- 連結に `+` は使えません。補間（`"#{a}#{b}"`）か `String.append`、`String.concat` を使います。

```emela check=error
fn main() {
  s = "a" + "b"     # E0310: expected a number (`Int`, `Int64` or `Float`), found `String`
}
```

関数の一覧は [core のモジュール](/std/core/) にあります。

## Bool と Unit と Never

- `True` と `False` は Bool の構成子で、キーワードではありません。`False < True` です。
- `()` は Unit の型であり、その唯一の値です。値を返さない関数（`else` のない `if` など）の型が `()` になります。
- Never は値を持たない型です。`fail e` と `panic("...")` の式の型が Never で、Never はどの型とも合流できます。if の一方の分岐が `panic` でも、全体の型はもう一方の型になります。

```emela check
fn first(xs: List[Int]) -> Int {
  xs match {
    [x, ..] -> x
    [] -> panic("empty list")   # Never なので Int の分岐と合流する
  }
}

fn main() {
  dbg(first([3, 4]))    # 3
}
```

## 演算子の優先順位

上ほど強く結合します。

| 順位 | 種類 | 演算子 | 結合 |
|---|---|---|---|
| 1 | 後置 | `f(x)` `x.name` | |
| 2 | 単項 | `!x` `-x` | |
| 3 | 乗除 | `*` `/` `%` | 左結合 |
| 4 | 加減 | `+` `-` | 左結合 |
| 5 | 比較 | `==` `!=` `<` `<=` `>` `>=` | 結合しない |
| 6 | 論理積 | `&&` | 左結合、短絡評価 |
| 7 | 論理和 | `\|\|` | 左結合、短絡評価 |
| 8 | パイプ | `\|>` | 左結合 |
| 9 | escape と match | `式 escape { ... }` `式 match { ... }` | 左結合 |

- 比較は連鎖できません。`a < b < c` は E0119 で、`a < b && b < c` と書きます。
- `==` と `!=` は Eq、大小比較は Ord を満たす型に使えます。両辺は同じ型です。
- 利用者が定義した型に演算子を定義することはできません（演算子の多重定義はない）。`Money.add(a, b)` のように関数で書きます。

```emela check
fn main() {
  dbg(1 + 2 * 3)            # 7
  dbg(-2 * 3 + 1)           # -5
  dbg(1 < 2 && 2 < 3)       # True
  dbg(!(1 == 2) || False)   # True
  dbg(3 |> Int.to_string)   # "3"
}
```

:::caution[0.21 で入る予定]
Eq と Ord を満たすかの検査は、Trait とともに 0.21 で入ります。今の `==` は、関数を含むどの型の値にも構造の比較として使えます。
:::
