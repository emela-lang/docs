---
title: 基本の構文
description: ソースファイル、コメント、文の終わりと行の継続、名前の3つのクラス、予約語
---

Emela のソースは、セミコロンのない、改行で文を区切る形です。名前の種類（変数か、型か、定数か）は大文字と小文字で決まり、文の終わりは改行で決まります。どちらも字句の段階で確定するので、読む人も、コンパイラも、名前の定義を探さずにコードの形を読めます。

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

`dbg(value)` は値を標準エラーに1行出して、その値を返す Prelude の関数です。このガイドの例では、出力をコメントに書いています。

## ソースファイル

- 拡張子は `.emel`、符号化は UTF-8 です。
- 1つのファイルが1つのモジュールになります（[モジュールと公開範囲](/guide/modules/)）。
- セミコロンは使いません。文は改行で終わります。
- 空白はスペースとタブです。改行は `\n` か `\r\n` で、どちらも1つの改行として扱います。単独の `\r` と、全角空白のような Unicode の空白は「認識できない文字」になります（E0105）。
- 名前に使える文字は ASCII だけです。文字列とコメントの中には何を書いてもかまいません。

## コメントと文書コメント

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

- `#` から行末までがコメントです。
- `##` は文書コメントで、直後の宣言、バリアント、フィールド、エフェクトの操作、handler の項目に付きます。`emela doc` が API の文書にします。
- 宣言と `derive` の間に書いた `##` は、宣言に付きません。
- ブロックコメント（`/* */`）はありません。複数行は各行に `#` を付けます。

## 文の終わりと行の継続

改行は文を終わらせます。ただし、次のどれかに当たるときは前の行が続きます。

1. 次の行が二項演算子（`+` `*` `==` `&&` `|>` など）、`.`、`escape`、`match {` で始まる
2. 開いた `(` か `[` がまだ閉じていない
3. 次の行が `else`、`->`、`|` で始まる
4. 関数のシグネチャの中で、次の行が `fails` か `use` で始まる

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

継続するかどうかは、改行の次の「意味のあるトークン」で決まります。間の空白、コメントだけの行、空行は飛ばします。前の行の終わり方は見ません。

### シグネチャの継続

長いシグネチャは、`->`、`fails`、`|`、`use` の前で折り返せます。本体の `{` はシグネチャの最後の行に書きます。

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

`fails` と `use` で継続するのはシグネチャの中だけです。本体の中では `fails` はふつうの変数名に使え、`use` で始まる行は新しい文（`use X` の式）になります。

### `(` で始まる行は新しい文

`(` と `[` で始まる行は、常に新しい文です。関数の呼び出しや型引数の開き括弧は、名前と同じ行に書きます。

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
error[E0301]: type mismatch: expected `Int`, found `fn(Int, Int) -> Int`
```

`n` に入ったのは関数 `add` そのもので、次の行の `(1, 2)` は別の文です。JavaScript では行頭の `(` が前の行の呼び出しにつながってしまいますが、Emela では常に新しい文として読みます。

### `-` で始まる行は単項マイナス

`-` で始まる行は、引き算の続きではなく、単項マイナスの新しい文です。

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

引き算を次の行に続けるときは、行末に `-` を置くか、式を括弧で囲みます。

:::caution[実装との違い]
仕様では、行末に二項演算子を置いた形（`a = 10 -` で改行）も次の行へ続きます。今のコンパイラ（0.20.1）はこの形を受け付けず、E0118 になります。行末の演算子で折り返す代わりに、括弧で囲むか、演算子を次の行の先頭に置いてください（`-` は括弧の中でだけ）。
:::

### 括弧の中と波括弧

規則2の「開いた括弧」は、入れ子の一番内側で判定します。`(` の中でも、その内側に `{` を開けば、改行はまた文を区切ります。

```emela check
fn main() {
  xs = List.map([1, 2, 3], fn(n) {
    m = n * 10      # { の中なので、ここで文が終わる
    m + 1
  })
  dbg(xs)           # [11, 21, 31]

  s = "sum: #{
    1 + 2
  }"
  dbg(s)            # "sum: 3"
}
```

文字列の補間 `#{ }` の中の改行は、`(` の中と同じく継続になります。

### match の継続

`match` で始まる行は、次のトークンが `{` のときだけ前の行に続きます（後置の `式 match { ... }` の続き）。`match x {` のように前置で書いた行は新しい文として読まれ、E0142 になります。詳しくは [パターンマッチ](/guide/pattern-matching/) を見てください。

## 名前の3つのクラス

| クラス | 形 | 使うもの | 例 |
|---|---|---|---|
| 小文字名 | 小文字か `_` で始まる snake_case | 変数、関数、フィールド、引数名、エフェクトの操作 | `user_id` `find` |
| 型名 | 大文字で始まり、小文字を1つ以上含む PascalCase | 型、構成子、エラー、エフェクト、ハンドラ、layer、Trait、モジュール、型引数 | `User` `Http` `Db` `Item` |
| 大文字名 | 大文字、数字、`_` だけ | const、型引数 | `MAX_SIZE` `A` |

- クラスに合わない名前は構文エラーです。`HTTP` や `DB` は型名にならないので、`Http`、`Db` と書きます。
- 型名と大文字名は、すでにある定義を指す名前です。式やパターンの中で新しく束縛されることはありません。パターンで `Nonee` と打ち間違えると、新しい変数にはならず、必ず「未定義の名前」のエラーになります。
- `_` は、値を束縛しないパターンです。
- `userId` や `HTTPServer` のような形は字句としては通ります。snake_case と PascalCase の慣習は linter が検査します。

```emela check=error
type HTTP(code: Int)   # E0110: HTTP は型名のクラスに合わない
```

### `.` の左側を読む

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

- 左が型名なら、静的な参照です（モジュールの関数、Trait の関数）。`List.map`、`Email.parse`
- 左が小文字名か大文字名なら、値へのアクセスです（フィールド、`use` で得た能力の値の操作）。`user.name`、`log.info`、`DEFAULT_CONFIG.port`

## 予約語

予約語は25個で、どの位置でも識別子に使えません。

| 分類 | 語 |
|---|---|
| 宣言 | `fn` `type` `enum` `error` `const` `trait` `impl` `effect` `handler` `layer` `import` |
| 修飾 | `pub` `opaque` `suspend` |
| 式 | `if` `else` `match` `fail` `escape` `use` `with` `assert` |
| 特別な名前 | `self` `Self` |
| まだ構文がない | `as` |

- `fails`、`derive`、`implements`、`init`、`release` などは、決まった位置でだけ働く文脈依存の語です。それ以外の位置ではふつうの名前に使えます。
- `return`、`while`、`let`、`var`、`try` などは将来のために確保してあり、識別子に使えません。
- `True`、`False`、`Some`、`None` はキーワードではなく、Prelude の enum の構成子です。`panic`、`todo`、`dbg` も Prelude の関数です。

```emela check=error
fn main() {
  return = 1        # return は将来のための予約語
}
```

全部の一覧と文脈依存の語の位置は [字句](/reference/lexical/) にあります。

## 次に読む

- [基本の型](/guide/types/): 数値、文字列、リテラルの形
- [束縛と関数](/guide/functions/): `=` の束縛と `fn` の宣言
