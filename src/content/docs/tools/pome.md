---
title: プロジェクトと Pome
description: Pome.toml とプロジェクトの決まり方、依存の書き方、version の選び方、Pome.lock、emela pome のコマンド
---

Pome は、Emela の配布と依存の単位です。`Pome.toml` を置いたディレクトリが1つのプロジェクトで、そのまま1つの Pome になります。中央のレジストリは持たず、依存は Git のリポジトリから直接取ります。

```text
greeter/
├── Pome.toml
└── src/
    ├── main.emel
    └── greeting.emel
```

```toml
# Pome.toml
[pome]
name = "github.com/acme/greeter"
version = "0.1.0"
emela = "0.20.1"

[build]
target = "js"
```

:::caution[今の CLI で読むのは `[build].target` だけ]
0.20 のコンパイラは `Pome.toml` があるかどうかと `[build].target` だけを見ます。`[pome]`、`[dependencies]`、`[replace]` は診断なしに無視され、依存を取ってくることも `Pome.lock` を書くこともしません。TOML として読めない `Pome.toml` も、今は何も言われません。空の `Pome.toml` でもプロジェクトになります。このページの依存の節は、仕様で決まった予定の形です。
:::

## プロジェクトの決まり方

- `Pome.toml` を置いたディレクトリがプロジェクトで、ソースのルートは `<プロジェクト>/src` です。
- `emela` コマンドに渡したパスを、シンボリックリンクを解いた絶対パスに直し、祖先を上にたどって最初に見つかった `Pome.toml` のディレクトリをプロジェクトにします。
- ディレクトリを渡して `Pome.toml` が見つからなければエラーです。ファイルを渡して見つからなければ、単独のファイルとして扱います。
- ファイルを渡して `Pome.toml` が見つかったのに、そのファイルが `src/` の外にあれば E0208 です。
- モジュール名はファイルのパスから決まります（`src/http/client.emel` は `Http.Client`）。詳しくは [モジュール](/guide/modules/) にあります。

### main.emel と lib.emel

| ファイル | 役割 |
|---|---|
| `src/main.emel` | アプリケーションのエントリ。`emela run` はここの `main` を実行する |
| `src/lib.emel` | ライブラリのルート。依存されたときに、ルートのモジュールになる |

- 両方を置いてもかまいません。どちらを持つかでアプリケーションとライブラリが決まり、設定では切り替えません。
- `main.emel` がなければ `emela run` はできません。ライブラリだけのプロジェクトでは、`check` と `test` の入口は `lib.emel` で、`build` は検査だけをします。
- `src/main.emel` は、依存されたときには使いません。

```emela check
## src/lib.emel: ライブラリのルート。依存されたときは `Greeter` として見える。
pub fn hello(name: String) -> String {
  "Hello, #{name}!"
}

@test
fn says_hello() {
  assert hello("emela") == "Hello, emela!"
}
```

:::caution[ライブラリだけのプロジェクト]
今の CLI は、`main.emel` のないプロジェクトの `build` と `run` を E0209（エントリがない）で止め、`test` は内部の誤りで止まります。`check` は通ります。
:::

## Pome.toml

```toml
[pome]
name = "github.com/emela-lang/quince"   # source path
version = "0.3.2"
emela = "0.20.1"                         # 要るコンパイラの最小の版
module = "Quince"                        # 依存されたときのルート名（省略可）

[dependencies]
"github.com/emela-lang/x" = "v0.2.0"                              # この version 以上
"github.com/acme/http"    = { version = "v1.4.0", module = "AcmeHttp" }

[replace]
"github.com/emela-lang/x" = { path = "../x" }    # この Pome をビルドするときだけ効く

[build]
target = "c"                                     # 既定のビルド対象（省略時は js）
```

### [pome]

| 項目 | 必須 | 内容 |
|---|---|---|
| `name` | 必須 | source path（`host/path`）。`https://` と末尾の `.git` を除いた形 |
| `version` | 必須 | この Pome の version |
| `emela` | 必須 | この Pome を作るのに要るコンパイラの最小の版 |
| `module` | 省略可 | 依存されたときのルート名 |

- `emela` より新しいコンパイラを求める依存はエラーです。古い minor 向けの依存は、警告を出して作ってみて、依存の中でエラーが出たら対象の版を注記に出します。
- モジュールごとに言語の版を切り替える仕組み（エディション）はありません。

### [dependencies]

| 書き方 | 意味 |
|---|---|
| `"github.com/emela-lang/x" = "v0.2.0"` | この version 以上を使う |
| `"github.com/acme/http" = { version = "v1.4.0", module = "AcmeHttp" }` | この version 以上を使い、ルート名を `AcmeHttp` に付け替える |

- キーは source path です。`github:owner/repo` の省略形はコマンドの入力でだけ受け付け、`Pome.toml` と `Pome.lock` には常に source path で書きます。
- 範囲の文法はありません。書くのは「この version 以上」だけです。

### [replace]

| 書き方 | 意味 |
|---|---|
| `"github.com/emela-lang/x" = { path = "../x" }` | 手元のディレクトリをその依存として使う |

- その Pome をビルドするときだけ効き、依存されたときは無視します。
- 置き換えた依存のハッシュは lock に書きません。

### [build]

| 項目 | 内容 |
|---|---|
| `target` | `check`、`build`、`run`、`test` の既定のビルド対象。`js` か `c`。省けば `js` |

- コマンドの `--target` が優先します。
- `[replace]` と同じく、その Pome をビルドするときだけ効き、依存されたときは無視します。
- 知らないターゲットは E0232 です。

```console
$ emela build
error[E0232]: unknown target `wasm` in `[build].target`
   ─[ /path/to/greeter/Pome.toml ]
   = note: expected one of `js`, `c`

1 error
```

これは今の CLI でも動きます。ただし `check` は `[build].target` を見ないので、E0232 は `build`、`run`、`test` で出ます。

## 依存のモジュール

- 依存した Pome のモジュールは、その Pome のルート名の下に見えます。`src/lib.emel` がルートのモジュール（`Quince`）、`src/router.emel` が `Quince.Router` です。
- ルート名の既定は、source path の最後の区切りをモジュール名の規則で PascalCase にしたものです。`-` は `_` と同じに扱います（`json-codec` は `JsonCodec`）。
- ルート名は、作者が `[pome].module` で変えられ、依存する側が `[dependencies]` の表の `module` で付け替えられます。
- `Std`、core のモジュール名（`List`、`String` など）、`Prelude` はルート名に使えません。自分のモジュールやほかの依存のルート名とぶつかれば E0204 で、依存する側で付け替えます。
- 依存の依存（推移的な依存）は見えません。import できるのは、自分の `[dependencies]` に書いた Pome だけです。
- Pome の中のモジュールは、すべて依存する側から見えます。
- 依存として使われる Pome は `@external` を持てません。ホストへの道は std の platform 層だけにして、どの Pome もすべてのターゲットで同じ意味で動くようにするためです。

## version の選び方

- version は、リポジトリの git の tag（semver に `v` を付けたもの。`v0.3.2`）で表します。公開は tag を push するだけです。
- 使う version は、依存の木の中でその Pome について書かれた要求のうち、最大のものです（Minimal Version Selection、Go のモジュールと同じ方式）。
- 新しい tag が出ても、誰かが要求を上げない限り、使う version は変わりません。
- 1回のビルドで、1つの Pome は1つの version だけを使います。
- v2 以上の major は、同じ source path でも別の Pome とみなします。v0 と v1 は同じ Pome で、互換は作者の責任です。
- version の選び方は `[pome].emela` を見ません。

## 取得と Pome.lock

- 依存はマシンの `git` で取ります。tag の一覧は `git ls-remote --tags`、取得は tag の浅い clone です。
- 取ったものは `~/.emela/pomes/<source path>@<version>/` に展開し、読み取り専用で置きます。場所は環境変数 `EMELA_POME_CACHE` で変えられます。
- `Pome.lock` には、依存ごとに source path、version、commit、中身のハッシュ（`.git` を除いたファイルをパスの順に並べ、パスと中身から計算した sha256）を書きます。
- `Pome.lock` は `emela pome` のコマンドが書き、手では編集しません。アプリケーション（`main.emel` を持つ Pome）は lock を持ち、ライブラリは持ってもかまいません。依存する側は、依存の lock を使いません。
- `check`、`build`、`run`、`test` は、lock にある依存がキャッシュになければ取ってきて、ハッシュを確かめてから使います。lock は書き換えません。
- `Pome.toml` にあって lock にない依存はエラーで、`emela pome install` を案内します。ハッシュが合わなければ、すり替えの疑いとしてエラーにします。
- 言語サーバーはネットワークに出ず、足りない依存を診断で知らせます。

## emela pome と emela new

:::caution[予定]
次のコマンドは仕様で決まっていますが、今の CLI にはありません（`unrecognized subcommand` になります）。
:::

| コマンド | 働き |
|---|---|
| `emela pome add <src>[@<version>]` | 依存を足す。version を省けば最新の tag |
| `emela pome remove <src>` | 依存を除く |
| `emela pome install` | `Pome.toml` に合わせて lock を作り、依存を取ってくる |
| `emela pome update [<src>]` | 要求をその Pome の最新の tag に上げる。省けば全部 |
| `emela pome list` | 解決した依存の木を出す |
| `emela new <名前>` | 新しい Pome を作る。`--lib` を付けるとライブラリ（`src/lib.emel`）にする |

- どれも `Pome.toml` と `Pome.lock` を整合させて書き換えます。
- `<src>` には source path か `github:` の省略形を書けます。

```sh
emela pome add github:emela-lang/x@v0.2.0
emela pome install
```

## 持たないもの

次のものは持たず、後の版で考えます。

- 中央のレジストリ
- 複数の Pome をまとめる workspace（Bushel）
- 検索の索引（Orchard）
- 依存を手元に写す vendor
- tag のない commit や branch を指す書き方
- `github:` 以外の省略形

std に入れる前の部品を置く Pome `github.com/emela-lang/x` については [標準ライブラリの構成](/std/overview/) を見てください。
