---
title: モジュールと公開範囲
description: 1ファイル1モジュール、パスから決まる名前、import、pub と opaque、名前の解決
---

1つのファイルが1つのモジュールです。モジュール名はファイルのパスから決まるので、ファイルの中でモジュールを宣言する構文はありません。宣言は既定で非公開で、`pub` を付けたものだけがほかのモジュールから見えます。

```text
app/
├── Pome.toml
└── src/
    ├── main.emel            # モジュール Main（エントリ）
    ├── email.emel           # モジュール Email
    └── http/
        └── json_client.emel # モジュール Http.JsonClient
```

```emela
# src/main.emel
import Email
import Http.JsonClient.{get}

fn main() {
  dbg(get("/users"))                  # "GET /users"
  email = Email.parse("alice@example.com") escape {
    Email.InvalidEmail(_) -> panic("invalid")
  }
  dbg(Email.to_string(email))         # "alice@example.com"
}
```

`Email` と `Http.JsonClient` の中身はこのページの pub と opaque の節にあります。

## モジュール名

ソースのルートからのパスを、区切りごとに snake_case から PascalCase へ変えて `.` でつなぎます。

| ファイル | モジュール名 |
|---|---|
| `src/email.emel` | `Email` |
| `src/json_codec.emel` | `JsonCodec` |
| `src/http/client.emel` | `Http.Client` |
| `src/http_2.emel` | `Http2` |

ファイル名とディレクトリ名は小文字の snake_case にします。`Foo.emel` や `My-Dir/` はエラーです。`list.emel` や `string.emel` のように core のモジュールと同じ名前になるファイルも置けません。

### プロジェクトと単独ファイル

`Pome.toml` を置いたディレクトリがプロジェクトで、`src/` がソースのルートです。エントリは `src/main.emel` で、ライブラリなら `src/lib.emel` がルートになります。

```sh
emela run main.emel     # 単独ファイル: 隣の greeting.emel を import Greeting で使える
emela run               # プロジェクト: Pome.toml を探して src/main.emel を動かす
```

`emela run` にファイルを渡して `Pome.toml` が見つからなければ、そのファイルを単独で動かします。このときは同じディレクトリの直下の `.emel` だけをモジュールとして import できます。

`Pome.toml` の書き方と依存の扱いは [Pome](/tools/pome/) にあります。今のコンパイラは `Pome.toml` の有無と `[build].target` だけを見るので、空のファイルでもプロジェクトになります。

## import

```emela
import Http.Client                  # Client.get(...) と呼ぶ
import Data.Json.{Json, decode}     # Json と decode を修飾なしで使う
```

`import Http.Client` は最後の名前 `Client` をスコープに入れるので、関数は `Client.get(...)` と呼びます。波括弧で列挙した名前は修飾なしで使えます。全部を取り込む `*` や、別名を付ける `as` はありません。

import はファイルの先頭に置きます。

```emela check=error
fn main() {}

import Std.Console
```

```text
imports must come before declarations
```

`List`、`String`、`Int`、`Option` のような core のモジュールは import なしで `List.map(...)` と書けます。std のモジュールは `Std` の下にあり、import が要ります。

```emela check
import Std.Console.{Console, SystemConsole}

fn main() {
  xs: Option[List[Int]] = Some([1, 2])
  with SystemConsole {
    out = use Console
    out.print_line("#{List.length([1, 2, 3])}")   # 3
  }
  dbg(xs)                                         # Some([1, 2])
}
```

std のモジュールの一覧は [標準ライブラリ](/std/overview/) にあります。

モジュールどうしが互いを import する循環はエラーです。

```text
import cycle: AMod → BMod → AMod
```

2つのモジュールが互いの定義を必要とするときは、共通の部分を3つ目のモジュールに出します。

## pub

```emela
# src/http/json_client.emel
pub fn get(url: String) -> String {
  "GET #{url}"
}

fn secret() -> Int {    # 非公開
  1
}
```

`pub` はトップレベルの宣言に付けます。フィールドやバリアントを個別に公開する指定はなく、type の構成子と enum のバリアントは親の型に従います。ほかのモジュールから `secret` を呼んだときのエラーは `` `secret` is private to module `Http.JsonClient` `` です。

仮引数名も公開 API の一部です。名前付き引数で呼べるので、名前を変えると呼ぶ側が壊れます。

## opaque

`opaque` は型名だけを公開して、中身を隠します。値を作る方法をモジュールの関数に限れるので、「Email 型の値なら検証を通っている」ことを型で保証できます。

```emela
# src/email.emel
pub opaque type Email(value: String)

pub error InvalidEmail(input: String)

pub fn parse(input: String) -> Email fails InvalidEmail {
  if String.contains(input, "@") {
    Email(value: input)
  } else {
    fail InvalidEmail(input:)
  }
}

pub fn to_string(email: Email) -> String {
  email.value
}
```

```emela
# src/main.emel
import Email.{Email, InvalidEmail}

fn show(email: Email) -> String {
  Email.to_string(email)
}

fn main() {
  email = Email.parse("alice@example.com") escape {
    InvalidEmail(input:) -> panic("invalid: #{input}")
  }
  dbg(show(email))      # "alice@example.com"
}
```

ほかのモジュールからは `Email.parse(...)` でしか値を作れません。構成子を呼ぶことも、部分更新も、フィールドを読むことも、パターンで分解することも、外ではエラーです。

```emela
# src/main.emel の中で
a = Email(value: "x")             # cannot construct opaque `Email` outside module `Email`
c = email.value                   # cannot access field `value` of opaque type `Email` outside its module
```

`opaque` は type と enum にだけ、`pub` と一緒に付けます。定義したモジュールの中では、ふつうの type と同じに扱えます。

## 同じ名前のモジュールと型

上の例では、モジュール `Email` の中に型 `Email` があります。2つは衝突しません。`.` の左ではモジュールを、型の位置では型を引くので、`Email.parse` の `Email` はモジュール、`fn show(email: Email)` の `Email` は import した型です。

`import Email` だけでは型 `Email` を修飾なしで書けません。

```emela
import Email

fn show(email: Email.Email) -> String {
  Email.to_string(email)
}
```

`Email.Email` と書くか、`import Email.{Email}` で型を取り込みます。波括弧の形でも `Email` はモジュールとしてスコープに入るので、`Email.parse(...)` はそのまま書けます。

名前空間と名前の引き方の細かい規則は [モジュールと名前の解決](/reference/modules/) にあります。

### Prelude の名前を隠す

自分のモジュールで `Some` のような Prelude の名前を定義すると、Prelude の方が隠れて警告が出ます。

```emela check
enum Maybe {
  Some(Int)       # `Some` shadows the prelude's `Some`
  Nothing
}

fn main() {
  dbg(Some(1))    # このモジュールの Some
}
```

エラーにしないので、後から Prelude に名前が足されても既存のコードは壊れません。

## 依存した Pome のモジュール

`Pome.toml` の `[dependencies]` に書いた Pome のモジュールは、その Pome のルート名の下に見えます（`Quince`、`Quince.Router`）。ルート名の決まり方と付け替え方は [Pome](/tools/pome/) にあります。

:::caution[実装の状況]
依存（`[dependencies]`、`Pome.lock`、`emela pome` のコマンド）は仕様が決まっていますが、今のコンパイラはまだ実装していません。
:::
