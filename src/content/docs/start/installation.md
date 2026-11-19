---
title: インストール
description: install.sh で emela を入れる、Node.js・Bun・Wasmtime・C コンパイラの要件、エディタ
---

`emela` は1つの実行ファイルで、コンパイラ、テストランナー、フォーマッタ、言語サーバーを兼ねます。配布しているビルド済みのバイナリは macOS（Apple Silicon）、Linux（x86_64）、Windows（x86_64）向けです。

## install.sh で入れる（macOS / Linux）

```sh
curl -fsSL https://emela.dev/install.sh | sh
emela --version
```

```console
$ emela --version
emela 0.28.0
```

最新の安定リリースが `$HOME/.emela/bin/emela` に入ります。そのディレクトリが `PATH` になければ、スクリプトが最後に `add $HOME/.emela/bin to PATH to run emela directly` と知らせます。シェルの設定に足してください。入れ直すときも同じコマンドで、前の `emela` は上書きされます。

環境変数で、置き場所・版・チャネルを変えられます。

| 変数 | 働き | 例 |
|---|---|---|
| `EMELA_INSTALL_DIR` | 置くディレクトリ（既定は `$HOME/.emela/bin`） | `EMELA_INSTALL_DIR=$HOME/bin` |
| `EMELA_VERSION` | 入れる版。省けばチャネルの最新 | `EMELA_VERSION=0.28.0` |
| `EMELA_CHANNEL` | `stable`（既定）か `nightly`（`dev` の最新プレリリース） | `EMELA_CHANNEL=nightly` |

```sh
curl -fsSL https://emela.dev/install.sh \
  | EMELA_INSTALL_DIR="$HOME/bin" EMELA_VERSION=0.28.0 sh
```

`EMELA_VERSION` は `v` を付けても付けなくても同じです。版を指定したときは `EMELA_CHANNEL` より優先します。

## Windows

`install.sh` は Windows には対応していません。[releases](https://github.com/emela-lang/emela/releases) から `emela-v*-x86_64-pc-windows-msvc.zip` をダウンロードし、展開した `emela.exe` を `PATH` に置いてください。コンパイラの Windows 向けバイナリは 0.28 からあります。`--target native` は Windows ではまだ動きません（[実装の状況](/start/status/)）。

## 実行に要るもの

| 使うもの | 要るもの |
|---|---|
| `emela check`、`emela fmt`、`emela lsp`、`emela doctor` | なし |
| `emela run`、`emela test`（JS ターゲット、既定） | Node.js 22 以降、または Bun 1.4.3 以降 |
| `--target wasm` | Wasmtime 49 以降（WASI 0.3、`-S p3=y`） |
| `--target native` | C11 のコンパイラ（`cc`）とシステムの C ヘッダ・ライブラリ |

JS ターゲットは、出力した JavaScript を Node.js か Bun で動かします。既定は `PATH` の `node` です。`EMELA_NODE` があればそちらを使い、`EMELA_JS_HOST=bun` なら Bun を使います。ブラウザは実行ホストの対象ではありません。

WASM ターゲットは、出力を Wasmtime で WASI 0.3 の component として動かします。別のバイナリを使うときは `EMELA_WASMTIME` を指定します。

native ターゲットは、出力した C とランタイムを `cc` でコンパイルして実行ファイルを作ります。別のコンパイラは `EMELA_CC`、追加のフラグは `EMELA_CC_ARGS` で指定します。対象は macOS（arm64）と Linux（x86_64）です。`--target c` は同じものの非推奨名で、0.29 で削除予定です。制限は [実装の状況](/start/status/) にまとめています。

入れたあとに足りるものは `emela doctor` で確かめられます。

## 確かめる

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

`dbg` は値を標準エラーに出します。文字列は引用符付きで表示されます。プロジェクトの作り方は [最初のプロジェクト](/start/first-project/) で説明します。

## エディタ

`emela lsp` が言語サーバーです。診断、hover（型と `fails`、`uses`）、補完、定義へのジャンプ、改名、整形などに対応します。VS Code、Neovim、Vim、Sublime Text 向けの設定は [エディタと言語サーバー](/tools/editors/) にあります。
