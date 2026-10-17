---
title: モジュールと公開範囲
description: 1ファイル1モジュール、パスから決まる名前、import、pub と opaque、名前の解決
---

Emela では1つのファイルが1つのモジュールです。モジュール名はファイルのパスから決まり、ファイルの中でモジュールを宣言する構文はありません。宣言は既定で非公開で、`pub` を付けたものだけがほかのモジュールから見えます。

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

`Email` と `Http.JsonClient` の中身は、このページの pub と opaque の節にあります。

## モジュール名

ソースのルートからのパスを、区切りごとに snake_case から PascalCase へ変え、`.` でつなぎます。

| ファイル | モジュール名 |
|---|---|
| `src/email.emel` | `Email` |
| `src/json_codec.emel` | `JsonCodec` |
| `src/http/client.emel` | `Http.Client` |
| `src/http_2.emel` | `Http2` |

- ファイル名とディレクトリ名は小文字の snake_case にします。`Foo.emel` は E0201、`My-Dir/` は E0202 です。
- 変換後の名前は型名（大文字で始まり、小文字を1つ以上含む）でなければなりません。`a.emel`（`A`）や `x_y.emel`（`XY`）は E0201 です。
- `_` の直後の数字はそのまま残ります。`http_2.emel` は `Http2` になり、`http2.emel` と重複します。
- 同じモジュール名になるファイルが2つあれば E0204 です。大文字小文字だけが違うファイルも重複です。
- `.` で始まるファイルとディレクトリ、`.emel` 以外のファイルは無視します。
- ソースのルート直下の `prelude.emel`、core のモジュールと同じ名前のファイル（`list.emel`、`string.emel` など）、`std.emel` と `std/` は予約されていて置けません（E0203）。

### プロジェクトと単独ファイル

`Pome.toml` を置いたディレクトリがプロジェクトで、`src/` がソースのルートです。

- `emela run` にディレクトリを渡すと（省けばカレントディレクトリ）、祖先をたどって `Pome.toml` を探します。見つからなければ E0207 です。
- プロジェクトのエントリは `src/main.emel` です。`src/lib.emel` はライブラリのルートで、両方を置いてもかまいません。
- ファイルを渡して `Pome.toml` が見つからなければ、単独ファイルとして扱います。そのファイルがエントリで、モジュールは同じディレクトリの直下の `.emel` だけになります（サブディレクトリは見ません）。
- 単独ファイルでは、エントリから import でたどれるファイルだけを読んで検査します。

```sh
emela run main.emel     # 単独ファイル: 隣の greeting.emel を import Greeting で使える
emela run               # プロジェクト: Pome.toml を探して src/main.emel を動かす
```

`Pome.toml` の書き方と依存の扱いは [Pome](/tools/pome/) にあります。今のコンパイラは `Pome.toml` の有無と `[build].target` だけを見るので、空のファイルでもプロジェクトになります。

## import

```emela
import Http.Client                  # Client.get(...) と呼ぶ
import Data.Json.{Json, decode}     # Json と decode を修飾なしで使う
```

- `import A.B` は、最後の名前 `B` をスコープに入れます。`Http.Client` の関数は `Client.get(...)` と呼びます。
- 波括弧で列挙した名前だけが、修飾なしで使えます。全部を取り込む記法（`*`）はありません。
- 波括弧の形でも、`B` はモジュールとしてスコープに入ります。`import Email.{Email}` の後で `Email.parse(...)` も書けます。
- 列挙した名前は、その名前を持つすべての名前空間から取り込みます。type なら型と構成子の両方です。enum のバリアントも名前で個別に取り込めます。
- import はファイルの先頭に置きます。宣言より後ろの import は E0127 です（コメントは数えません）。
- 別名を付ける `as` はありません（予約語ですが、0.20 では構文を持ちません）。
- import した名前は再公開しません。ほかのモジュールから引けるのは、そのモジュールが定義した名前だけです。

```emela check=error
fn main() {}

import Std.Console    # E0127: imports must come before declarations
```

### core と Std

- 同梱の core のモジュール（`List`、`String`、`Int`、`Int64`、`Float`、`Option`）は import なしで `.` の左に書けます。`List.map(...)` はそのまま書けます。
- 型の位置では、`List`、`Option` などの core の型も import なしで使えます（`Option[List[User]]`）。
- 同梱の std のモジュールは `Std` の下にあり、import が要ります。`import Std.Console.{Console, SystemConsole}` のように書きます。

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

```emela check=error
fn main() {
  out = use Std.Console.Console   # E0211: cannot find module or trait `Std` in this scope
}
```

std のモジュールの一覧は [標準ライブラリ](/std/overview/) にあります。

### 循環 import の禁止

モジュールどうしの循環参照はエラーです（E0206）。自分自身の import も含みます。

```text
error[E0206]: import cycle: AMod → BMod → AMod
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

- 宣言は既定で非公開で、`pub` を付けたものだけがほかのモジュールから見えます。
- `pub` を付けられるのはトップレベルの宣言だけです（`fn` `type` `enum` `error` `effect` `handler` `layer` `const` `trait`）。
- フィールドやバリアントを個別に公開・非公開にする指定はありません。type の構成子と enum のバリアントは、親の型の `pub` と `opaque` に従います。
- 非公開の定義をほかのモジュールから参照すると E0214 です（`` `secret` is private to module `Http.JsonClient` ``）。
- 仮引数名は公開 API の一部です（名前付き引数で呼べるため）。
- 公開関数の戻り値の型、`fails`、`use` は省けますが、省くと linter が警告します。

## opaque

`opaque` は型名だけを公開し、中身を隠します。値を作る方法をモジュールの関数に限れるので、「Email 型の値なら検証を通っている」ことを型で保証できます。

| 宣言 | 型名 | 構築 | パターンマッチ | フィールドの参照 |
|---|---|---|---|---|
| `pub type` / `pub enum` | 公開 | 公開 | 公開 | 公開 |
| `pub opaque type` / `pub opaque enum` | 公開 | 定義モジュールの中だけ | 定義モジュールの中だけ | 定義モジュールの中だけ |

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

ほかのモジュールからは、`Email.parse(...)` でしか値を作れません。外で中身に触ろうとすると、それぞれエラーになります。

```emela
# src/main.emel の中で
a = Email(value: "x")             # E0215: cannot construct opaque `Email` outside module `Email`
b = Email(value: "a@b", ..email)  # E0215（部分更新も構築と同じ）
c = email.value                   # E0315: cannot access field `value` of opaque type `Email` outside its module
d = email match {
  Email(value:) -> value          # E0216: cannot match on opaque `Email` outside module `Email`
}
```

- `opaque` は type と enum にだけ、`pub` と一緒に付けます。それ以外は E0131 です。
- 定義したモジュールの中では、ふつうの type と同じに扱えます。

## 名前空間と名前の解決

名前は、型・構成子・値の3つの名前空間と、モジュール名に分かれます。

| 名前空間 | 含まれるもの |
|---|---|
| 型 | type、enum、error、effect、handler、layer、trait |
| 構成子 | type の構成子、enum のバリアント、error、フィールドのある handler |
| 値 | fn、const |

どの名前空間を引くかは、名前を書いた位置で決まります。

- `.` の左ではモジュールと Trait だけを引きます。
- 型の位置では型だけを引きます。
- 式とパターンの型名では構成子だけを引きます。

そのため、上のモジュール `Email` と、その中の型 `Email` は衝突しません。`Email.parse` の `Email` はモジュール、`fn show(email: Email)` の `Email` は（import した）型です。

```emela
import Email                      # 型 Email は修飾なしでは使えない

fn show(email: Email.Email) -> String {   # Email.Email と書くか
  Email.to_string(email)
}
```

`import Email` だけでは、型 `Email` を修飾なしで書けません。書くと E0217（`expected type, found module`）です。`Email.Email` と書くか、`import Email.{Email}` で取り込みます。

- 同じ名前空間での重複は E0213 です。同じモジュールの2つの enum が同じ名前のバリアントを持つ場合、`type Green` とバリアント `Green` も重複です。
- 1つのパターンか引数の並びで、同じ名前を2回束縛すると E0220 です。

### Prelude を隠す

モジュールの定義と import は、Prelude の同じ名前を隠してかまいません。そのときは警告が出ます（W0202）。Prelude に名前が足されても、既存のコードが壊れないようにするためです。

```emela check
enum Maybe {
  Some(Int)       # W0202: `Some` shadows the prelude's `Some`
  Nothing
}

fn main() {
  dbg(Some(1))    # このモジュールの Some
}
```

## 依存した Pome のモジュール

`Pome.toml` の `[dependencies]` に書いた Pome のモジュールは、その Pome のルート名の下に見えます（`Quince`、`Quince.Router`）。ルート名の決まり方と付け替え方は [Pome](/tools/pome/) にあります。

:::caution[実装の状況]
依存（`[dependencies]`、`Pome.lock`、`emela pome` のコマンド）は仕様が決まっていますが、今のコンパイラはまだ実装していません。
:::
