---
title: 基本の型
description: Int、Int64、Float、Bool、String、Unit、Never、リテラルの形、数値と文字列の意味、演算子の優先順位
---

基本の型は7つです。数値と文字列の計算結果はターゲットに依らず決まっていて、同じプログラムは JavaScript でも C でも同じ値を返します。

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

## 数値のリテラル

```emela check
fn main() {
  dbg(1_000_000)        # 1000000
  dbg(0xFF)             # 255
  dbg(0b1010)           # 10
  mask: Int64 = 0xFFFF_FFFF
  dbg(mask)             # 4294967295
  later = Int64.from_int(1) + 2
  dbg(later)            # 3
  dbg(3.14)             # 3.14
  dbg(1.0e9)            # 1000000000.0
}
```

`_` は桁の区切りで、値には影響しません。`0x` は16進、`0b` は2進です。

整数リテラルの型は、文脈が Int64 を求めれば Int64、それ以外は Int です。上の `Int64.from_int(1) + 2` の `2` は Int64 になります。整数リテラルが Float になることはないので、Float は `1.0` と書きます。指数を付けられるのも `1.0e9` のような小数点のある形だけです。

値が文脈の型の範囲を超えるとエラーです。`3000000000` は Int では書けず、Int64 の文脈なら書けます。

```emela check=error
fn main() {
  n = 3000000000
}
```

```text
integer literal `3000000000` is out of range for `Int`
```

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

`#{式}` で値を埋め込めます。中には任意の式を書けて、型は Show を満たす必要があります。`#{` を文字として書きたいときのエスケープは `\#` です。

使えるエスケープは `\"`、`\\`、`\n`、`\t`、`\r`、`\#`、`\u{...}`（16進のコードポイント）の7つで、それ以外の `\` はエラーです。

```emela check=error
fn main() {
  s = "C:\temp\q"
}
```

```text
unknown escape sequence `\q`
```

:::caution[0.21 で入る予定]
補間の式が Show を満たすかの検査は、Trait とともに 0.21 で入ります。今は構造をそのまま表示する形で、すべての型の値を補間できます。
:::

:::caution[実装との違い]
今のコンパイラ（0.20.1）は、`\"` `\\` `\n` `\#` だけを文字に直します。`\t`、`\r`、`\u{...}` は検査は通りますが、実行時の文字列には `\t` のような2文字以上の並びのまま残ります。
:::

### 複数行の文字列

文字列は改行をまたげないので、複数行は `"""` で囲みます。

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

閉じる `"""` の行のインデントが各行の先頭から取り除かれます。上の例では各行の先頭の空白4つが消え、最初と最後の改行も値に含めません。閉じる `"""` より浅くインデントした行はエラーです。

```emela check=error
fn main() {
  s = """
  one
    """             # one の行が閉じる """ より浅い
}
```

:::caution[実装との違い]
今のコンパイラ（0.20.1）は、複数行の文字列の形の検査はしますが、インデントと前後の改行を取り除きません。上の `query` は各行の先頭の空白と最初と最後の改行を含んだ文字列になります。
:::

リテラルの細かい規則は [字句と予約語](/reference/lexical/) にあります。

## 数値の計算

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

整数があふれると2の補数で巻き戻ります。止まらないので、あふれを検出したいときは `Int.checked_add` のような関数で `Option` を受け取ります。整数の除算は 0 の方向へ切り捨て、Float の計算は IEEE 754 のとおりです。

整数のゼロ除算だけは型に出ない異常終了（defect）になり、プログラムはそこで止まります。

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

### 型の変換は関数で書く

算術演算子の両辺は同じ型でなければならず、Int と Float を混ぜると型エラーになります。

```emela check=error
fn main() {
  x = 1 + 1.5
}
```

```text
type mismatch: expected `Int`, found `Float`
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

`Float.floor`、`ceil`、`round`、`truncate` は Float を Int にします。結果が Int に収まらないときや NaN のときは defect です。文字列から読むときは `Int.parse` と `Float.parse` を使い、形が誤っていれば `ParseError` で失敗します。

### ビット演算

ビット演算の演算子（`&` `|` `<<` など）はなく、core の関数で書きます。

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

Int64 にも同じ関数があります。数値の規則の全体は [ターゲット](/reference/targets/) にあります。

## 文字列の長さと比較

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

`String.length` が返すのは見た目の文字数です。UTF-16 の長さともバイト数とも違い、バイト数は `String.byte_size` で取ります。`s[3]` のように位置を数値で指す API はないので、文字列は `String.chars` や `String.split` でたどります。

文字の型（Char）もなく、1文字は長さ1の String です。

```emela check
fn main() {
  dbg(String.chars("añ👍"))           # ["a", "ñ", "👍"]
  dbg(String.code_points("A"))        # [65]
  dbg(String.from_code_point(65))     # Some("A")
}
```

連結に `+` は使えません。補間か `String.append`、`String.concat` を使います。

```emela check=error
fn main() {
  s = "a" + "b"
}
```

```text
expected a number (`Int`, `Int64` or `Float`), found `String`
```

関数の一覧は [core のモジュール](/std/core/) にあります。

## Bool と Unit と Never

`True` と `False` は Bool の構成子です。`()` は Unit の型であり、その唯一の値でもあって、`else` のない `if` のように値を返さない式の型になります。

Never は値を持たない型で、`fail e` と `panic("...")` の式の型です。Never はどの型とも合流するので、分岐の一方が `panic` でも、全体の型はもう一方の型になります。

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

| 種類 | 演算子 |
|---|---|
| 後置 | `f(x)` `x.name` |
| 単項 | `!x` `-x` |
| 乗除 | `*` `/` `%` |
| 加減 | `+` `-` |
| 比較 | `==` `!=` `<` `<=` `>` `>=` |
| 論理積 | `&&` |
| 論理和 | `\|\|` |
| パイプ | `\|>` |
| escape と match | `式 escape { ... }` `式 match { ... }` |

```emela check
fn main() {
  dbg(1 + 2 * 3)            # 7
  dbg(-2 * 3 + 1)           # -5
  dbg(1 < 2 && 2 < 3)       # True
  dbg(!(1 == 2) || False)   # True
  dbg(3 |> Int.to_string)   # "3"
}
```

比較は連鎖できないので、`a < b < c` は `a < b && b < c` と書きます。`&&` と `||` は短絡評価です。自分で定義した型に演算子を定義することはできず、`Money.add(a, b)` のように関数で書きます。

:::caution[0.21 で入る予定]
`==` は Eq、大小比較は Ord を満たす型に使えます。この検査は Trait とともに 0.21 で入り、今の `==` は関数を含むどの型の値にも構造の比較として使えます。
:::
