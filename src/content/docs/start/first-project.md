---
title: 最初のプロジェクト
description: emela new でプロジェクトを作り、run、check、test、build、fmt を一通り試す。dbg、単独ファイル、終了コード
---

`emela new` でプロジェクトを作り、実行、検査、テスト、ビルド、整形を一通り試します。

## プロジェクトを作る

`emela new hello` は、ディレクトリ `hello` に次のファイルを書きます。

```text
hello/
├── .gitignore
├── Pome.toml
└── src/
    └── main.emel
```

`src/main.emel` は1行を出力するだけのプログラムです。

```emela check
import Std.Console.{Console, SystemConsole}

fn main() {
  with SystemConsole {
    console = use Console
    console.print_line("Hello, world!")
  }
}
```

```console
$ emela new hello
created application `hello`
$ cd hello
$ emela run
Hello, world!
```

`emela run` はプロジェクトを JavaScript にコンパイルして Node.js で実行します。パスを省くと `.` を対象にします。プログラムの出力の前に、起動したコマンドを ``running `node ...` `` の1行で標準エラーに出します（このサイトの例では省いています）。

`Pome.toml` は次の形です。

```toml
[pome]
# Replace with the source path of your repository (e.g. github.com/alice/hello).
name = "github.com/your-name/hello"
version = "0.1.0"
emela = "0.28.0"
```

`Pome.toml` を置いたディレクトリがプロジェクトです。`emela` は渡されたパスから祖先をたどり、最初に見つかった `Pome.toml` のディレクトリをプロジェクトにします。`name` は Pome を公開するときのソースパス、`emela` はビルドに要るコンパイラの最低の版です。`emela new github.com/alice/hello` のようにソースパスを渡すと、`name` にそのまま入ります。書ける内容（依存、既定のターゲット、実験的な機能など）は [プロジェクトと Pome](/tools/pome/) にあります。

ソースは `src/` の下に置き、1つのファイルが1つのモジュールになります。`src/greeting.emel` は `Greeting` として import できます。エントリは `src/main.emel` の `main` です。

`emela new --lib kv` はライブラリを作ります。`src/main.emel` の代わりに、`pub fn` とテストを1つずつ持つ `src/lib.emel` を書きます。

## Hello world を書き換える

`src/main.emel` に関数とテストを足します。

```emela check
import Std.Console.{Console, SystemConsole}

fn greeting(name: String) -> String {
  "Hello, #{name}!"
}

fn main() {
  with SystemConsole {
    console = use Console
    console.print_line(greeting("world"))
  }
}

@test
fn greets_by_name() {
  assert greeting("Emela") == "Hello, Emela!"
}
```

画面への出力も副作用なので、エフェクト `Console` の操作として呼びます。`use Console` で能力の値を取り出し、`console.print_line(...)` と書きます。

`with SystemConsole { ... }` は、本体の中で使う `Console` を、ホストの標準出力に書くハンドラで供給します。`main` の型に残ってよいエフェクトはありません。`with` を外すと、`Console` が供給されていないというエラーになります。`Console`、`Clock`、`Random`、`Http` をまとめて供給するときは `Std.Platform` の `with Platform`、ファイルやプロセスの引数、標準入力も使うときは `Std.Process` の `with Process` と書きます（[プラットフォーム](/std/platform/)）。

## 実行する

```console no-check
$ emela run
Hello, world!
```

出力は `target/emela/js` に書き出され、`main.mjs` がエントリです。コンパイルだけなら `emela build` で、出力先は同じです。`--out-dir` で変えられます。

```text
target/emela/js/
├── emela_core/
├── emela_runtime.mjs
└── main.mjs
```

`--target native` を付けると、このマシンの C コンパイラで実行ファイル `target/emela/native/main` を作って動かします。`--target wasm` は `target/emela/wasm/main.wasm` を書いて wasmtime で動かします。それぞれに要るものは [インストール](/start/installation/) にあります。

## 検査する

`emela check` はコンパイルせずに診断だけを出します。問題がなければ何も出さずに終了コード 0 で終わります。型を間違えると、こうなります。

```emela check=error
fn main() {
  n: Int = "three"
  dbg(n)
  ()
}
```

```console no-check
$ emela check
error[E3001]: type mismatch: expected `Int`, found `String`
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

```console no-check
$ emela test
running 1 test
test greets_by_name ... ok

test result: ok. 1 passed; 0 failed; 0 filtered out
```

失敗すると、`assert` の位置と式、両辺の値が出ます。上のファイルの最後に、わざと失敗するテストを足してみます。

```emela
@test
fn fails_on_purpose() {
  assert greeting("a") == "Hi, a!"
}
```

```console no-check
$ emela test
running 2 tests
test greets_by_name ... ok
test fails_on_purpose ... FAILED

failures:

---- fails_on_purpose ----
 --> src/main.emel:21:3
defect: assertion failed: greeting("a") == "Hi, a!"
  left: "Hello, a!"
 right: "Hi, a!"

failures:
    fails_on_purpose

test result: FAILED. 1 passed; 1 failed; 0 filtered out
```

上の出力は `plain` の形です。端末で動かすと、色と印と経過時間の付いた `pretty` の形になります。`--reporter pretty|plain|agent` で選べます（[emela コマンド](/tools/cli/#emela-test)）。

`emela test . greets` のように2つ目の引数を渡すと、名前にその文字列を含むテストだけを実行します。テストだけのモジュールは `test/` の下にも置けます。書き方は [テスト](/guide/testing/) にあります。

## 整形する

`emela fmt` は `src/` と `test/` の下の `.emel` を書き換えて整形します。`--check` を付けると書き換えず、整形が要るファイルを一覧にして終了コード 1 で終わります。CI ではこちらを使います。

```console no-check
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
  total = dbg(List.fold(xs, 0, |acc, x| acc + x))
  dbg("total: #{total}")
  ()
}
```

```console
$ emela run main.emel
[1, 2, 3]
6
"total: 6"
```

表示は値の構造そのままで、文字列は引用符付き、レコードは `User(id: 1, name: "alice")` の形になります。標準エラーに出るので `2>/dev/null` で消せます。プログラムの出力には `Console` を使います。

## 単独のファイルで動かす

`Pome.toml` のないディレクトリでは、ファイルを1つ渡すだけで動きます。上の `dbg` の例はこの形で動かしています。

```console no-check
$ emela run main.emel
$ emela check main.emel
$ emela test main.emel
```

渡したファイルがエントリで、import できるのは同じディレクトリの直下にある `.emel` だけです。出力はファイルのあるディレクトリの `target/emela/js`（テストは `target/emela/test`）に書かれます。

このサイトの例も、単独のファイルとしてコンパイラの検査を通しています。

## 終了コード

| 状況 | 終了コード |
|---|---|
| 正常に終わった | 0 |
| `main` が `ExitCode` を返した | その値 |
| 診断にエラーがある | 1 |
| 期待されるエラーが `main` まで伝わった | 1 |
| defect で終わった | 101 |
| 中断したまま再開されずに終わった | 130 |
| 閉じた標準出力に書いた | 141 |

`main` まで伝わったエラーは、標準エラーに `error: <エラー>` と出ます。エラーの型が `Show` を満たさないときは、名前だけを表示します。

```emela check
error Invalid(reason: String)

fn check_age(age: Int) {
  if age < 0 { fail Invalid(reason: "negative age") }
  age
}

fn main() {
  dbg(check_age(20))
  dbg(check_age(-1))
  ()
}
```

```console
$ emela run main.emel
20
error: Invalid
$ echo $?
1
```

defect は `defect: <メッセージ>` と出ます。

```emela check
fn main() {
  dbg(1 / 0)
  ()
}
```

```console
$ emela run main.emel
defect: division by zero
$ echo $?
101
```

エラーと defect の違いは [エラー](/guide/errors/) に、コマンドの全体は [emela コマンド](/tools/cli/) にあります。
