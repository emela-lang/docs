---
title: 最初のプロジェクト
description: Pome.toml と src/main.emel、emela run / check / test / fmt、dbg、単独ファイル、終了コード
---

Emela のプロジェクトは、`Pome.toml` を置いたディレクトリです。ソースは `src/` の下に置き、エントリは `src/main.emel` の `main` です。ここでは Hello world を書いて、実行、検査、テスト、整形を一通り試します。

## プロジェクトを作る

```sh
mkdir -p hello/src
cd hello
touch Pome.toml
```

```text
hello/
├── Pome.toml
└── src/
    └── main.emel
```

- `Pome.toml` は空でかまいません。`emela` は渡されたパスから祖先をたどり、最初に見つかった `Pome.toml` のディレクトリをプロジェクトにします。
- `src/` がソースのルートです。1つのファイルが1つのモジュールで、`src/greeting.emel` は `Greeting` として import できます（[モジュールと公開範囲](/guide/modules/)）。
- `Pome.toml` に書く内容（名前、版、依存、既定のターゲット）は [プロジェクトと Pome](/tools/pome/) で扱います。

:::caution[Pome の依存はまだ使えません]
今のコンパイラは `Pome.toml` の有無と `[build].target` だけを見ます。`[dependencies]` は読まず、`emela pome` と `emela new` のコマンドもまだありません。
:::

## Hello world

`src/main.emel`:

```emela check
import Std.Console.{Console}
import Std.Platform.{Platform}

fn greeting(name: String) -> String {
  "Hello, #{name}!"
}

fn main() {
  with Platform {
    console = use Console
    console.print_line(greeting("world"))
  }
}

@test
fn greets_by_name() {
  assert greeting("Emela") == "Hello, Emela!"
}
```

- 画面への出力も副作用なので、エフェクト `Console` の操作として呼びます。`use Console` で能力の値を取り出し、`console.print_line(...)` と書きます。
- `with Platform { ... }` が、本体の中で使う `Console`、`Clock`、`FileSystem` などのホストのハンドラをまとめて供給します。`Console` だけで足りるなら `import Std.Console.{Console, SystemConsole}` として `with SystemConsole { ... }` と書いても同じです。
- `main` の型に残ってよいエフェクトはありません。`with` を外すと、`Console` が供給されていないという診断（E0402）になります。
- `#{...}` は文字列の補間です。

## 実行する

```console
$ emela run
Hello, world!
```

`emela run` は、プロジェクトを JavaScript にコンパイルして Node.js で実行します。パスを省くと `.` を対象にします。出力は `target/emela/js` に書き出され、`main.mjs` がエントリです。

```text
target/emela/js/
├── emela_core/std/...
├── emela_runtime.mjs
└── main.mjs
```

コンパイルだけなら `emela build` です。出力先は同じ `target/emela/js` で、`--out-dir` で変えられます。

## 検査する

`emela check` は、コンパイルせずに診断だけを出します。問題がなければ何も出さずに終了コード 0 で終わります。型を間違えると、こうなります。

```emela check=error
fn main() {
  n: Int = "three"
  dbg(n)
}
```

```console
$ emela check
error[E0301]: type mismatch: expected `Int`, found `String`
   ╭─[ src/main.emel:2:12 ]
   │
 2 │   n: Int = "three"
   │            ───┬───
   │               ╰─────
───╯

1 error
```

## テストする

`@test` を付けた引数のない関数がテストです。`emela test` が1つずつ実行します。

```console
$ emela test
running 1 test
test greets_by_name ... ok

test result: ok. 1 passed; 0 failed; 0 filtered out
```

失敗すると、`assert` の式と両辺の値が出ます。

```console
$ emela test
running 1 test
test fails_on_purpose ... FAILED

failures:

---- fails_on_purpose ----
defect: assertion failed: 1 + 1 == 3
  left: 2
 right: 3

failures:
    fails_on_purpose

test result: FAILED. 0 passed; 1 failed; 0 filtered out
```

`emela test . greets` のように2つ目の引数を渡すと、名前にその文字列を含むテストだけを実行します。テストの出力は `target/emela/test` に書かれ、`emela build` の出力は上書きしません。書き方は [テスト](/guide/testing/) にあります。

## 整形する

`emela fmt` は `src/` の下の `.emel` を書き換えて整形します。`--check` を付けると書き換えず、整形が要るファイルを一覧にして終了コード 1 で終わります。CI ではこちらを使います。

```console
$ emela fmt --check
src/extra.emel
$ emela fmt
```

## dbg で値を見る

`dbg(x)` は `x` を標準エラーに出し、`x` をそのまま返します。式の途中に挟めます。

```emela check
fn main() {
  xs = [1, 2, 3]
  dbg(xs)
  total = dbg(List.fold(xs, 0, fn(acc, x) { acc + x }))
  dbg("total: #{total}")
}
```

```console
$ emela run main.emel
[1, 2, 3]
6
"total: 6"
```

- 表示は値の構造そのままで、文字列は引用符付き、レコードは `User(id: 1, name: "alice")` の形になります。
- 標準エラーに出るので、`emela run main.emel 2>/dev/null` とすると消えます。プログラムの出力には `Console` を使います。
- `main` が返す値は表示されません。

## 単独のファイルで動かす

`Pome.toml` のないディレクトリでは、ファイルを1つ渡すだけで動きます。上の `dbg` の例はこの形で動かしています。

```console
$ emela run main.emel
$ emela check main.emel
$ emela test main.emel
```

- 渡したファイルがエントリです。import できるのは、同じディレクトリの直下にある `.emel` だけです。
- 出力はファイルのあるディレクトリの `target/emela/js`（テストは `target/emela/test`）に書かれます。

このサイトで `check` の付いた例は、すべて単独のファイルとしてコンパイラの検査を通しています。

## 終了コード

| 状況 | 終了コード |
|---|---|
| 正常に終わった | 0 |
| 診断にエラーがある | 1 |
| 期待されるエラーが `main` まで伝わった | 1 |
| defect で終わった | 101 |
| 中断したまま再開されずに終わった | 130 |

`main` まで伝わったエラーは、標準エラーに `error: <値>` と出ます。

```emela check
error Invalid(reason: String)

fn check_age(age: Int) {
  if age < 0 { fail Invalid(reason: "negative age") }
  age
}

fn main() {
  dbg(check_age(20))
  dbg(check_age(-1))
}
```

```console
$ emela run main.emel
20
error: Invalid(reason: "negative age")
$ echo $?
1
```

defect は `defect: <メッセージ>` と出ます。

```emela check
fn main() {
  dbg(1 / 0)
}
```

```console
$ emela run main.emel
defect: division by zero
$ echo $?
101
```

エラーと defect の違いは [エラー](/guide/errors/) で扱います。コマンドの全体は [emela コマンド](/tools/cli/) にあります。
