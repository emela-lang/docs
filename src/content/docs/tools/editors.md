---
title: エディタと言語サーバー
description: emela lsp の機能、VS Code の拡張、Neovim、Zed、Sublime Text の設定、emela fmt と emela doc、診断の表示形式
---

`emela lsp` はコンパイラと同じ検査を使う言語サーバーです。エディタの拡張は色付けとファイルの種類の設定だけを持ち、診断や補完はすべて言語サーバーに任せます。

## emela lsp の機能

`emela lsp` は引数を取らず、標準入出力で LSP を話します。

| 機能 | 内容 |
|---|---|
| 診断 | `emela check` と同じエラーと警告 |
| hover | 型と `fails`、`uses`、`##` の文書コメント |
| inlay hints | 推論した型の表示 |
| 補完と signature help | 名前の補完（`.` と `@` で起動）、呼び出しの引数の型 |
| 移動 | 定義、型の定義、実装へ移る。参照の一覧と、同じ名前の強調 |
| シンボル | ファイルのシンボルと、ワークスペースのシンボルの検索 |
| 折りたたみと選択範囲 | ブロックごとの折りたたみ、選択範囲の拡大 |
| リンク | `@external` のファイルの引数（`"./ffi.mjs"`）から、そのファイルへのリンク |
| rename | 名前を一括で変える |
| 整形 | `emela fmt` と同じ整形 |
| コードアクション | 推論した注釈（戻り値の型、`fails`、`uses`）を書き込む。クイックフィックスで、網羅していない match の腕、impl に足りない関数、import、綴りの誤り、`fails` と `uses` の不足、古い書き方（E0144、E0145、E0147）を直す |
| semantic tokens | 能力の値（`use X` で束縛した変数）に印を付ける |

- 言語サーバーはネットワークに出ません。依存はキャッシュにあるものだけを読み、なければ `Pome.toml` に E0236 を出します。
- 実験的な機能は `Pome.toml` の `[experimental]` だけを見ます。コマンドの `--experimental-<名前>` で有効にした機能はエディタの診断に出ません。
- ターゲットを決めないので、ターゲットに依存する検査（E0412 など）は `emela build` や `emela test` でだけ出ます。
- 保存していないバッファ（`untitled:`）には診断を出しません。

まず注釈なしで書き、公開する関数にはあとからコードアクションで推論した注釈を書き込めます。

```emela check
fn port(text: String) -> Int fails ParseError {
  n = Int.parse(text)
  if n < 0 { fail ParseError(input: text) }
  n
}
```

## VS Code

拡張は Visual Studio Marketplace の [Emela](https://marketplace.visualstudio.com/items?itemName=Emela.emela)（`Emela.emela`）です。

```sh
code --install-extension Emela.emela
```

- 色付けと、`emela lsp` の機能のすべてを持ちます。
- `emela` は `PATH`、なければ `~/.emela/bin` から探すので、install.sh で入れたものはデスクトップから起動した VS Code でも見つかります。ほかの場所にあるときは設定の `emela.serverPath` に書きます。見つからなければ、入れ方への案内を通知します。
- Emela のファイルを開いている間、ステータスバーにサーバーの状態を出します。押すとサーバーを再起動します。コマンド **Emela: Restart Language Server** でも再起動できます。
- 以前の版の設定 `emela.packageRoots` はなくなりました。`settings.json` に残っていたら消してください。

手元でビルドするときは、emela リポジトリの `editors/vscode` で `npm install` と `npm run package` を実行し、できた `emela-<version>.vsix` を `code --install-extension` で入れます。

## Neovim と Vim

emela リポジトリの `editors/nvim` は、Vim 9 と Neovim の両方で動く Vim script のプラグインです。

| ファイル | 働き |
|---|---|
| `ftdetect/emela.vim` | `*.emel` を `emela` のファイルタイプにする |
| `syntax/emela.vim` | 正規表現による色付け |
| `indent/emela.vim` | `emela fmt` と同じインデント |
| `ftplugin/emela.vim` | `#` のコメント、2文字のインデント、モジュールのパスで `gf`（`Http.Client` で `src/http/client.emel` を開く）。tree-sitter のパーサーがあればそちらで色付けする |
| `plugin/emela.vim` | Neovim で、言語サーバーが知らせる能力の値に下線を引く |
| `queries/emela/` | tree-sitter のクエリ（`editors/tree-sitter-emela/queries` へのリンク） |

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

### tree-sitter

Neovim では、`editors/tree-sitter-emela` の tree-sitter の文法で色付けできます。パーサーが `emela` の名前で見つかると、`ftplugin/emela.vim` が `vim.treesitter.start()` を呼び、`syntax/emela.vim` は使いません。Vim の色付けのままにしたいときは `vim.g.emela_treesitter = 0` とします。

クエリはプラグインに入っているので、ビルドするのはパーサーだけです。C コンパイラが要ります。nvim-treesitter（main ブランチ）ならパーサーを登録して `:TSInstall emela` を実行します。tree-sitter CLI も要ります。

```lua
vim.api.nvim_create_autocmd("User", {
  pattern = "TSUpdate",
  callback = function()
    require("nvim-treesitter.parsers").emela = {
      install_info = {
        url = "https://github.com/emela-lang/emela",
        location = "editors/tree-sitter-emela",
        queries = "editors/tree-sitter-emela/queries",
      },
    }
  end,
})
```

手でビルドするときは、runtimepath の `parser/` に置きます。

```sh
tree-sitter build -o ~/.local/share/nvim/site/parser/emela.so editors/tree-sitter-emela
```

クエリは折りたたみ、インデント、テキストオブジェクト（nvim-treesitter-textobjects）も持ちます。キャプチャの名前は nvim-treesitter のものに合わせてあるので、nvim-treesitter に対応したカラースキームはそのまま Emela を色付けします。

### 言語サーバー

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

能力の値の下線は名前の解決と型の検査の後でしかわからないので、言語サーバーが要り、Vim では引かれません。下線のハイライトグループは `@lsp.typemod.variable.capability.emela` で、色に変えたり消したりできます。カラースキームを読み込むと消えるので、その後で設定します。

```lua
-- 下線の代わりに色を付ける
vim.api.nvim_set_hl(0, "@lsp.typemod.variable.capability.emela", { fg = "#d7875f", bold = true })
```

`syntax/emela.vim` の色付けのグループは `highlight default link` で張ってあるので、カラースキームや設定で上書きできます。

## Zed

emela リポジトリの `editors/zed` は、tree-sitter の文法を使う Zed の拡張です。色付け、アウトライン、括弧の対応、インデント、vim モードのテキストオブジェクトを持ちます。言語サーバーはまだ起動しません。

Zed の拡張の一覧には出ていないので、開発用の拡張として入れます。コマンドパレットで `zed: install dev extension` を実行し、`editors/zed` のディレクトリを選びます。開発用の拡張を入れるには、rustup で入れた Rust が要ります。

## Sublime Text と bat

`editors/emela.sublime-syntax` は Sublime Text の文法で、tree-sitter の文法に合わせてあります。syntect を使う `bat` も読めます。

```sh
mkdir -p "$(bat --config-dir)/syntaxes"
cp editors/emela.sublime-syntax "$(bat --config-dir)/syntaxes/"
bat cache --build
bat --list-languages | grep Emela   # Emela:emel
```

Sublime Text では Packages/User のディレクトリ（Preferences → Browse Packages…）に置きます。色付けだけで、言語サーバーの設定は入っていません。

## emela fmt

`emela fmt` はソースを1つの形に整形します。設定の項目はありません。

```sh
emela fmt                # プロジェクトの src と test を整形して書き換える
emela fmt --check        # 書き換えず、整形の要るファイルを出す（CI 向け）
emela fmt - < main.emel  # 標準入力を整形して標準出力に書く（エディタ向け）
```

エディタの「保存時に整形」は言語サーバーの整形か `emela fmt -` を使います。引数の詳細は [emela コマンド](/tools/cli/) にあります。

## emela doc

`emela doc` は `pub` の宣言と `##` の文書コメントから API の文書を作ります。

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
- パスはプロジェクト（単独のファイルならファイルのあるディレクトリ）からの相対パスです。
- 注記は `= note: ...`、助言は `= help: ...` です。
- 最後の行は `N errors`、警告もあれば `N errors, M warnings` です（1件なら単数形）。
- 色は、標準エラーが端末で、環境変数 `NO_COLOR` が空か未設定のときだけ付けます。
- 文面は英語で、改善のために変わることがあります。コードは変わりません。コードの一覧は [診断コード](/reference/diagnostics/) にあります。
