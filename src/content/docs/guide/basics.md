---
title: 基本の構文
description: ソースファイル、コメント、文の終わりと行の継続、名前の3つのクラス、予約語
---

セミコロンは書きません。文は改行で終わり、名前が変数か型か定数かは大文字と小文字で決まります。

```emela check
## 2つの数を足す
fn add(x: Int, y: Int) -> Int {
  x + y            # 最後の式が戻り値になる
}

const LIMIT = 10

fn main() {
  total = add(3, 4)
  dbg(total)       # 7
  dbg(total < LIMIT)  # True
}
```

`dbg(value)` は値を標準エラーに1行出して、その値を返す Prelude の関数です。このガイドの例では出力をコメントに書いています。

ソースファイルの拡張子は `.emel` で、符号化は UTF-8 です。1つのファイルが1つの[モジュール](/guide/modules/)になります。名前に使える文字は ASCII だけですが、文字列とコメントの中には何を書いてもかまいません。

## コメント

```emela check
## 登録した利用者
type User(
  ## 一意の番号。0 は管理者
  id: Int,
  name: String,     # 表示名
)

## 図形
enum Shape {
  ## 半径で決まる円
  Circle(radius: Float)
  Empty
}

fn main() {
  # 行の全体をコメントにする
  dbg(User(id: 1, name: "a"))   # User(id: 1, name: "a")
}
```

`#` から行末までがコメントです。`##` で始めると文書コメントになり、直後の宣言やバリアント、フィールドに付いて、`emela doc` が API の文書にします。ブロックコメント（`/* */`）はないので、複数行は各行に `#` を付けます。

## 文の終わりと行の継続

改行で文が終わるので、長い式を折り返すときは、次の行を演算子や `.` で始めます。

```emela check
fn main() {
  total = 1
    + 2
    + 3
  dbg(total)        # 6

  doubled = [1, 2, 3]
    |> List.map(fn(n) { n * 2 })
    # コメントだけの行と空行は飛ばして、次の行を見る

    |> List.fold(from: 0, f: fn(acc, n) { acc + n })
  dbg(doubled)      # 12

  point = (
    1,
    2,
  )
  dbg(point)        # (1, 2)

  label = if total > 5 {
    "big"
  }
  else {
    "small"
  }
  dbg(label)        # "big"
}
```

前の行に続くのは、次の行が二項演算子、`.`、`escape`、`else`、`->`、`|` で始まるときと、開いた `(` や `[` がまだ閉じていないときです。判定するのは次の行の頭だけで、前の行の終わり方は見ません。

長いシグネチャも `->`、`fails`、`|`、`use` の前で折り返せます。本体の `{` はシグネチャの最後の行に書きます。

```emela check
import Std.Console.{Console, SystemConsole}

error Empty
error TooLong(length: Int)

fn check_name(name: String)
  -> String
  fails Empty
    | TooLong
  use Console {
  out = use Console
  out.print_line("checking #{name}")
  n = String.length(name)
  if n == 0 { fail Empty }
  if n > 10 { fail TooLong(length: n) }
  name
}

fn main() {
  with SystemConsole {
    name = check_name("emela") escape {
      Empty -> "?"
      TooLong(_) -> "?"
    }
    dbg(name)       # "emela"
  }
}
```

`fails` と `use` で行が続くのはシグネチャの中だけです。本体の中で `use` から始まる行は、新しい文になります。

### 新しい文になる行

`(` で始まる行は常に新しい文です。関数を呼ぶときは、開き括弧を名前と同じ行に書きます。

```emela check=error
fn add(x: Int, y: Int) -> Int {
  x + y
}

fn main() {
  n: Int = add
  (1, 2)            # add の呼び出しではなく、タプルの式の文
}
```

```text
type mismatch: expected `Int`, found `fn(Int, Int) -> Int`
```

`n` に入ったのは関数 `add` そのもので、次の行の `(1, 2)` は別の文です。

`-` で始まる行も引き算の続きではなく単項マイナスの新しい文です。

```emela check
fn main() {
  a = 10
  -3                # a とは別の文。値は捨てられる
  dbg(a)            # 10

  b = (10
    - 3)            # 括弧の中なので続く
  dbg(b)            # 7
}
```

引き算を次の行に続けるときは、式を括弧で囲みます。

:::caution[実装との違い]
仕様では、行末に二項演算子を置いた形（`a = 10 -` で改行）も次の行へ続きます。今のコンパイラ（0.20.1）はこの形を受け付けません。括弧で囲むか、演算子を次の行の先頭に置いてください（`-` は括弧の中でだけ）。
:::

括弧の中でも、その内側に `{` を開けば、改行はまた文を区切ります。

```emela check
fn main() {
  xs = List.map([1, 2, 3], fn(n) {
    m = n * 10      # { の中なので、ここで文が終わる
    m + 1
  })
  dbg(xs)           # [11, 21, 31]
}
```

細かい規則は [字句と予約語](/reference/lexical/) にあります。

## 名前の3つのクラス

| クラス | 形 | 使うもの | 例 |
|---|---|---|---|
| 小文字名 | 小文字か `_` で始まる snake_case | 変数、関数、フィールド、引数名、エフェクトの操作 | `user_id` `find` |
| 型名 | 大文字で始まり、小文字を1つ以上含む PascalCase | 型、構成子、エラー、エフェクト、ハンドラ、layer、Trait、モジュール、型引数 | `User` `Http` `Db` `Item` |
| 大文字名 | 大文字、数字、`_` だけ | const、型引数 | `MAX_SIZE` `A` |

クラスに合わない名前は構文エラーです。`HTTP` は型名にならないので、`Http` と書きます。

```emela check=error
type HTTP(code: Int)
```

型名と大文字名は、すでにある定義を指す名前で、パターンの中で新しい変数になることはありません。パターンで `Nonee` と打ち間違えても、新しい変数として何にでもマッチしたりせず、「未定義の名前」のエラーになります。

名前のクラスが字句で決まるので、`.` の左側を見れば何への参照か分かります。

```emela check
type Config(port: Int)

const DEFAULT_CONFIG = Config(port: 8080)

fn main() {
  config = Config(port: 3000)
  dbg(config.port)           # 3000   左が小文字名: 値のフィールド
  dbg(DEFAULT_CONFIG.port)   # 8080   左が大文字名: const の値のフィールド
  dbg(List.length([1, 2]))   # 2      左が型名: モジュールの関数
}
```

左が型名なら `List.map` のような静的な参照で、小文字名か大文字名なら `user.name` のような値へのアクセスです。

## 予約語

`fn`、`type`、`if`、`match`、`use`、`with` など25個の予約語は、識別子に使えません。`return`、`while`、`let`、`var`、`try` なども将来のために確保してあります。

```emela check=error
fn main() {
  return = 1        # return は将来のための予約語
}
```

`fails`、`derive`、`init` などは決まった位置でだけ働く語なので、それ以外ではふつうの名前に使えます。`True`、`False`、`Some`、`None` はキーワードではなく、Prelude の enum の構成子です。

全部の一覧は [字句と予約語](/reference/lexical/) にあります。
