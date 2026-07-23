---
title: インストールとプロジェクト
description: Emela プロジェクトの構成と、ビルド・依存関係の扱い方
---

:::note[実験段階です]
Emela のツールチェーンは活発に開発中です。ここでは、確定しているプロジェクトの構成と
コマンドの形を説明します。コンパイラ本体の配布方法は変わりうるため、最新は
[GitHub](https://github.com/emela-lang) を確認してください。
:::

## プロジェクトの構成

Emela のソースファイルは拡張子 `.emel` を持ちます。1ファイルが1つの **モジュール** で、
先頭の `module` ヘッダで名前を与えます（エントリを持つファイルでは省略できます）。

プロジェクトのルートには `Pome.toml` を置きます。**Pome** は Emela の配布・依存単位です。

```text
myapp/
  Pome.toml
  src/
    main.emel
```

`Pome.toml` はプロジェクトの identity と依存を宣言します。

```toml
[pome]
name = "myapp"
version = "0.1.0"
emela = "0.6"

[dependencies]
"github.com/emela-lang/stdlib" = "^0.4.0"
```

## ビルド

エントリを含むファイルを指定してビルドします。

```sh
emela build src/main.emel
```

依存として解決された Pome は自動的に import パス上に載ります。

## 依存関係（Pome）

Pome は Git リポジトリとして配布され、**中央レジストリはありません**。
ソースパス（`github.com/emela-lang/stdlib` のような形）で識別し、
`v` 始まりの semver git タグでバージョン管理します。

```sh
emela pome add github:emela-lang/stdlib
```

このコマンドは依存を取得し、解決したタグ・コミット・内容ハッシュを `Pome.lock` に固定します。
さらに、追加前にその依存が要求する **capability の集合を表示** します
（[capability は source から計算できる](/reference/runtime-boundary/#capability-manifest)ため）。

### 標準ライブラリ

標準ライブラリの import ルートは `std` です。`std` の一部（`core` / `io` / `clock` / `string` / `float`）は
`intrinsic fn` や `extern fn` を宣言するため **コンパイラに埋め込まれて** おり、依存なしで解決します。
`import std.io` はそのまま使えます。純粋な残り（`list` / `option` / `result` / `int` / `ord` など）は
Pome 依存として追加します。

```emela
import std.io      -- コンパイラに埋め込み。そのまま使える
import std.list    -- stdlib Pome。関数は list.<name> で呼ぶ
```

### ローカル開発

依存をローカルのチェックアウトに向けたいとき（オフライン開発・CI）は環境変数で差し替えます。

```sh
export EMELA_POME_REPLACE="github.com/emela-lang/stdlib=/path/to/stdlib"
```

`EMELA_POME_CACHE` で取得キャッシュの場所を変更できます。

## 次のステップ

- [Hello, World](/guides/hello-world/) — 最初のプログラム
- [モジュールとインポート](/reference/modules/) — import と可視性の規則
