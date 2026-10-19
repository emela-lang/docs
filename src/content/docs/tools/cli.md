---
title: emela コマンド
description: check、build、run、test、fmt、doc、lsp の引数、出力先、環境変数、終了コード
---

`emela` は検査、ビルド、実行、テスト、整形、文書の生成、言語サーバーを1つにまとめたコマンドです。どのサブコマンドもプロジェクトのディレクトリか単独のファイルを受け取り、省けば `.` を対象にします。

```console
$ emela --help
Compile, run, test, and format Emela programs

Usage: emela <COMMAND>

Commands:
  check  Report diagnostics without compiling
  build  Compile to JavaScript under `target/emela/js` (or to a native executable with `--target c`)
  run    Compile and run: on Node.js, or as a native executable with `--target c`
  test   Run the functions marked `@test`
  fmt    Format the sources in place
  doc    Generate API documentation under `target/emela/doc`
  lsp    Start the language server over standard input and output
  help   Print this message or the help of the given subcommand(s)
```

| コマンド | 働き |
|---|---|
| `emela check [PATH]` | 診断だけを出す。コンパイルしない |
| `emela build [PATH]` | コンパイルして出力先に書き出す |
| `emela run [PATH] [-- ARGS...]` | コンパイルして実行する |
| `emela test [PATH] [FILTER]` | `@test` の関数を実行する |
| `emela fmt [PATHS...]` | ソースを整形して書き換える |
| `emela doc [PATH]` | API の文書を生成する |
| `emela lsp` | 言語サーバーとして動く |

## 渡すパス

`PATH` にはプロジェクトのディレクトリか、エントリのファイルを渡します。

ディレクトリを渡すと、祖先をたどって最初に見つかった `Pome.toml` のプロジェクト全体が対象になり、エントリは `src/main.emel` です。渡せるのはプロジェクトのディレクトリか `src/` の中のディレクトリで、`src/` の外（`scripts/` など）はエラーになります。`src/` の中のディレクトリを渡しても、型の検査はモジュールをまたぐのでプロジェクト全体を検査します。`Pome.toml` が見つからないディレクトリもエラーです。

ファイルを渡して `Pome.toml` が見つからなければ、単独のファイルとして扱います。同じディレクトリの直下の `.emel` だけがモジュールになり、エントリから import でたどれるファイルだけを読みます。ファイル名は小文字の snake_case で、モジュール名に変換できる形でなければなりません（`p.emel` のように変換後の名前が型名にならないものはエラーです）。

プロジェクトの決まりは [プロジェクトと Pome](/tools/pome/) にあります。

```console
$ emela check scripts
error[E0208]: directory `scripts` is outside the source root `src`
   = note: source files of a project (the directory with Pome.toml) go under src/; pass the project directory, or a file or directory under src/

1 error
```

## emela check

```text
Usage: emela check [PATH]
```

- 型を検査して診断を出します。何も書き出しません。
- 診断は標準エラーに出します。形は [エディタと言語サーバー](/tools/editors/) にあります。
- 今の `check` は `--target` を取らず、`Pome.toml` の `[build].target` も見ません。ターゲットに関わる診断（そのターゲットにない操作、知らないターゲット名など）は `build` で出ます。

## emela build

```text
Usage: emela build [OPTIONS] [PATH]

Options:
      --out-dir <OUT_DIR>  Output directory [default: <project>/target/emela/<target>]
      --target <TARGET>    The target [default: `[build].target` of Pome.toml, or js]
```

- 出力先はプロジェクトなら `<プロジェクト>/target/emela/<ターゲット>`、単独のファイルならファイルのあるディレクトリの `target/emela/<ターゲット>` です。`--out-dir` で変えられます。
- `js` では、エントリを写した `main.mjs` とランタイム（`emela_runtime.mjs`）を書き出します。同梱の std のホストのファイルは `emela_core/` の下に置きます。
- `c` では、`main.c` と C のランタイム（`emela_runtime.c`、`emela.h` など）を書き出し、cc でコンパイルした実行ファイル `main` を置きます。

```console
$ emela build --target c main.emel
$ ls target/emela/c
emela.h  emela_core  emela_runtime.c  emela_runtime.h  main  main.c
```

### --target

| 値 | 内容 |
|---|---|
| `js` | Node.js で動く JavaScript |
| `c` | cc でコンパイルする C。native の実行ファイルになる |

- 省けば `Pome.toml` の `[build].target`、それもなければ `js` です。`--target` が優先します。
- JS は Node 18 以降、Deno、Bun のようなサーバーのホストを前提にします。ブラウザは 0.20 の対象外です。
- C は Tier 2 で、対象は macOS（arm64）と Linux（x86_64）、C11 のコンパイラを前提にします。

:::caution[まだないもの]
`--target wasm` はまだありません（WASM の出力は 0.21 以降）。C のターゲットでは、`String.length`（と、それを使う `Instant.to_string`）と Http がまだ使えません。ターゲットの違いは [ターゲット](/reference/targets/) にあります。
:::

## emela run

```text
Usage: emela run [OPTIONS] [PATH] [-- <ARGS>...]

Options:
      --out-dir <OUT_DIR>  Output directory [default: <project>/target/emela/<target>]
      --target <TARGET>    The target [default: `[build].target` of Pome.toml, or js]
```

- `build` と同じ出力先に書き出してから実行します。前の出力は消さずに上書きします。
- 診断はプログラムを起動する前に出します。エラーがあれば起動しません。
- プログラムへの引数は `--` の後に書きます（`emela run -- a b`）。0.20 の std には、引数を読む API はまだありません。
- `main` が返した値は表示しません。
- エントリに `main` がなければエラーです。

```console
$ emela run main.emel
error: Oops(code: 3)
$ echo $?
1
```

## emela test

```text
Usage: emela test [OPTIONS] [PATH] [FILTER]

Options:
      --out-dir <OUT_DIR>  Output directory [default: <project>/target/emela/test, or test-c for `--target c`]
      --target <TARGET>    The target [default: `[build].target` of Pome.toml, or js]
```

- `@test` を付けた関数を1つずつ実行します。
- テストの名前は、エントリのモジュールのものは関数名だけ、ほかのモジュールのものはモジュール名を前に付けます（`Greeting.says_hello`）。
- `FILTER` を渡すと、名前に部分一致する（大文字小文字を区別する）テストだけを実行します。単独のファイルでは、エントリから import でたどれるモジュールのテストだけが対象です。
- 出力は `target/emela/test`（C は `target/emela/test-c`）に書き、通常のビルドの出力を上書きしません。
- 1つでも失敗すれば終了コード 1、なければ 0 です（テストが0個でも 0）。
- テストだけのファイルに `main` は要りません。

```console
$ emela test . says
running 1 test
test Greeting.says_hello ... ok

test result: ok. 1 passed; 0 failed; 1 filtered out
```

テストの書き方は [テスト](/guide/testing/) にあります。

## emela fmt

```text
Usage: emela fmt [OPTIONS] [PATHS]...

Arguments:
  [PATHS]...  Files or directories to format [default: `src` of the project at `.`]. `-` reads standard input and writes standard output

Options:
      --check  Do not write; list the files that need formatting on standard output and exit with 1 if any
```

- 渡したファイルとディレクトリの `.emel` を整形して書き換えます。省けば `.` のプロジェクトの `src` です。
- ディレクトリには `Pome.toml` が要ります。プロジェクトのディレクトリならソースのルートの下全部、ソースのルートの中ならその下全部が対象で、ソースのルートの外はエラーです。
- `.` で始まるものは飛ばします。名前がモジュール名にならないファイルも整形します。
- 構文エラーのファイルは書き換えず、診断を出してほかのファイルを続けます。
- `--check` は書き換えず、整形が要るファイルを標準出力に1行ずつ出します。CI で使えます。
- `-` は標準入力を整形して標準出力に書きます。エディタから呼ぶときに使います。
- 終了コードは、診断にエラーがあるか、`--check` で整形が要るファイルがあれば 1、引数の誤りは 2 です。

```console
$ emela fmt --check
src/main.emel
$ printf 'fn  main( ) {\n dbg( 1+2 )\n}\n' | emela fmt -
fn main() {
  dbg(1 + 2)
}
```

## emela doc

```text
Usage: emela doc [OPTIONS] [PATH]

Options:
      --std                Document the bundled core and std instead of the project
      --format <FORMAT>    Output format [default: html] [possible values: html, md]
      --out-dir <OUT_DIR>  Output directory [default: <project>/target/emela/doc]
```

- `pub` の宣言と、その `##` の文書コメントから API の文書を作ります。
- `--format html`（既定）はモジュールの一覧のサイドバー、色付けしたシグネチャ、型の間のリンクを持つページを書きます。`--format md` は `index.md` とモジュールごとの Markdown を書きます。
- `--std` は、プロジェクトの代わりに同梱の core と std の文書を作ります。

```console
$ emela doc --std --format md --out-dir std-docs
$ ls std-docs
Float.md  index.md  Int.md  Int64.md  List.md  Option.md  Prelude.md  Std.Cause.md  ...
```

## emela lsp

```text
Usage: emela lsp
```

引数を取らず、標準入出力で言語サーバーとして動きます。機能とエディタの設定は [エディタと言語サーバー](/tools/editors/) にあります。

## 環境変数

| 変数 | 働き |
|---|---|
| `EMELA_NODE` | `run` と `test` が使う node。なければ PATH の `node`。見つからなければエラー |
| `EMELA_CC` | `--target c` が使う C コンパイラ。なければ PATH の `cc`。起動できないときと、コンパイルに失敗したときはエラー |
| `NO_COLOR` | 空でない値を入れると、診断に色を付けない。色は、標準エラーが端末で `NO_COLOR` が空か未設定のときだけ付く |

```console
$ EMELA_NODE=/nonexistent/node emela run main.emel
error[E0904]: `/nonexistent/node` not found
   = note: install Node.js and add it to PATH, or set EMELA_NODE to the node executable

1 error
```

## 終了コード

`check`、`build`、`run`、`test` の終了コードです。

| コード | 意味 |
|---|---|
| 0 | 成功。診断が警告だけのときも 0 |
| 1 | 診断にエラーがある。`run` では、`main` まで届いたエラー。`test` では、失敗したテストがある |
| 101 | `run` で、プログラムが defect で止まった |
| 130 | `run` で、中断したまま再開されずにプログラムが終わった |
| 128 + シグナル番号 | シグナルで止まった（SIGTERM なら 143） |
| 2 | コマンドの引数の誤り |

```console
$ emela run defect.emel
defect: boom
$ echo $?
101
```

エラーと defect の違いは [エラー](/guide/errors/)、中断は [中断と再開](/guide/suspend/) にあります。

## 仕様にあって CLI にまだないもの

:::caution[予定]
仕様は `emela pome add / remove / install / update / list` と `emela new` を定めていますが、今の CLI にはありません（`unrecognized subcommand` になります）。これらは [プロジェクトと Pome](/tools/pome/) で予定として扱います。
:::
