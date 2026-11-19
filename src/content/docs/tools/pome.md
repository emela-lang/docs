---
title: プロジェクトと Pome
description: Pome.toml の書き方、依存と dev-dependencies、実験的な機能、license、version の選び方、Pome.lock、キャッシュ、proxy と sumdb、emela pome のコマンド
---

Pome は Emela の配布と依存の単位です。`Pome.toml` を置いたディレクトリが1つのプロジェクトで、そのまま1つの Pome になります。中央のレジストリもアカウントもなく、Pome の名前と版は Git のリポジトリとその tag で決まります。依存は proxy を通して取り、中身はチェックサムのデータベース（sumdb）で確かめます。

規範となる規則は仕様の [`[module.pome]`](https://github.com/emela-lang/emela/blob/main/spec/language/04-modules.md)、[Pome の付録](https://github.com/emela-lang/emela/blob/main/spec/tooling/pome.md)、[`[cmd.pome]`](https://github.com/emela-lang/emela/blob/main/spec/tooling/commands.md) にあります。

```text
greeter/
├── Pome.toml
├── Pome.lock
├── src/
│   ├── main.emel
│   └── greeting.emel
└── test/
    └── greeting_test.emel
```

`emela new greeter` で、`Pome.toml` と `src/main.emel` を持つプロジェクトができます（[最初のプロジェクト](/start/first-project/)）。

## プロジェクトの決まり方

- `Pome.toml` を置いたディレクトリがプロジェクトです。ソースのルートは `<プロジェクト>/src`、テストのルートは `<プロジェクト>/test` です。
- `emela` コマンドに渡したパスを、シンボリックリンクを解いた絶対パスに直し、祖先を上にたどって最初に見つかった `Pome.toml` のディレクトリをプロジェクトにします。
- ディレクトリを渡して `Pome.toml` が見つからなければエラー（E0207）です。ファイルを渡して見つからなければ、単独のファイルとして扱います。
- ファイルを渡して `Pome.toml` が見つかったのに、そのファイルがソースのルートとテストのルートの外にあればエラー（E0208）です。
- モジュール名はファイルのパスから決まります（`src/http/client.emel` は `Http.Client`）。詳しくは [モジュールと名前の解決](/reference/modules/) にあります。

### main.emel と lib.emel

| ファイル | 役割 |
|---|---|
| `src/main.emel` | アプリケーションのエントリ。`emela run` はここの `main` を実行する |
| `src/lib.emel` | ライブラリのルート。依存されたときに、ルートのモジュールになる |

- 両方を置いてもかまいません。どちらを持つかでアプリケーションとライブラリが決まり、設定では切り替えません。
- `main.emel` がなく `lib.emel` があるプロジェクトはライブラリだけのプロジェクトです。`check` と `test` の入口は `lib.emel` で、`build` は検査だけをして何も書き出しません。`run` はエラー（E0230）です。
- `src/main.emel` は、依存されたときには使いません。
- `test/` の下のモジュールはテストだけが使います。`build` と `run` は読みません（[テスト](/guide/testing/)）。

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

## Pome.toml

```toml
[pome]
name = "github.com/emela-lang/quince"   # source path
version = "0.3.2"
emela = "0.28.0"                         # 要るコンパイラの最小の版
module = "Quince"                        # 依存されたときのルート名（省略可）
license = "MIT OR Apache-2.0"            # SPDX のライセンス式（省略可）

[dependencies]
"github.com/emela-lang/x" = "v0.2.0"                              # この version 以上
"github.com/acme/http"    = { version = "v1.4.0", module = "AcmeHttp" }

[dev-dependencies]
"github.com/emela-lang/brix" = "v0.4.0"                           # テストだけが使う

[replace]
"github.com/emela-lang/x" = { path = "../x" }    # この Pome をビルドするときだけ効く

[external]
allow = ["github.com/acme/http"]                 # @external を使ってよい依存

[build]
target = "native"                                # 既定のビルド対象（省けば js）

[experimental]
capture-checking = true                          # 実験的な機能
```

### [pome]

| 項目 | 必須 | 内容 |
|---|---|---|
| `name` | 必須 | source path（`host/path`）。`https://` と末尾の `.git` を除いた形 |
| `version` | 必須 | この Pome の version。`v` を付けない semver |
| `emela` | 必須 | この Pome をビルドするのに要るコンパイラの最小の版 |
| `module` | 省略可 | 依存されたときのルート名 |
| `license` | 省略可 | 中身を配布するライセンスを、SPDX のライセンス式で書く |
| `targets` | 省略可 | この Pome が動くターゲット（`js`、`wasm`、`native`）。省けば全部 |

- major が2以上の Pome は、source path の最後に `/vN` を付けます（`github.com/acme/http/v2`）。`version` の major は `/vN` と合わなければなりません。
- `emela` より新しいコンパイラを求める依存はエラー（E0234）です。古い minor 向けの依存は警告（W0203）を出してビルドします。
- 依存グラフの Pome の `targets` にビルドするターゲットがなければエラー（E0238）です。`@external` を持たない Pome は書かなくてかまいません。
- モジュールごとに言語の版を切り替える仕組み（エディション）はありません。

#### license

`license` は SPDX のライセンス式です。ライセンスの識別子、`+`、`LicenseRef-` の参照を、大文字の `AND`、`OR`、`WITH` と括弧でつなぎます。識別子が SPDX のライセンスの一覧にあるかは確かめません。

- 作者の宣言で、どのツールも Pome のファイルと突き合わせません。省いたときは、ライセンスを宣言していないという意味で、特定のライセンスを意味しません。
- 文字列でないか、式の文法に合わなければ、ビルドする Pome でだけ警告（W0205）を出します。ビルドは止めません。

```console no-check
$ emela check
warning[W0205]: `MIT/Apache-2.0` is not an SPDX license expression
   ╭─[ Pome.toml:5:11 ]
   │
 5 │ license = "MIT/Apache-2.0"
   │           ────────┬───────
   │                   ╰─────────
───╯
   = help: write an SPDX license expression, combining license identifiers with `AND`, `OR` and `WITH`, as in `MIT OR Apache-2.0`

1 warning
```

### [dependencies]

| 書き方 | 意味 |
|---|---|
| `"github.com/emela-lang/x" = "v0.2.0"` | この version 以上を使う |
| `"github.com/acme/http" = { version = "v1.4.0", module = "AcmeHttp" }` | この version 以上を使い、ルート名を `AcmeHttp` に付け替える |

- キーは source path です。`github:owner/repo` の省略形はコマンドの入力でだけ受け付け、`Pome.toml` と `Pome.lock` には常に source path で書きます。
- 範囲の文法はありません。書くのは「この version 以上」だけです。
- ふつうは手で書かず、`emela pome add` で足します。

### [dev-dependencies]

テストだけが使う依存です。書き方は `[dependencies]` と同じです。

- import できるのはテストのルート `test/` のモジュールだけです。`src/` のモジュールから import するとエラー（E0239）です。
- 読むのは `check`、`test`、言語サーバーだけです。`build` と `run` は読まず、取ってもきません。
- 同じ Pome を `[dependencies]` と `[dev-dependencies]` の両方に書くとエラー（E0240）です。テストは `[dependencies]` の Pome もそのまま使えます。
- version の選び方は、`[dependencies]` と `[dev-dependencies]` を合わせたグラフで1回だけ動かします。テストの依存が共通の依存の要求を上げると、ふつうのビルドもその version を使います。テストした version と配る version を同じにするためです。
- その Pome をビルドするときだけ効き、依存されたときは無視します。

### [replace]

| 書き方 | 意味 |
|---|---|
| `"github.com/emela-lang/x" = { path = "../x" }` | 手元のディレクトリをその依存として使う |

- パスはプロジェクトからの相対パスです。置き換えたディレクトリの `Pome.toml` の `[pome].name` が、置き換える source path と違えばエラーです。
- その Pome をビルドするときだけ効き、依存されたときは無視します。
- 置き換えた依存のハッシュは lock に書きません。

### [external]

依存の Pome の `@external`（と `@export`）は、ビルドする Pome の `[external]` の `allow` に source path を書いたときだけ使えます。推移的な依存も、`allow` に書かなければ使えません。許していない Pome の `@external` はエラー（E0233）です。

- ホストに触る依存が、いつもアプリケーションの `Pome.toml` に一覧として現れるようにするためです。
- その Pome をビルドするときだけ効き、依存されたときは無視します。
- `allow` に書いたのに依存グラフにない Pome は警告（W0204）です。
- 依存の Pome の `@external` の fn は pub にできません（E0237）。ホストへの道は、その Pome のハンドラを通します。
- `emela pome add --allow-external` は、足す Pome と、それが新しく持ち込む Pome のうち `@external` を使うものを `allow` に足します。

### [build]

| 項目 | 内容 |
|---|---|
| `target` | `build`、`run`、`test` の既定のビルド対象。`js`、`wasm`、`native`。省けば `js` |

- コマンドの `--target` が優先します。`check` はターゲットを取りません。
- `c` は `native` の古い名前で、警告（W0903）を出します。0.29 で取り除きます。
- `[replace]` と同じく、その Pome をビルドするときだけ効き、依存されたときは無視します。
- 知らないターゲットはエラー（E0232）です。

```console no-check
$ emela build
error[E0232]: unknown target `node` in `[build].target`
   ─[ /path/to/greeter/Pome.toml ]
   = note: expected one of `js`, `native`, `wasm`

1 error
```

### [experimental]

実験的な機能を、この Pome のモジュールで有効にします。キーは機能の名前、値は真偽値です。今ある実験的な機能は [実装の状況](/start/status/#実験的な機能) にあります。

- 実験的な機能は互換性の保証の外にあり、どの版でも変わったり取り除かれたりします。
- `[replace]` や `[external]` と違い、依存されたときも読みます。依存グラフの各 Pome は、それぞれ自分の `[experimental]` で検査します。
- 知らない名前、安定した機能、取り除いた機能の名前は警告（W0206）です。値が真偽値でなければ警告（W0207）で、そのキーは効きません。
- コマンドの `--experimental-<名前>` は、その1回の実行だけ、ビルドする Pome で機能を有効にします。依存には効かず、`Pome.toml` で有効にした機能を無効にもできません。言語サーバーは `Pome.toml` だけを見ます。

```console no-check
$ emela check
warning[W0206]: unknown experimental feature `fast-mode`
    ╭─[ Pome.toml:15:1 ]
    │
 15 │ fast-mode = true
    │ ────┬────
    │     ╰──────
────╯

1 warning
```

## 依存のモジュール

- 依存した Pome のモジュールは、その Pome のルート名の下に見えます。`src/lib.emel` がルートのモジュール（`Quince`）、`src/router.emel` が `Quince.Router` です。
- ルート名の既定は、source path の最後の区切りをモジュール名の規則で PascalCase にしたものです。`-` は `_` と同じに扱います（`json-codec` は `JsonCodec`）。末尾の `/vN` は区切りに数えません（`github.com/acme/http/v2` は `Http`）。
- ルート名は、作者が `[pome].module` で変えられ、依存する側が `[dependencies]` の表の `module` で付け替えられます。同じ Pome の2つの major に依存するときは、片方を付け替えます。
- `Std`、core のモジュール名（`List`、`String` など）、`Prelude` はルート名に使えません（E0203）。自分のモジュールやほかの依存のルート名とぶつかればエラー（E0204）で、依存する側で付け替えます。
- 依存の依存（推移的な依存）は見えません。import できるのは、自分の `[dependencies]` に書いた Pome と、テストからは `[dev-dependencies]` の Pome だけです。
- ソースのルートのモジュールはすべて依存する側から見えます。テストのルートのモジュールは見えません。依存の `@test` は集めません。

## version の選び方

- version はリポジトリの git の tag（semver に `v` を付けたもの。`v0.3.2`）で表します。tag から `v` を除いたものは、その tag の `Pome.toml` の `[pome].version` と合わなければなりません。公開は tag を push するだけです。
- 1つのリポジトリに複数の Pome を置けます。github.com では、リポジトリより後ろの区切りがリポジトリの中のディレクトリです。ディレクトリの Pome の tag にはディレクトリを前に付けます（`platform-cloudflare/v0.1.0`）。
- 使う version は、依存グラフの中でその Pome について書かれた要求のうち、最大のものです（Minimal Version Selection）。
- 新しい tag が出ても、誰かが要求を上げない限り、使う version は変わりません。
- 1回のビルドで、1つの Pome は1つの version だけを使います。
- v2 以上の major は `/vN` の付いた別の Pome です。v0 と v1 は同じ Pome で、互換は作者の責任です。
- version の選び方は `[pome].emela` を見ません。

## 取得、キャッシュ、Pome.lock

### proxy と sumdb

依存は proxy から取り、sumdb の記録と突き合わせて確かめます。

- proxy は Git から取れるものだけを読み取り専用で配る HTTP のサーバーです。ある version を初めて求められたときに Git から取り込み、ハッシュを sumdb に記録してから配ります。一度取り込んだ version は、作者が tag を動かしたり消したりしても変わりません。
- sumdb は追記だけの透明性ログ（Merkle 木）で、version ごとに中身のハッシュと `Pome.toml` のハッシュを記録します。コマンドは記録を引くたびに、署名した checkpoint の木にその記録が含まれていること、前に見た木が新しい木の先頭部分であることを確かめます。見た checkpoint は `~/.emela/pomes/sumdb/` に置きます。
- 中身のハッシュ `h1:` は、ファイルごとに「中身の sha256、空白2つ、パス」の行を作ってパスの順に並べ、その sha256 を base64 にしたものです。

| 環境変数 | 働き | 既定 |
|---|---|---|
| `EMELA_POMEPROXY` | 取る経路。proxy の URL と `direct` をカンマで並べ、順に試す。`off` ならどこからも取らない | `https://pomes.emela.dev,direct` |
| `EMELA_POMESUMDB` | 確かめる sumdb。`off` なら確かめない | `https://sum.emela.dev` |
| `EMELA_POMEPRIVATE` | source path の前置きをカンマで並べる。合う Pome は proxy も sumdb も使わず `direct` で取る | なし |
| `EMELA_POME_CACHE` | キャッシュの場所 | `~/.emela/pomes` |

- 次の経路に移るのは、proxy が「その version はない」（404、410）と答えたときだけです。ほかの失敗では止まります。
- `direct` はマシンの `git` で取ります（tag の一覧は `git ls-remote --tags`、取得は tag の浅い clone）。利用者の git の設定（認証、`url.<base>.insteadOf`）をそのまま使うので、`EMELA_POMEPRIVATE` と組み合わせて非公開のリポジトリを取れます。
- `EMELA_POMEPRIVATE` は、公開していないリポジトリの source path を proxy と sumdb に送らないためのものです。
- `emela doctor` は、これらの値と git が動くかを出します。

### キャッシュ

取った version は `~/.emela/pomes/<source path>@<version>/` に展開し、読み取り専用（ファイルは 0444、ディレクトリは 0555）で置きます。source path の大文字は `!` と小文字に置き換えます（`github.com/Acme/x` は `github.com/!acme/x`）。書くときは一時的な場所に書いてから名前を変えるので、書きかけの中身は見えません。

### Pome.lock

```toml
# Written by `emela pome`. Do not edit.
version = 1

[[pome]]
path = "github.com/emela-lang/brix"
version = "v0.4.0"
commit = "a685c98b611fcc4418d698a4b71260547e10f0ff"
hash = "h1:h6uiy2Ff1MYLg8ROnxf7nHm5HruRhv8/4jRzQmiaoJo="
manifest = "h1:bd40T0AkFC4/t2L4czRcxiNUdIJFlIGkoylNqNLpnw0="
dev = true
```

- 依存グラフ全体を、source path の順に並べます。各表は source path、version、commit、中身のハッシュ（`hash`）、`Pome.toml` のハッシュ（`manifest`）を持ちます。`@external` を含むファイルがあれば `external` にその一覧を、テストの依存グラフからしかたどれない Pome には `dev = true` を書きます。
- `emela pome` のコマンドが書き、手では編集しません。アプリケーション（`main.emel` を持つ Pome）は lock を持ち、ライブラリは持ってもかまいません。依存する側は依存の lock を使いません。
- `check`、`build`、`run`、`test` は、lock にある依存がキャッシュになければ取ってきて、lock のハッシュで確かめてから使います。lock は書き換えず、sumdb にも問い合わせません。`dev = true` の Pome は `build` と `run` では取りません。
- lock がないか、`Pome.toml` にあって lock にない依存があれば、`emela pome install` を案内する `error:` の1行を出して終了コード 1 で終わります。ハッシュが合わなければ、すり替えの疑いとしてエラーにします。
- sumdb と突き合わせるのは、まだ lock にない version を lock に書くとき（`emela pome` のコマンド）だけです。
- 言語サーバーはネットワークに出ず、使えない依存があれば `Pome.toml` に E0236 を出します。

## emela pome

| コマンド | 働き |
|---|---|
| `emela pome add [--allow-external] [--dev] <src>[@<version>]` | 依存を足す。version を省けば最新。`--dev` は `[dev-dependencies]` に足す |
| `emela pome remove <src>` | 依存を除く（`[dependencies]` からでも `[dev-dependencies]` からでも） |
| `emela pome install` | `Pome.toml` に合わせて lock を作り、依存を取ってくる |
| `emela pome update [<src>]` | 要求をその Pome の最新の version に上げる。省けば全部 |
| `emela pome list` | 解決した依存の木を出す。テストからしかたどれない Pome に `(dev)` を付ける |
| `emela pome verify` | キャッシュにある依存を lock のハッシュと突き合わせる |

```console no-check
$ emela pome add --dev github:emela-lang/brix
Pome.toml:
+ github.com/emela-lang/brix v0.4.0 (dev)
Pome.lock:
+ github.com/emela-lang/brix v0.4.0 (dev)
$ emela pome list
github.com/alice/kv
└── github.com/emela-lang/brix v0.4.0 (dev)
$ emela pome verify
the cached dependencies match Pome.lock
```

- `<src>` には source path か `github:` の省略形を書けます。
- どのコマンドも、カレントディレクトリから祖先をたどって `Pome.toml` を探します。パスを渡す引数はありません。
- どのコマンドも、依存を全部解決してから `Pome.toml` と `Pome.lock` を一緒に書きます。途中で失敗すれば、どちらも変わりません。`Pome.toml` のコメント、順序、表の形は保ちます。
- `add`、`install`、`update`、`remove` は、取った version の `.emel` に `@external` があるかを調べます。`[external]` で許していない Pome が使っていれば、そのファイルを並べ、何も書かずに終了コード 1 で終わります。
- `update` は要求を上げるだけで、下げません。`add <src>@<version>` は今の要求より低い version も書きます。
- `[dev-dependencies]` が空になれば表ごと消します。`[dependencies]` は空でも残します。
- 誤りは `error: ` で始まる1行を標準エラーに出し、終了コード 1 で終わります。

:::caution[0.28.0 にないもの]
仕様には、公開前に公開 API の変化と version の上げ幅を確かめ、proxy に取り込ませる `emela pome publish` がありますが、0.28.0 にはまだありません（`unrecognized subcommand 'publish'`）。公開は tag を push するだけでできます。
:::

## 持たないもの

次のものは持たず、後の版で考えます。

- 中央のレジストリ
- 複数の Pome をまとめる workspace（Bushel）
- 検索の索引（Orchard）
- 依存を手元に写す vendor
- tag のない commit や branch を指す書き方
- `github:` 以外の省略形
- 公開した version を取り下げる印（retract）

std に入れる前の部品を置く Pome `github.com/emela-lang/x` については [標準ライブラリの構成](/std/overview/) を見てください。
