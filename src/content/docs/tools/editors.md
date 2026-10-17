---
title: エディタと言語サーバー
description: emela lsp の機能、VS Code と Neovim と Sublime Text の設定、emela fmt と emela doc、診断の表示形式
---

`emela lsp` は、コンパイラと同じ検査を使う言語サーバーです。エディタの拡張は色付けとファイルの種類の設定だけを持ち、診断や補完はすべて言語サーバーに任せます。

## emela lsp の機能

`emela lsp` は引数を取らず、標準入出力で LSP を話します。

| 機能 | 内容 |
|---|---|
| 診断 | `emela check` と同じエラーと警告 |
| hover | 型と、`fails`、`use` |
| inlay hints | 推論した型の表示 |
| 補完 | 名前の補完 |
| 定義へ移動 | 名前の宣言へ移る |
| 参照 | 名前を使っている場所の一覧 |
| rename | 名前を一括で変える |
| signature help | 呼び出しの引数の型 |
| 整形 | `emela fmt` と同じ整形 |
| コードアクション | 推論した注釈（戻り値の型、`fails`、`use`）を書き込む |
| semantic tokens | 能力の値（`use X` で束縛した変数）に印を付ける |

- 言語サーバーはネットワークに出ません。
- まず注釈なしで書き、公開する関数にはコードアクションで推論した注釈を書き込めます。

```emela check
fn port(text: String) -> Int fails ParseError {
  n = Int.parse(text)
  if n < 0 { fail ParseError(input: text) }
  n
}
```

## VS Code

拡張は emela のリポジトリの `editors/vscode` にあります。マーケットプレイスには出ていないので、手元でビルドして入れます。

```sh
cd editors/vscode
npm install
npm run compile
npx @vscode/vsce package          # emela-<version>.vsix を作る
code --install-extension emela-*.vsix
```

- `emela` が PATH にあれば、`.emel` のファイルを開くと `emela lsp` を起動します。
- 設定の `emela.serverPath` で、`emela` の場所を変えられます（既定は `emela`）。

:::caution[古い設定と色付け]
拡張の設定にある `emela.packageRoots` は 0.1x のものです。値を入れると `emela lsp --package ...` で起動しようとし、今の `emela lsp` は引数を取らないので起動に失敗します。空のままにしてください。

拡張に同梱の色付け（TextMate の文法）も 0.1x のままで、`#` のコメントや今のキーワードを正しく色付けしません。診断や補完などの言語サーバーの機能は 0.20 のものです。
:::

## Neovim と Vim

`editors/nvim` は、Vim 9 と Neovim の両方で動く Vim script のプラグインです。Tree-sitter は使いません。

| ファイル | 働き |
|---|---|
| `ftdetect/emela.vim` | `*.emel` を `emela` のファイルタイプにする |
| `syntax/emela.vim` | 色付け |
| `indent/emela.vim` | `emela fmt` と同じインデント |
| `ftplugin/emela.vim` | `#` のコメント、2文字のインデント、モジュールのパスで `gf`（`Http.Client` で `src/http/client.emel` を開く） |
| `plugin/emela.vim` | Neovim で、言語サーバーが知らせる能力の値に下線を引く |

lazy.nvim なら、手元に置いたリポジトリのディレクトリを指します。

```lua
{
  dir = "~/src/emela/editors/nvim",
  name = "emela.vim",
  ft = "emela",
}
```

プラグインマネージャを使わないときは、`filetype plugin on` と `syntax on` より前に runtimepath に足します。

```lua
vim.opt.runtimepath:prepend(vim.fn.expand("~/src/emela/editors/nvim"))
```

Neovim で言語サーバーを使うときは、`emela lsp` を起動します。

```lua
vim.api.nvim_create_autocmd("FileType", {
  pattern = "emela",
  callback = function(args)
    vim.lsp.start({
      name = "emela",
      cmd = { "emela", "lsp" },
      root_dir = vim.fs.root(args.buf, { "Pome.toml" }),
    })
  end,
})
```

- 能力の値の下線は、名前の解決と型の検査の後でしかわからないので、言語サーバーが要ります。Vim では引かれません。
- 下線のハイライトグループは `@lsp.typemod.variable.capability.emela` です。色に変えたり消したりできます。
- 色付けのグループは `highlight default link` で張ってあるので、カラースキームや設定で上書きできます。

```lua
-- 下線の代わりに色を付ける
vim.api.nvim_set_hl(0, "@lsp.typemod.variable.capability.emela", { fg = "#d7875f", bold = true })
```

## Sublime Text と bat

`editors/emela.sublime-syntax` は Sublime Text の文法で、syntect を使う `bat` も読めます。

```sh
mkdir -p "$(bat --config-dir)/syntaxes"
cp editors/emela.sublime-syntax "$(bat --config-dir)/syntaxes/"
bat cache --build
bat --list-languages | grep Emela   # Emela:emel
```

Sublime Text では、Packages/User のディレクトリ（Preferences → Browse Packages…）に置きます。

:::caution[0.1x の文法]
`emela.sublime-syntax` はまだ 0.1x の言語に合わせたままです。コメントを `--` として扱い、`throw` や `uses` のような古いキーワードを色付けします。0.20 のコードは一部しか正しく色付けされません。
:::

## emela fmt

`emela fmt` は、ソースを1つの形に整形します。設定の項目はありません。

```sh
emela fmt                # プロジェクトの src を整形して書き換える
emela fmt --check        # 書き換えず、整形の要るファイルを出す（CI 向け）
emela fmt - < main.emel  # 標準入力を整形して標準出力に書く（エディタ向け）
```

エディタの「保存時に整形」は、言語サーバーの整形か `emela fmt -` を使います。引数の詳細は [emela コマンド](/tools/cli/) にあります。

## emela doc

`emela doc` は、`pub` の宣言と `##` の文書コメントから API の文書を作ります。

```emela check
## 名前に挨拶する文を返す。
##
## ```emela
## Greeting.hello("emela") # "Hello, emela!"
## ```
pub fn hello(name: String) -> String {
  "Hello, #{name}!"
}
```

```sh
emela doc                          # target/emela/doc に HTML を書く
emela doc --format md              # Markdown で書く
emela doc --std --out-dir std-docs # 同梱の core と std の文書
```

## 診断の表示形式

診断は標準エラーに出し、診断の間は空行で区切ります。

```emela check=error
fn main() {
  user = "alice"
  dbg(usr)
}
```

```text
error[E0211]: cannot find value `usr` in this scope
   ╭─[ main.emel:3:7 ]
   │
 3 │   dbg(usr)
   │       ─┬─
   │        ╰───
───╯
   = help: did you mean `user`?

1 error
```

- 1行目は `error[コード]: 文面` か `warning[コード]: 文面` です。コードのない診断は `error: ...` と出します。
- 位置は `╭─[ パス:行:桁 ]` の枠で示します。位置がファイル全体のときは `─[ パス ]` の1行です。
- パスは、プロジェクト（単独のファイルならファイルのあるディレクトリ）からの相対パスです。
- 注記は `= note: ...`、助言は `= help: ...` です。
- 最後の行は `N errors`、警告もあれば `N errors, M warnings` です（1件なら単数形）。
- 色は、標準エラーが端末で、環境変数 `NO_COLOR` が空か未設定のときだけ付けます。
- 文面は英語で、改善のために変わることがあります。コードは変わりません。コードの一覧は [診断](/reference/diagnostics/) にあります。
