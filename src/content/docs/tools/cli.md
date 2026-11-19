---
title: emela コマンド
description: new、check、build、run、test、fmt、doc、pome、lsp、doctor の引数と出力、実験的な機能のフラグ、環境変数、終了コード
---

`emela` は、プロジェクトの作成、検査、ビルド、実行、テスト、整形、文書の生成、依存の管理、言語サーバー、環境の診断を1つにまとめたコマンドです。規範となる規則は仕様の [付録 B コマンド](https://github.com/emela-lang/emela/blob/main/spec/tooling/commands.md) と [テストランナー](https://github.com/emela-lang/emela/blob/main/spec/tooling/test-runner.md) にあります。このページの出力は emela 0.28.1 のものです。

```console no-check
$ emela --help
Compile, run, test, and format Emela programs

Usage: emela <COMMAND>

Commands:
  new     Create a new Pome in a new directory
  check   Report diagnostics without compiling
  build   Compile to the output of `--target` (`target/emela/js` for JS; an executable for native; `main.wasm` for WASM)
  run     Compile and run: on Node.js, as a native executable (`--target native`), or with wasmtime (`--target wasm`)
  test    Run the functions marked `@test`
  fmt     Format the sources in place
  doc     Generate API documentation under `target/emela/doc`
  pome    Manage dependencies: Pome.toml and Pome.lock
  lsp     Start the language server over standard input and output
  doctor  Report whether the programs each build target uses can be found and are new enough
  help    Print this message or the help of the given subcommand(s)

Options:
  -h, --help     Print help
  -V, --version  Print version
```

| コマンド | 働き |
|---|---|
| `emela new [--lib] <NAME>` | 新しい Pome を新しいディレクトリに作る |
| `emela check [PATH]` | 診断だけを出す。コンパイルしない |
| `emela build [PATH]` | コンパイルして出力先に書き出す |
| `emela run [PATH] [-- ARGS...]` | コンパイルして実行する |
| `emela test [PATH] [FILTER]` | `@test` の関数を実行する |
| `emela fmt [PATHS...]` | ソースを整形して書き換える |
| `emela doc [PATH]` | API の文書を生成する |
| `emela pome <COMMAND>` | 依存を管理する（`Pome.toml` と `Pome.lock`） |
| `emela lsp` | 言語サーバーとして動く |
| `emela doctor [PATH]` | 各ターゲットが使うプログラムがあり、版が足りているかを調べる |

`--help` の文面は英語です。各サブコマンドの `--help` は、そのコマンドが受け取る実験的な機能のフラグも並べます。

## 渡すパス

`check`、`build`、`run`、`test`、`doc`、`doctor` の `PATH` には、プロジェクトのディレクトリかファイルを渡します。省けば `.` です。

ディレクトリを渡すと、祖先をたどって最初に見つかった `Pome.toml` のプロジェクト全体が対象になります。渡せるのはプロジェクトのディレクトリか、`src/` か `test/` の中のディレクトリで、それより外（`scripts/` など）はエラー（E0208）です。`src/` の中のディレクトリを渡しても、型の検査はモジュールをまたぐのでプロジェクト全体を検査します。`Pome.toml` が見つからないディレクトリもエラー（E0207）です。

ファイルを渡して `Pome.toml` が見つからなければ、単独のファイルとして扱います。同じディレクトリの直下の `.emel` だけがモジュールになり、エントリから import でたどれるファイルだけを読みます。ファイル名は小文字の snake_case で、モジュール名に変換できる形でなければなりません。

プロジェクトの決まりは [プロジェクトと Pome](/tools/pome/) にあります。

```console no-check
$ emela check scripts
error[E0208]: directory `scripts` is outside the source root `src`
   = note: source files of a project (the directory with Pome.toml) go under src/, and those only the tests use under test/; pass the project directory, or a file or directory under one of them

1 error
```

## emela new

```text
Usage: emela new [OPTIONS] <NAME>

Arguments:
  <NAME>  A name (`hello`) or a source path (`github.com/alice/hello`, `github:alice/hello`)

Options:
      --lib   Create a library (`src/lib.emel`) instead of an application (`src/main.emel`)
```

- 新しいディレクトリに `Pome.toml`、`.gitignore`（`target/`）、`src/main.emel` を書きます。`--lib` なら `src/main.emel` の代わりに、`pub fn` とテストを持つ `src/lib.emel` を書きます。
- ディレクトリの名前は `NAME` の最後の区切りです。source path を渡すと、それを `[pome].name` に書きます。名前だけなら `github.com/your-name/<名前>` を仮に書き、書き換えるようにコメントを添えます。
- `[pome].emela` には、動かしたコンパイラの版を書きます。

```console no-check
$ emela new hello
created application `hello`
$ emela new --lib github.com/alice/kv
created library `kv`
```

## emela check

```text
Usage: emela check [OPTIONS] [PATH]

Options:
      --experimental-capture-checking  Enable the experimental feature `capture-checking` (since 0.28.0): ...
```

- 型を検査して診断を出します。何も書き出しません。
- 診断は標準エラーに出します。形は [エディタと言語サーバー](/tools/editors/#診断の表示形式) にあります。
- `check` はターゲットを取りません。ターゲットに関わる診断（そのターゲットの `@external` がない E0412 など）は `build`、`run`、`test` で出ます。`[build].target` の誤り（E0232）は `check` でも出ます。
- `test/` と `[dev-dependencies]` も読みます。

## emela build

```text
Usage: emela build [OPTIONS] [PATH]

Options:
      --out-dir <OUT_DIR>  Output directory [default: <project>/target/emela/<target>]
      --target <TARGET>    The target [default: `[build].target` of Pome.toml, or js]
      --experimental-capture-checking
```

- 出力先はプロジェクトなら `<プロジェクト>/target/emela/<ターゲット>`、単独のファイルならファイルのあるディレクトリの `target/emela/<ターゲット>` です。`--out-dir` で変えられます。前の出力は消さずに上書きします。
- `test/` と `[dev-dependencies]` は読みません。`test/` の中のファイルを渡すとエラー（E0208）です。
- ライブラリだけのプロジェクト（`src/lib.emel` だけ）では、検査だけをして何も書き出しません。

### --target

| 値 | 書き出すもの |
|---|---|
| `js` | `main.mjs` とランタイム `emela_runtime.mjs`。`@external` が指すファイルは `emela_core/`、`emela_project/`、`emela_pomes/` に写す |
| `wasm` | WASI 0.3 のコンポーネント `main.wasm` 1つ |
| `native` | 実行ファイル `main` とヘッダ `emela.h`。ほかに出力した C などを置く |

- 省けば `Pome.toml` の `[build].target`、それもなければ `js` です。`--target` が優先します。
- `--target c` は `native` を選び、警告（W0903）を出します。0.29 で取り除きます。
- ターゲットごとに要るものと違いは [ターゲット](/reference/targets/) にあります。

```console no-check
$ emela build --target native
$ ls target/emela/native
emela.h  emela_runtime.c  emela_runtime.h  main  main.c
```

## emela run

```text
Usage: emela run [OPTIONS] [PATH] [-- <ARGS>...]

Options:
      --out-dir <OUT_DIR>  Output directory [default: <project>/target/emela/<target>]
      --target <TARGET>    The target [default: `[build].target` of Pome.toml, or js]
      --experimental-capture-checking
```

- `build` と同じ出力先に書き出してから実行します。
- 診断はプログラムを起動する前に出します。エラーがあれば起動しません。
- 起動する前に、起動するコマンドを ``running `<コマンド>` `` の1行で標準エラーに出します。この行を POSIX のシェルに貼れば同じコマンドが動きます（JS の起動用のモジュールは `<launcher>` と書きます）。このサイトの例ではこの行を省いています。
- プログラムへの引数は `--` の後に書きます（`emela run -- a b`）。`Std.Process` の `Args` で読めます。標準入力はプログラムが引き継ぎます。
- `js` は JS のホスト（既定は `node`）で、`native` は実行ファイル `main` を直接、`wasm` は `wasmtime run -S p3=y` で動かします。
- `main` が返した値は表示しません。`main` が `ExitCode` を返したときは、その終了コードで終わります。
- エントリに `main` がなく、HTTP サービスでもなければエラー（E0230）です。HTTP サービス（`@entry(Http.serve)`）は `127.0.0.1:8080` で待ち受けます。`--addr <host>:<port>` か環境変数 `HOST` と `PORT` で変えられます。

```console no-check
$ emela run
running `node --input-type=module -e <launcher> -- /path/to/hello/target/emela/js/main.mjs`
Hello, world!
```

## emela test

```text
Usage: emela test [OPTIONS] [PATH] [FILTER]

Options:
      --out-dir <OUT_DIR>    Output directory [default: <project>/target/emela/test, or test-native for `--target native`]
      --target <TARGET>      The target [default: `[build].target` of Pome.toml, or js]
      --reporter <REPORTER>  How results are shown [default: agent inside a coding agent, pretty at a terminal, plain otherwise]
      --experimental-capture-checking
```

- `src/` と `test/` の `@test` を付けた関数を1つずつ実行します。
- テストの名前は、エントリのモジュールのものは関数名だけ、ほかのモジュールのものはモジュール名を前に付けます（`Greeting.says_hello`）。
- `FILTER` を渡すと、名前に部分一致する（大文字小文字を区別する）テストだけを実行します。
- 出力は `target/emela/test`（native は `test-native`、WASM は `test-wasm`）に書き、通常のビルドの出力を上書きしません。
- 1つでも失敗すれば終了コード 1、なければ 0 です（テストが0個でも 0）。
- テストだけのファイルに `main` は要りません。

### --reporter

| 値 | 形 |
|---|---|
| `pretty` | 端末で人が読む形。印、色、経過時間を付ける |
| `plain` | テストごとに1行、失敗をまとめて最後に出す。同じ入力からは同じ出力になる |
| `agent` | 失敗と最後の集計の行だけ。コーディングエージェント向け |

省けば、コーディングエージェントの中では `agent`、端末では `pretty`、それ以外（CI、パイプ）では `plain` です。

```emela check
fn add(a: Int, b: Int) -> Int {
  a + b
}

@test
fn adds_small_numbers() {
  assert add(1, 2) == 3
}

@test
fn adds_negative_numbers() {
  assert add(-1, -2) == -3
}
```

```console
$ emela test main.emel --reporter plain
running 2 tests
test adds_small_numbers ... ok
test adds_negative_numbers ... ok

test result: ok. 2 passed; 0 failed; 0 filtered out
$ emela test main.emel small --reporter plain
running 1 test
test adds_small_numbers ... ok

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

- 渡したファイルとディレクトリの `.emel` を整形して書き換えます。省けば `.` のプロジェクトです。設定の項目はありません。
- ディレクトリには `Pome.toml` が要ります。プロジェクトのディレクトリなら `src/` と `test/` の下全部、その中のディレクトリならその下全部が対象で、外はエラーです。
- `.` で始まるものは飛ばします。名前がモジュール名にならないファイルも整形します。
- 構文エラーのファイルは書き換えず、診断を出してほかのファイルを続けます。整形しても変わらないファイルには書き込みません。
- `--check` は書き換えず、整形が要るファイルを標準出力に1行ずつ出します。CI で使えます。
- `-` は標準入力を整形して標準出力に書きます。エディタから呼ぶときに使います。
- 終了コードは、診断にエラーがあるか、`--check` で整形が要るファイルがあれば 1、引数の誤りは 2 です。

```emela check
fn main() {
  dbg(1 + 2)
}
```

```console
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

- `pub` の宣言と、その `##` の文書コメントから API の文書を作ります。依存と `test/` のモジュールは出しません。
- `--format html`（既定）はモジュールの一覧のサイドバー、色付けしたシグネチャ、型の間のリンクを持つページを書きます。`--format md` は `index.md` とモジュールごとの Markdown を書きます。
- `--std` は、プロジェクトの代わりに同梱の core と std の文書を作ります。

```console no-check
$ emela doc --std --format md --out-dir std-docs
std-docs/index.md
$ ls std-docs
Bool.md  Float.md  index.md  Int.md  Int64.md  List.md  Option.md  Prelude.md  Std.Array.md  Std.Bytes.md  ...
```

## emela pome

```text
Usage: emela pome <COMMAND>

Commands:
  add      Add a dependency: `<source path>[@<version>]`, or `github:owner/repo`. Without a version, the latest one
  remove   Remove a dependency (from `[dependencies]` or `[dev-dependencies]`)
  install  Make Pome.lock match Pome.toml and get the dependencies
  update   Raise requirements to the latest version (all of them when none is given)
  list     Print the resolved dependency tree
  verify   Check the cached dependencies against the hashes in Pome.lock
```

- `add` は `--dev`（`[dev-dependencies]` に足す）と `--allow-external`（`[external]` の `allow` にも足す）を取ります。
- 出力と規則は [プロジェクトと Pome](/tools/pome/#emela-pome) にあります。

## emela lsp

```text
Usage: emela lsp
```

引数を取らず、標準入出力で言語サーバーとして動きます。`exit` の通知を受けると 0 で終わります。機能とエディタの設定は [エディタと言語サーバー](/tools/editors/) にあります。

## emela doctor

```text
Usage: emela doctor [OPTIONS] [PATH]

Options:
      --target <TARGET>  Require this target instead of the build target of the project
      --format <FORMAT>  Output format [default: text] [possible values: text, json]
```

- ターゲットごとに、使う外部のプログラム（JS のホスト、C コンパイラ、wasmtime）が見つかって動き、版が足りているかを調べます。native では、C コンパイラで小さな C のプログラムをコンパイルしてリンクしてみます。
- Pome の取得の経路（`EMELA_POMEPROXY`、`EMELA_POMESUMDB`、`EMELA_POMEPRIVATE` の前置きの数）と、git が動くかも出します。前置きそのものと URL の認証情報は出さないので、出力をそのまま公開の報告に貼れます。
- 何も入れず、環境変数も変えず、ネットワークにも出ません。
- プロジェクトの中ではそのビルド対象を必須とします。`--target` で必須のターゲットを選べます。必須のターゲットのプログラムが全部通れば 0、そうでなければ 1 で終わります。
- `--format json` は1つの JSON を出します。

```console no-check
$ emela doctor --target wasm
emela 0.28.1+2d3fe7d

js
  ok       node 22.23.4 (/usr/local/bin/node)
native
  ok       cc gcc (GCC) 16.2.0 (/usr/bin/cc)
wasm (required)
  missing  target `wasm` needs wasmtime 49 or later, but `wasmtime` is not on PATH
           install Wasmtime 49 or later and add it to PATH, or set EMELA_WASMTIME to the wasmtime executable

pome
  proxy    https://pomes.emela.dev, direct
  sumdb    https://sum.emela.dev
  private  0 prefixes
  ok       git 2.56.0 (/usr/bin/git)
```

## 実験的な機能のフラグ

`check`、`build`、`run`、`test` は、実験的な機能ごとに `--experimental-<名前>` を受け取ります。その1回の実行だけ、ビルドする Pome（単独のファイルなら読むファイル）で機能を有効にします。`Pome.toml` の `[experimental]` に足す形で働き、依存には効かず、`Pome.toml` で有効にした機能を無効にもできません。

- 0.28.1 の実験的な機能は `capture-checking` だけです（[実装の状況](/start/status/#実験的な機能)）。
- `--experimental-` で始まり、知らない機能、安定した機能、取り除いた機能を指すフラグはエラーにせず、警告（W0206）にします。
- 言語サーバーはフラグを持たず、`Pome.toml` だけを見ます。

```console no-check
$ emela check --experimental-foo
warning[W0206]: unknown experimental feature `foo`

1 warning
```

## 環境変数

| 変数 | 働き |
|---|---|
| `EMELA_JS_HOST` | `run` と `test` が使う JS のホスト。なければ `node`。`node` と同じく `--input-type=module -e` を受け付けるもの（Node.js と Bun） |
| `EMELA_NODE` | 古い名前。読むと警告（W0902）を出す。`EMELA_JS_HOST` があればそちらを使う |
| `EMELA_CC` | native が使う C コンパイラ。なければ PATH の `cc`。値全体で1つのプログラムを指す |
| `EMELA_CC_ARGS` | C コンパイラに足すフラグ。空白で区切り、コマンドラインの最後に付ける |
| `EMELA_WASMTIME` | WASM が使う wasmtime。なければ PATH の `wasmtime` |
| `EMELA_POMEPROXY`、`EMELA_POMESUMDB`、`EMELA_POMEPRIVATE`、`EMELA_POME_CACHE` | 依存の取得の経路、sumdb、非公開の Pome、キャッシュの場所（[プロジェクトと Pome](/tools/pome/#proxy-と-sumdb)） |
| `NO_COLOR` | 空でない値を入れると、診断に色を付けない。色は、標準エラーが端末で `NO_COLOR` が空か未設定のときだけ付く |

- `js` では、起動する前にホストの版を読み、Node.js 22 か Bun 1.4.3 より古ければ起動せずにエラー（E0904）にします。版を読めなければ起動します。
- `wasm` では、wasmtime の major が 49 より古ければエラー（E0909）です。

```console no-check
$ EMELA_JS_HOST=bun emela run main.emel
running `bun --input-type=module -e <launcher> -- /path/to/target/emela/js/main.mjs`
1
$ EMELA_JS_HOST=/nonexistent/node emela run main.emel
running `/nonexistent/node --input-type=module -e <launcher> -- /path/to/target/emela/js/main.mjs`
error[E0904]: `/nonexistent/node` not found
   = note: install Node.js 22 or later or Bun 1.4.3 or later and add it to PATH, or set EMELA_JS_HOST to the JS host

1 error
```

## 終了コード

`check`、`build`、`run`、`test` の終了コードです。

| コード | 意味 |
|---|---|
| 0 | 成功。診断が警告だけのときも 0 |
| `ExitCode` の値 | `run` で、`main` が `ExitCode` を返した |
| 1 | 診断にエラーがある。`run` では、`main` まで届いたエラー。`test` では、失敗したテストがある |
| 101 | `run` で、プログラムが defect で止まった |
| 130 | `run` で、中断したまま再開されずにプログラムが終わった |
| 141 | `run` で、閉じた標準出力に書いた |
| 128 + シグナル番号 | シグナルで止まった（SIGTERM なら 143） |
| 2 | コマンドの引数の誤り |

```emela check
import Std.Process.{Args, Process, Stderr}

fn main() {
  with Process {
    (use Args).get(0) match {
      None -> {
        (use Stderr).print_line("usage: greet <name>")
        Process.exit_code(2)
      }
      Some(name) -> {
        dbg("hello, #{name}")
        Process.exit_code(0)
      }
    }
  }
}
```

```console
$ emela run main.emel; echo $?
usage: greet <name>
2
$ emela run main.emel -- emela; echo $?
"hello, emela"
0
```

エラーと defect の違いは [エラー](/guide/errors/)、中断は [中断する操作](/guide/suspend/) にあります。
