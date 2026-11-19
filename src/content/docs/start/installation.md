---
title: インストール
description: install.sh で emela を入れる、Windows、GitHub Actions、ターゲットごとに要るもの、emela doctor、エディタ
---

`emela` は1つの実行ファイルで、コンパイラ、テストランナー、フォーマッタ、文書の生成、依存の管理、言語サーバーを兼ねます。リリースのビルド済みのバイナリは macOS（Apple Silicon）、Linux（x86_64）、Windows（x86_64、0.28 から）向けです。

## macOS と Linux

```sh
curl -fsSL https://emela.dev/install.sh | sh
emela --version
```

```console no-check
$ emela --version
emela 0.28.1+2d3fe7d
```

最新のリリースが `$HOME/.emela/bin/emela` に入ります。そのディレクトリが `PATH` になければ、スクリプトが最後に `add $HOME/.emela/bin to PATH to run emela directly` と知らせます。シェルの設定に足してください。入れ直すときも同じコマンドで、前の `emela` は置き換わります。

環境変数で、置き場所と版を変えられます。

| 変数 | 働き | 例 |
|---|---|---|
| `EMELA_INSTALL_DIR` | 置くディレクトリ（既定は `$HOME/.emela/bin`） | `EMELA_INSTALL_DIR=$HOME/bin` |
| `EMELA_VERSION` | 入れる版。省けば最新のリリース。`v` は付けても付けなくてもよい | `EMELA_VERSION=0.28.1` |
| `EMELA_CHANNEL` | `nightly` にすると、最新の開発版（prerelease）を入れる。既定は `stable` | `EMELA_CHANNEL=nightly` |

```sh
curl -fsSL https://emela.dev/install.sh \
  | EMELA_INSTALL_DIR="$HOME/bin" EMELA_VERSION=0.28.1 sh
```

`nightly` は GitHub の API で一覧を引くので、回数の制限に当たったら `GITHUB_TOKEN` を設定します。

## Windows

`install.sh` は Windows に対応していません。[リリース](https://github.com/emela-lang/emela/releases) から `emela-<tag>-x86_64-pc-windows-msvc.zip` を取ってきて、中の `emela.exe` を `PATH` の通ったディレクトリに置きます。

Windows では JS と WASM のターゲットが使えます。native のターゲットは Windows に対応していません。

## GitHub Actions

CI では [emela-lang/setup-emela](https://github.com/emela-lang/setup-emela) が `emela` を入れて `PATH` に足します。

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with:
      node-version: 22
  - uses: emela-lang/setup-emela@v1
    with:
      version: 0.28.1
  - run: emela pome install
  - run: emela fmt --check
  - run: emela test
```

- `version` を省くと最新の安定版を入れます。
- 対応する runner は Linux の x64（`ubuntu-latest` など）と macOS の ARM64（`macos-latest` など）です。
- `emela run` と `emela test` の JS ターゲットは Node.js を使うので、`actions/setup-node` で入れます。
- 依存のない Pome では `emela pome install` は要りません。

## ターゲットごとに要るもの

| 使うもの | 要るもの |
|---|---|
| `emela check`、`fmt`、`doc`、`lsp`、`new` | なし |
| `emela pome` | ネットワーク。`direct` で取るときと `EMELA_POMEPRIVATE` を使うときは git |
| `run`、`test`（JS ターゲット、既定） | Node.js 22 以降、または Bun 1.4.3 以降 |
| `--target wasm` | Wasmtime 49 以降 |
| `--target native` | C11 のコンパイラ（`cc`）と、システムの C ヘッダとライブラリ |

- JS ターゲットは、出力した JavaScript を `PATH` の `node` で動かします。環境変数 `EMELA_JS_HOST` に別のコマンドを入れると、そちらを使います（Bun なら `EMELA_JS_HOST=bun`）。ブラウザはターゲットではありません。
- WASM ターゲットは WASI 0.3 のコンポーネント `main.wasm` を書き、`wasmtime run -S p3=y` で動かします。別の wasmtime を使うときは `EMELA_WASMTIME` を設定します。
- native ターゲットは、出力した C をこのマシンの C コンパイラでコンパイルして実行ファイルを作ります。別のコンパイラは `EMELA_CC=clang`、追加のフラグは `EMELA_CC_ARGS` で指定します。対象は macOS（arm64）と Linux（x86_64、glibc）です。

ターゲットの違いと、まだ使えない機能は [ターゲット](/reference/targets/) と [実装の状況](/start/status/) にあります。

## emela doctor で確かめる

`emela doctor` は、各ターゲットが使うプログラムが見つかり、版が足りているかを調べます。何も入れず、ネットワークにも出ません。

```console no-check
$ emela doctor
emela 0.28.1+2d3fe7d

js
  ok       node 22.23.4 (/usr/local/bin/node)
native
  ok       cc gcc (GCC) 16.2.0 (/usr/bin/cc)
wasm
  missing  target `wasm` needs wasmtime 49 or later, but `wasmtime` is not on PATH
           install Wasmtime 49 or later and add it to PATH, or set EMELA_WASMTIME to the wasmtime executable

pome
  proxy    https://pomes.emela.dev, direct
  sumdb    https://sum.emela.dev
  private  0 prefixes
  ok       git 2.56.0 (/usr/bin/git)
```

プロジェクトの中で動かすと、そのプロジェクトのターゲットを必須として扱い、足りなければ終了コード 1 で終わります。`--target wasm` で必須のターゲットを選べます。`--format json` は1つの JSON を出すので、バグの報告に貼れます。

## 動かしてみる

1行のプログラムを動かしてみます。

```emela check
fn main() {
  dbg("Hello, Emela!")
  ()
}
```

```console
$ emela run main.emel
"Hello, Emela!"
```

`dbg` は値を標準エラーに出します。文字列は引用符付きで表示されます。プロジェクトの作り方は [最初のプロジェクト](/start/first-project/) で説明します。インストールせずに試すなら、[Emela ツアー](/tour/) と [Playground](/playground/) がブラウザで動きます。

## エディタ

`emela lsp` が言語サーバーです。診断、hover（型と `fails`、`uses`）、補完、定義へのジャンプ、改名、整形などに対応します。VS Code の拡張と、Neovim、Zed、Sublime Text の設定は [エディタと言語サーバー](/tools/editors/) にあります。
