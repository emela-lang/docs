---
title: インストール
description: install.sh で emela を入れる、Node.js と C コンパイラの要件、エディタ
---

`emela` は1つの実行ファイルで、コンパイラ、テストランナー、フォーマッタ、言語サーバーを兼ねます。配布しているビルド済みのバイナリは macOS（Apple Silicon）と Linux（x86_64）向けです。

## install.sh で入れる

```sh
curl -fsSL https://raw.githubusercontent.com/emela-lang/emela/main/install.sh | sh
emela --version
```

```console
$ emela --version
emela 0.20.1
```

最新のリリースが `$HOME/.emela/bin/emela` に入ります。そのディレクトリが `PATH` になければ、スクリプトが最後に `add $HOME/.emela/bin to PATH to run emela directly` と知らせます。シェルの設定に足してください。入れ直すときも同じコマンドで、前の `emela` は上書きされます。

環境変数で、置き場所と版を変えられます。

| 変数 | 働き | 例 |
|---|---|---|
| `EMELA_INSTALL_DIR` | 置くディレクトリ（既定は `$HOME/.emela/bin`） | `EMELA_INSTALL_DIR=$HOME/bin` |
| `EMELA_VERSION` | 入れる版。省けば最新のリリース | `EMELA_VERSION=v0.20.0-alpha.5` |

```sh
curl -fsSL https://raw.githubusercontent.com/emela-lang/emela/main/install.sh \
  | EMELA_INSTALL_DIR="$HOME/bin" EMELA_VERSION=v0.20.1 sh
```

`EMELA_VERSION` は `v` を付けても付けなくても同じです。

## 実行に要るもの

| 使うもの | 要るもの |
|---|---|
| `emela check`、`emela fmt`、`emela lsp` | なし |
| `emela run`、`emela test`（JS ターゲット、既定） | Node.js 18 以降 |
| `--target c` | C11 のコンパイラ（`cc`） |

JS ターゲットは、出力した JavaScript を `PATH` の `node` で動かします。環境変数 `EMELA_NODE` があればそちらを使います。Deno と Bun も `node:` のモジュールと `fetch` を持つので対象に入りますが、ブラウザは 0.20 の対象ではありません。

C ターゲットは、出力した C を `cc` でコンパイルして native の実行ファイルを作ります。別のコンパイラを使うときは `EMELA_CC=clang` のように指定します。対象は macOS（arm64）と Linux（x86_64）です。

:::caution[C ターゲットはまだリリースに入っていません]
`--target c` は main ブランチにあり、次のリリースで入ります。0.20.1 までのリリースの `emela` は JS ターゲットだけです。C ターゲットの今の制限は [実装の状況](/start/status/) にまとめています。
:::

## 確かめる

1行のプログラムを動かしてみます。

```emela check
fn main() {
  dbg("Hello, Emela!")
}
```

```console
$ emela run main.emel
"Hello, Emela!"
```

`dbg` は値を標準エラーに出します。文字列は引用符付きで表示されます。プロジェクトの作り方は [最初のプロジェクト](/start/first-project/) で説明します。

## エディタ

`emela lsp` が言語サーバーです。診断、hover（型と `fails`、`use`）、補完、定義へのジャンプ、改名、整形などに対応します。VS Code、Neovim、Vim、Sublime Text 向けの設定は [エディタと言語サーバー](/tools/editors/) にあります。
