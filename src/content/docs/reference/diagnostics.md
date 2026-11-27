---
title: 診断コード
description: コンパイラとツールの診断のコード、表示の形式、帯、全コードの一覧
---

:::note[規範は仕様]
このページは仕様の [付録 A 診断コード](https://github.com/emela-lang/emela/blob/main/spec/diagnostics.md) を日本語でまとめたものです。規範となるのは英語の [仕様](https://github.com/emela-lang/emela/tree/main/spec) で、食い違うときは仕様に従います。一覧は emela 0.29.0 の時点のものです。
:::

コンパイラとツールの診断にはコードが振られています。エラーで止まったときは、ここでコードを引くと、何が起きたかと関係するページが分かります。

## 形

- エラーは `E` + 4桁、警告は `W` + 4桁です。一度振った番号は診断を廃止しても使い回しません。
- 番号の1桁目が段、2桁目が段の中の主題を表します。警告も同じ帯を使います（`W3xxx` は型の警告）。
- 1つのコードは1種類の誤りを表します。直し方が同じ誤りは、書いた位置や形が違っても同じコードにし、形の違いは文面で区別します。
- 文面は英語です。文面は仕様の一部ではなく、改善のために変わることがあります。コードは変わりません。
- 実験的な機能が出す診断には ``= note: experimental feature `name` `` が付きます。

## 表示の形式

```emela check=error
fn main() {
  user = 1
  x = usr
  y: Int = "a"
}
```

```console
$ emela check main.emel
error[E2101]: cannot find value `usr` in this scope
   ╭─[ main.emel:3:7 ]
   │
 3 │   x = usr
   │       ─┬─
   │        ╰───
───╯
   = help: did you mean `user`?

error[E3001]: type mismatch: expected `Int`, found `String`
   ╭─[ main.emel:4:12 ]
   │
 4 │   y: Int = "a"
   │            ─┬─
   │             ╰───
───╯

2 errors
```

- 診断は標準エラーに出し、間を空行で区切ります。
- 位置は `╭─[ パス:行:桁 ]` の枠で示します。位置がファイル全体のときは `─[ パス ]` の1行にします。
- 注記は `= note: ...`、助言は `= help: ...` と出します。
- コードのない診断は `error: ...` と出します。
- 最後の行は `N errors`、警告もあれば `N errors, M warnings` です（1件なら単数形）。
- 色は標準エラーが端末で、環境変数 `NO_COLOR` が空か未設定のときだけ付けます。
- 診断にエラーがあれば、コマンドは終了コード 1 で終わります。警告だけなら 0 です。
- 実装がまだ扱えない形には、コードのない `error: not supported yet: ...` を出します。扱えるようになるまでの暫定です。

## 帯

| 帯 | 段 | 主題 |
|---|---|---|
| E1xxx | 字句と構文 | E10xx 字句、E11xx 式・パターン・型の構文、E12xx 宣言の構文、E13xx 注釈の構文、E14xx もう書かない形 |
| E2xxx | モジュール、名前、プロジェクト | E20xx ファイルとモジュール、E21xx 名前の解決、E22xx 同梱の core やテストに限った定義、E23xx `Pome.toml` と依存 |
| E3xxx | 型 | E30xx 型全般、E31xx 呼び出しとパターン、E32xx エラーの型（E）、E33xx Trait、impl、derive |
| E4xxx | エフェクト | E40xx エフェクトとハンドラの宣言、E41xx with、layer、handler member、E42xx エフェクトのラベル、E43xx R、Immediate、中断、E44xx 能力 |
| E5xxx | 外部関数とターゲット | E50xx `@external`、E51xx `@export` と `@entry`、E52xx ビルドするターゲットの制限 |
| E6xxx〜E8xxx | 予約 | |
| E9xxx | ツール | E90xx 入出力、E91xx 外部のツール（JS のホスト、cc、wasmtime） |

- 下2桁は主題の中の通し番号で、01 から振ります。
- 0.29.0 より前は、段ごとに 100 ずつの帯（E01xx 字句と構文、E02xx モジュール、E03xx 型、E04xx エフェクト、E09xx ツール）でした。0.29.0 で一度だけ今の帯に振り直しました。新しい帯のコードは1桁目が 0 でないので、前の帯のコードと取り違えません。

## 一覧

文面の例はその診断の代表的な文面です。かっこの中のリンクは規則を説明しているページです。旧コードは 0.28 までのコードで、いくつかの種類をまとめたコードには、まとめた分をすべて挙げています。退役したコードは載せていません。

### E1xxx と W1xxx 字句と構文

| コード | 旧コード | 内容 | 文面の例 |
|---|---|---|---|
| E1001 | E0101 | 文字列が閉じていない | `unterminated string literal` |
| E1002 | E0102 | 補間 `#{` が閉じていない | `unterminated interpolation` |
| E1003 | E0103 | どの名前のクラスにも合わない（[字句と予約語](/reference/lexical/)） | ``invalid name `Http_client`: not a lower, type, or upper name`` |
| E1004 | E0104 | 数値の形になっていない | ``invalid number literal `1e9` `` |
| E1005 | E0105 | 認識できない文字 | ``unrecognized character `é` `` |
| E1006 | E0106 | `\` の後ろに文字がない（行末の `\`。複数行の文字列の中を含む） | ``missing character after `\` `` |
| E1007 | E0107 | 使えないエスケープ | ``unknown escape sequence `\q` `` |
| E1008 | E0108 | `\u{...}` の誤り（形の崩れ、サロゲート、10FFFF 超え） | ``` `\u{D800}` is a surrogate, not a Unicode scalar value ``` |
| E1009 | E0109 | 複数行の文字列の形の誤り（開く `"""` の後が改行でない、閉じる `"""` が行に1つでない、閉じる行より浅いインデント） | ``expected a newline after the opening `"""` `` |
| E1101 | E0110 | 来るはずのトークンがない。文面には期待したトークンの表示名が入る（記号と予約語はバッククォートで囲み、名前とリテラルは `lower name` のような種類名、入力の終わりは `end of file`） | ``expected `)` `` |
| E1102 | E0111, E0113, E0118, E0126 | 型、パターン、式、宣言が来るはずの位置にない。文面でどれかを示す | `expected type` / `expected pattern` / `expected expression` / `expected declaration` |
| E1103 | E0112 | 要素が1つのタプル（型・パターン・式の `(a,)`、型とパターンの `(a)`） | `a tuple type needs at least two elements` |
| E1104 | E0114, E0115 | リストの `..` の位置の誤り（`..` の後ろに要素がある、または `..` の前に要素がない `[..rest]`） | ``` `..` must come last ``` / ``` `..` needs at least one element before it ``` |
| E1105 | E0117 | パターンの文字列に補間がある | `string interpolation is not allowed in a pattern` |
| E1106 | E0119 | 比較演算子の連鎖（`a < b < c`） | `comparison operators cannot be chained` |
| E1107 | E0120 | 名前付き引数の後ろの位置引数 | `positional arguments cannot follow named arguments` |
| E1108 | E0121 | 括弧のない `use X.op()` | ``wrap `use` in parentheses to call its operations: `(use X).op()` `` |
| E1109 | E0122 | 文・腕・宣言の後ろに改行か `}` がない | ``expected newline or `}` after statement`` |
| E1110 | E0123, E0124 | パターンの外の `_`、または式のない `..` | ``` `_` can only be used in patterns ``` / ``` `..` without an expression can only be used in patterns ``` |
| E1111 | E0125 | 束縛の左辺がパターンとして読めない（`a + b = 1`） | `invalid left-hand side of binding: expected a pattern` |
| E1112 | E0149 | 無名関数を、ブロックの最後でない文として書いた。行頭の `\|\|` が前の行の続きにならないことを助言に出す | ``this anonymous function is never used`` with ``= help: a line that starts with `\|\|` starts an anonymous function; to continue the previous line with `\|\|`, enclose the expression in parentheses`` |
| E1113 | E0152 | 式の途中の `<-`、または文 `x <- R` の右辺がエフェクトの名前でない（[字句](/reference/lexical/)）。負の数と比べたいときは `a < -b` と書く | `` `<-` can only bind an effect at the start of a statement (`x <- E`); to compare with a negative value, write `a < -b` `` / ``the right side of `<-` must be an effect`` |
| E1201 | E0127 | 宣言の後ろの import（[モジュール](/guide/modules/)） | `imports must come before declarations` |
| E1202 | E0128 | 1つのバリアントで名前付きと名前なしのフィールドを混ぜた（[データ型](/guide/data/)） | `a variant cannot mix named and positional fields` |
| E1203 | E0129 | trait の本体の導出規則（導出規則の構文が決まるまでの暫定） | `derive rules in traits are not supported yet` |
| E1204 | E0130 | `@external` がない。本体のない fn、トップレベルの suspend fn、フィールドのない type（[外部関数](/guide/external/)） | ``a function without a body must be `@external` `` |
| E1205 | E0131 | `opaque` を type / enum 以外に付けた、または `pub` なしで付けた | ``` `opaque` can only be used on `type` and `enum` ``` |
| E1206 | E0132 | バリアントのない enum | `an enum needs at least one variant` |
| E1207 | E0133 | impl に `pub` や注釈を付けた | ``` `impl` cannot have `pub` or annotations ``` |
| E1208 | E0134 | handler の操作の引数に型を書いた | `handler operation parameters take their types from the effect` |
| E1209 | E0135 | impl と handler の fn に本体がない | `this function needs a body` |
| E1210 | E0136 | impl の fn に戻り値の型、fails、uses を書いた | `impl methods take their signature from the trait` |
| E1211 | E0137 | エフェクトの操作に `uses` 節を書いた（[エフェクト](/guide/effects/)） | ``effect operations cannot have a `uses` clause`` |
| E1212 | E0150 | 局所関数に型引数、注釈、`pub`、`suspend` を付けた（[束縛と関数](/guide/functions/)） | ``a local function cannot have attributes``, ``a local function cannot be `pub` ``, ``a local function cannot be `suspend` ``, each with ``= help: remove it`` |
| E1213 | E0150, E0426, E0460 | 型引数を書けない位置に書いた（局所関数、利用者のエフェクトの操作、内側のハンドラ）（[束縛と関数](/guide/functions/)） | ``a local function cannot have type parameters`` with ``= help: remove it`` / ``operation `wrap` cannot have type parameters: only built-in effects may declare them`` / ``inner handler `Open` cannot have type parameters`` |
| E1214 | E0151 | 局所関数をブロックの最後の文として書いた（[束縛と関数](/guide/functions/)） | ``local function `go` is never called`` with ``= help: call it after the declaration`` |
| E1301 | E0138, E0141, E0146 | 注釈の引数の形の誤り。`@external` ではターゲットの名前がない、文字列でない引数、文字列が1つか2つでない、文字列の補間。`@external type` に引数を付けた。`@export` の引数の形の誤りと、トップレベルの本体のある fn 以外に付けたときも含む（[外部関数](/guide/external/)） | ``expected `@external(target, "name")` `` / ``` `@external` on a type takes no arguments ``` / ``expected `@export(target, "name")` `` |
| E1302 | E0139 | 1つの fn に同じ言語の `@external` が2つ以上ある（[外部関数](/guide/external/)） | ``duplicate `@external` for target `js` `` |
| E1303 | E0140 | `@external` か `@export` の言語の名前を知らない（今は js、wasm、c）（[外部関数](/guide/external/)） | ``unknown language `node` `` |
| E1401 | E0142 | match を前置で書いた（[パターンマッチ](/guide/pattern-matching/)） | ``` `match` comes after the value: write `value match { ... }` ``` |
| E1402 | E0144 | impl を `impl Trait for Type` か `impl[...] Type: Trait` の形で書いた（[Trait](/guide/traits/)） | ``write `impl User: Show` instead of `impl Show for User` `` |
| E1403 | E0145 | handler を `implements` で書いた（[エフェクト](/guide/effects/)） | ``write `handler ConsoleLogger: Logger` instead of `implements` `` |
| E1404 | E0147 | uses 節を書く位置（シグネチャ、関数型、エフェクトの操作）に `use` を書いた | ``write `uses { Http }` instead of `use Http` `` |
| E1405 | E0148 | `fn(...)` を式として書いた。無名関数は `\|x\| body` と書く（[束縛と関数](/guide/functions/)） | ``anonymous functions are written `\|x\| body` `` with ``= help: write `\|x\| ...` `` showing the rewrite. The language server offers the rewrite as a quick fix |

### E2xxx と W2xxx モジュール、名前、プロジェクト

| コード | 旧コード | 内容 | 文面の例 |
|---|---|---|---|
| E2001 | E0201, E0202 | ファイル名かディレクトリ名がモジュール名にならない（[モジュールと名前の解決](/reference/modules/)） | ``file name `Foo` cannot be a module name: not lower snake_case`` / ``directory name `My-Dir` cannot be a module name: not lower snake_case`` |
| E2002 | E0203 | 予約されたモジュール名（ソースのルート直下の `prelude.emel`、core のモジュール名、`std`、テストのルート直下の `main.emel` と `lib.emel`）。依存のルート名が予約された名前のときも含む | ``module name `Prelude` is reserved`` |
| E2003 | E0204 | モジュールの重複（大文字小文字の違いだけのもの、ソースのルートとテストのルートにまたがるものを含む）。依存のルート名がほかのモジュールやルート名とぶつかるときも含む（[プロジェクトと Pome](/tools/pome/)） | ``duplicate module `Http.Client` `` |
| E2004 | E0205 | import 先のモジュールがない | ``undefined module `Http.Clinet` `` |
| E2005 | E0206 | import の循環（自己 import を含む） | ``import cycle: `A` -> `B` -> `A` `` |
| E2006 | E0208 | 渡したファイルかディレクトリがソースのルートの外にある。テストのルートのファイルを `build` や `run` に渡したときも含む（[emela コマンド](/tools/cli/)） | ``file `scripts/x.emel` is outside the source root `src` `` / ``directory `scripts` is outside the source root `src` `` / ``` `test/a.emel` is under the test root, which only check and test read ``` |
| E2007 | E0209 | エントリが見つからない（build と run だけ） | ``entry `src/main.emel` not found`` |
| E2008 | E0210 | エントリがモジュールにならない | ``entry `src/Main.emel` is not a module`` |
| E2009 | E0230 | `emela run` のエントリに main がなく、HTTP サービスでもない。ライブラリだけのプロジェクトを `run` したときも含む（[実行時の意味](/reference/semantics/)） | ``entry `src/main.emel` has no `main` function`` |
| E2010 | E0239 | ソースのルートのモジュールが、テストのルートのモジュールか `[dev-dependencies]` の Pome を import した（[テスト](/guide/testing/)） | `` `Brix.Pbt.Property` can only be imported under `test/` `` |
| E2101 | E0211 | 未定義の名前 | ``undefined name `usr` `` |
| E2102 | E0212 | モジュール、Trait、エフェクトに、その名前の項目がない | ``module `Http.Client` has no item `gett` `` |
| E2103 | E0213 | 同じ名前空間での定義の重複。後の定義を指し、前の定義の位置を添える | ``duplicate definition of `User` `` |
| E2104 | E0214 | pub でない定義を、ほかのモジュールから参照した | `` `parse_raw` is private to `Email` `` |
| E2105 | E0215, E0216, E0315 | opaque な型を、定義したモジュールの外で構築した、パターンに書いた、またはフィールドを参照した（[モジュール](/guide/modules/)） | ``cannot construct opaque type `Email` outside its module`` / ``cannot match on opaque type `Email` outside its module`` / ``cannot access field `value` of opaque type `Email` outside its module`` |
| E2106 | E0217 | 名前は見つかったが、その位置に書けない種類だった | ``expected an error, found type `User` `` |
| E2107 | E0218 | `.` の左の名前が、モジュールと Trait の両方を指す | ``ambiguous name `Show`: both a module and a trait`` |
| E2108 | E0219 | `self` か `Self` を、使えない場所に書いた | `` `self` is only available in handlers, traits, and impls `` |
| E2109 | E0220 | 1つのパターンか引数の並びで、同じ名前を2回束縛した | `` `x` is bound more than once `` |
| E2110 | E0221 | 型の位置にエフェクトの名前を書いた。集合でない型引数の位置（`List[Db]`）も含む（[型と効果の体系](/reference/type-system/)） | ``effect `Logger` cannot be used as a type`` |
| E2111 | E0222 | 部分更新の呼び出し先が、構成子1つのもの（type、error、フィールドのある handler）でない（[データ型](/guide/data/)） | ``cannot update enum variant `Circle` with `..` `` |
| E2112 | E0223 | 部分更新で、変えるフィールドを位置で書いた（[データ型](/guide/data/)） | ``fields to update must be named: `field: value` `` |
| E2113 | E0231 | const が名前だけで循環している（[データ型](/guide/data/)） | ``constants refer to each other: `A` -> `B` -> `A` `` |
| W2101 | W0201 | 型名の型引数が、外側の同じ名前の型を隠す（[字句と予約語](/reference/lexical/)） | ``type parameter `Item` shadows type `Item` `` |
| W2102 | W0202 | モジュールの定義か import が、Prelude の同じ名前を隠す | `` `Some` shadows a Prelude name `` |
| E2201 | E0224 | `@intrinsic` を同梱の core のソースの外で使った（[字句と予約語](/reference/lexical/)） | ``` `@intrinsic` can only be used in the bundled core library ``` |
| E2202 | E0225 | `@intrinsic` を、本体のない fn、エフェクト、フィールドのない type 以外に付けた | ``` `@intrinsic` can only be used on a function without a body ``` |
| E2203 | E0226 | `@test` を、引数のある fn、本体のない fn、トップレベルの fn 以外に付けた、または `@test` に引数を付けた（[テスト](/guide/testing/)） | ``test function `takes` cannot take parameters`` |
| E2204 | E0227 | テスト関数を、テスト関数でない fn や const から参照した（[テスト](/guide/testing/)） | ``test function `adds` can only be used from test functions`` |
| E2205 | E0228 | `@internal` の fn を、同梱の core のモジュールの外から参照した | ``function `Secret.peek` can only be used from the bundled core library`` |
| E2206 | E0229 | `@internal` を、同梱の core の外か、トップレベルの fn 以外に付けた | ``` `@internal` can only be used in the bundled core library ``` / ``` `@internal` can only be used on top-level functions ``` |
| E2301 | E0207 | ディレクトリを渡したが `Pome.toml` が見つからない | ``no `Pome.toml` found in `proj` or its ancestors`` |
| E2302 | E0232 | `Pome.toml` の `[build].target` が知らないターゲット（[プロジェクトと Pome](/tools/pome/)） | ``unknown target `node` in `[build].target` `` |
| E2303 | E0233 | 依存の Pome の `@external` か `@export` を、`[external]` の `allow` で許していない（[プロジェクトと Pome](/tools/pome/)） | `` `github.com/acme/x` uses `@external`, but it is not allowed `` |
| E2304 | E0234 | 依存の `[pome].emela` が今のコンパイラより新しい、または版として読めない | `` `github.com/acme/x` needs emela 0.22.0 or newer; this is 0.21.0 `` / `` `[pome].emela` of `github.com/acme/x` is not a version: `next` `` |
| E2305 | E0235 | 依存のルート名がモジュール名にならない、またはソースパスからルート名を作れない | `` `Json-codec` (the root name of `github.com/acme/x`) is not a module name `` / ``cannot make a root name from `Json-Codec` of `github.com/acme/Json-Codec` `` |
| E2306 | E0236 | 言語サーバーが `Pome.toml` の依存を使えない（lock がない、キャッシュにない） | ``the dependencies cannot be used: no Pome.lock; run `emela pome install` `` |
| E2307 | E0238 | 依存グラフの Pome の `[pome].targets` にビルドするターゲットがない | `` `github.com/emela-lang/x/platform-cloudflare` supports only js, not wasm `` |
| E2308 | E0240 | 同じ Pome が `[dependencies]` と `[dev-dependencies]` の両方にある | `` `github.com/emela-lang/brix` is in both [dependencies] and [dev-dependencies] `` |
| W2301 | W0203 | 依存の `[pome].emela` が今のコンパイラより古い minor（ビルドは続ける） | `` `github.com/acme/x` is written for emela 0.20.1; this is 0.21.0 `` |
| W2302 | W0204 | `[external]` の `allow` の Pome が依存グラフにない | `` `github.com/acme/old` is allowed in [external] but not depended on `` |
| W2303 | W0205 | ビルドする Pome の `[pome].license` が文字列でない、または SPDX のライセンス式でない（[プロジェクトと Pome](/tools/pome/)） | `` `MIT/Apache-2.0` is not an SPDX license expression `` / `` `[pome].license` is not a string `` |
| W2304 | W0206 | `[experimental]` か `--experimental-<name>` の実験的な機能が、知らない名前、安定した機能、取り除いた機能のどれか（[プロジェクトと Pome](/tools/pome/)） | ``unknown experimental feature `name` `` / ``experimental feature `name` is now stable and always on`` / ``experimental feature `name` was removed`` |
| W2305 | W0207 | `[experimental]` の値が真偽値でない | `` `[experimental].name` must be `true` or `false` `` |

### E3xxx と W3xxx 型

| コード | 旧コード | 内容 | 文面の例 |
|---|---|---|---|
| E3001 | E0301 | 型が合わない | ``type mismatch: expected `Int`, found `String` `` |
| E3002 | E0302 | 無限型 | ``infinite type: `?0` occurs in `List[?0]` `` |
| E3003 | E0310 | 数値が来るはずの位置に数値でない型（算術演算子、単項マイナス） | ``expected a number (`Int`, `Int64` or `Float`), found `String` `` |
| E3004 | E0311 | 整数リテラルが型の範囲を超えた（[字句と予約語](/reference/lexical/)） | ``integer literal `3000000000` is out of range for `Int` `` |
| E3005 | E0314 | 型が決まらない値のフィールドを参照した、またはメソッドを呼んだ | ``the type of this value must be known to access field `name` `` / ``the type of this value must be known to call `f` `` |
| E3006 | E0316 | トップレベルの fn、局所関数、handler の init の引数に型がない（[束縛と関数](/guide/functions/)） | ``parameter `x` of a top-level function needs a type`` |
| E3007 | E0323 | 名前付き型の集合の型引数に、その種類のタグか集合の型引数でないものを書いた | `` `E` of `Handler` is an error set, found type `Int` `` |
| E3008 | E0324 | 集合でない型引数の位置に集合を書いた | `expected a type, found a set: sets can only be passed to set type parameters` |
| W3001 | W0304 | main の戻り値の型が `()`、`ExitCode`、Never のどれでもない（[実行時の意味](/reference/semantics/)） | ``the value of type `Int` returned by `main` is discarded`` |
| W3002 | W0305 | fn の型引数が fn の型（引数、戻り値、`fails`、`uses`）に現れない。呼び出しで決まらないので消すか使う。言語サーバーが消す quick fix を出す（[ジェネリクス](/guide/generics/)） | ``type parameter `A` of `f` does not appear in its signature`` |
| E3101 | E0304, E0305, E0309, E0332, E0406 | 数が合わない（型引数、呼び出しの引数、構成子のパターンのフィールド、impl の fn の引数と Trait の宣言、handler の操作の引数とエフェクトの宣言） | ``wrong number of type arguments: `List` takes 1, found 2`` / ``wrong number of arguments: `connect` takes 2, found 3`` / ``pattern `Rect` has 2 fields, found 1`` / ``wrong number of parameters: `show` of `Show` takes 1, found 2`` / ``wrong number of parameters: operation `info` takes 1, found 2`` |
| E3102 | E0303 | match が網羅していない（[パターンマッチ](/guide/pattern-matching/)） | ``non-exhaustive match: `Rect(_, _)` not covered`` |
| E3103 | E0306 | その名前の引数がない。引数名を持たない関数値を名前付き引数で呼んだときも含む | ``no parameter named `prot` in `connect` `` |
| E3104 | E0307 | 同じ引数を2回渡した。位置引数と名前付き引数で同じ仮引数を指したときも含む | ``argument `port` given more than once`` |
| E3105 | E0308 | 名前付きフィールドの構成子のパターンで、`..` を書かずにフィールドを省いた（[パターンマッチ](/guide/pattern-matching/)） | ``pattern `User` does not mention fields `id`, `email` `` |
| E3106 | E0312 | メソッド呼び出しかフィールドの参照で、その名前のフィールドも関数もない。メソッドとして見つかった関数を呼ばずに書いたときも含む | ``no field or function `nmae` for type `User` `` |
| E3107 | E0313 | フィールドを持たない型で、フィールドの参照かメソッド呼び出しの関数が見つからない | ``type `Int` has no field or function `nmae` `` |
| E3108 | E0317 | 束縛か無名関数の引数のパターンが、必ずは成功しない（[パターンマッチ](/guide/pattern-matching/)） | ``refutable pattern in binding: `None` not covered`` |
| E3109 | E0334 | 型のモジュールで、最初の引数がその型の fn に、その型のフィールドと同じ名前を付けた | ``function `headers` has the same name as a field of `Request` `` |
| E3110 | E0335 | メソッド呼び出しの候補が2つ以上ある。助言に修飾した書き方を出す | ``ambiguous method `show` for `User`: `User.show` and `Show.show` `` with ``= help: write `User.show(x)` or `Show.show(x)` `` |
| W3101 | W0301 | 冗長な腕（[パターンマッチ](/guide/pattern-matching/)） | `unreachable match arm` |
| E3201 | E0318, E0321 | 本体のエラーが宣言の E に含まれない（`-> T` の未処理のエラー、`fails` にないエラー、const の値や layer の項目の引数の失敗）。関数の値の E が、期待する関数型の E に含まれないときも含む（[エラー](/guide/errors/)） | ``unhandled error `NotFound` `` / ``error `DbError` is not declared in `fails` `` / ``error set mismatch: expected `fails {}`, found `fails Timeout` `` |
| E3202 | E0319 | エラーの型でない値を `fail` に渡した。1つのエラーの型を表す型引数をエラーでない型で具体化した（[エラー](/guide/errors/)） | ``expected an error value, found `Int` `` |
| E3203 | E0320 | escape の腕のパターンが変数、または `_` の腕にガードがある（[エラー](/guide/errors/)） | ``escape arms must match an error constructor or `_` `` / ``a `_` escape arm cannot have a guard`` |
| W3201 | W0302 | escape の腕が受けるエラーが元の式から起きない、または `_` の腕で元の式の E が空 | ``error `Timeout` is never raised here`` / `no error is raised here` |
| E3301 | E0325 | impl が、既定の実装のない Trait の関数を実装していない（[Trait](/guide/traits/)） | ``incomplete impl: missing methods `show`, `merge` `` |
| E3302 | E0326 | 型が Trait を満たさない（`==`、大小の比較、補間、制約、derive の対象のフィールド。derive できるのは Eq、Ord、Show、Encode、Decode、ObjectKey、Shaped だけ）（[Trait](/guide/traits/)） | ``type `User` does not implement `Eq` `` |
| E3303 | E0328 | impl の頭が、型の名前と重複のない型引数の並びになっていない | ``impl head must be a type with distinct type parameters: `List[Int]` `` |
| E3304 | E0329 | 上位 Trait が循環している | ``trait `A` is its own supertrait: `A` -> `B` -> `A` `` |
| E3305 | E0330 | 同じ型と Trait の組に impl が2つある（derive と手書きの impl の重なりを含む） | `` `Show` is already implemented for `User` `` |
| E3306 | E0331 | 型を定義したモジュールでも Trait を定義したモジュールでもない場所の impl | `` `Show` for `User` can only be implemented in the module of `Show` or of `User` `` |
| E3307 | E0333 | Trait の関数の Self が、その関数の中で決まらない | ``cannot infer which impl of `Parse` to use: add a type annotation`` |
| E3308 | E0336 | opaque な型に `derive Decode` か `derive ObjectKey`、フィールドのない `@external type` に `derive Encode` などを付けた | ``cannot derive `Decode` for opaque type `Email` `` / ``cannot derive `Encode` for host type `Handle` `` |
| E3309 | E0337 | `@key` と `@tag` を当てた後で、フィールドのキーかバリアントのタグが重なる | ``key `dueAt` is used by both `due_at` and `due` `` / ``tag `done` is used by both `Done` and `Closed` `` |
| E3310 | E0338 | `@key` をフィールド以外に、`@tag` をバリアント以外に付けた、同じものを2回付けた、引数が文字列リテラル1つでない | `` `@key` takes one string literal `` / `` `@tag` can only be placed on a variant `` / `` `@key` can only be placed once `` |
| E3311 | E0339 | `derive ObjectKey` を、フィールドが1つでない型か、中身を持つバリアントのある enum に付けた | ``cannot derive `ObjectKey` for `Shape`: variant `Circle` has contents`` / ``cannot derive `ObjectKey` for `Point`: it has 2 fields`` |
| E3312 | E0341 | 自動で決まる組み込みの Trait（Immediate、Capability）の impl を書いた（[型と効果の体系](/reference/type-system/)） | `` `Capability` is determined automatically and cannot be implemented `` |
| W3301 | W0303 | pub でない型に derive した実装がどこでも要らない | ``derived `Ord` for `Point` is never used`` |

### E4xxx と W4xxx エフェクト

| コード | 旧コード | 内容 | 文面の例 |
|---|---|---|---|
| E4001 | E0404 | handler が操作か handler member を全部は実装していない（[エフェクト](/guide/effects/)） | ``handler `Half` does not implement operation `warn` `` |
| E4002 | E0405 | handler が同じ操作か同じ handler member を2回実装した | ``operation `info` is implemented more than once`` |
| E4003 | E0413, E0433 | ハンドラが実装できないもののハンドラを書いた（ホストのエフェクト、External、組み込みのエフェクト TaskGroup・Spawn・Deferred・Semaphore・Permit・Queue、ラベル）（[中断する操作](/guide/suspend/)、[エフェクトのラベル](/guide/labels/)） | ``handler `Runtime` cannot implement `Async`: only the host provides it`` / ``handler `H` cannot implement `ProcessHost`: only the host provides it`` / ``handler `MyGroup` cannot implement `TaskGroup`: only `Task.Group` provides it`` / ``handler `H` cannot implement `External`: only the host provides it`` / ``handler `AuditH` cannot implement label `Audit` `` |
| E4004 | E0415 | ハンドラの操作の suspend の有無が、エフェクトの宣言と違う（[中断する操作](/guide/suspend/)） | ``operation `now` is not a `suspend fn` in effect `Clock` `` |
| E4005 | E0418 | ハンドラの値を、そのハンドラの init の外で、名前か `Self` で作った（[状態と資源](/guide/resources/)） | ``handler `Counter` can only be constructed in its own `init` `` |
| E4006 | E0419 | フィールドのあるハンドラに init がない（[状態と資源](/guide/resources/)） | ``handler `NoInit` has fields but no `init` `` |
| E4007 | E0420 | release が失敗しうる（[状態と資源](/guide/resources/)） | ``` `release` of handler `Counter` cannot fail, but this may fail with error `Boom` ``` |
| E4008 | E0423 | 型引数のあるエフェクトの型引数を書いていない（`use State`、uses 節、handler の頭） | ``missing type arguments for effect `State[S]` `` / ``handler `Fixed` must implement `State[S]` with concrete types`` |
| E4009 | E0424 | エフェクトの型引数を集合として使った（組み込みのエフェクトは除く） | ``type parameter `E` of effect `Raise` is used as a set, but effect type parameters must be ordinary types`` / ``type parameter `E` of handler `Wrap` is used as a set, but handler type parameters must be ordinary types`` |
| E4010 | E0446 | ソースで宣言したエフェクトに操作も handler member もない | ``effect `Marker` has no operations`` |
| E4011 | E0449 | 内側のハンドラが handler member に合わない（init の引数の名前か型が違う、別のエフェクトを実装している） | ``the init of `Open` takes `(path: Int)`, but handler member `Open` of `Files` takes `(path: String)` `` |
| E4012 | E0450, E0451 | handler の `:` の後に、同じエフェクトを2回並べた、または同じ名前の操作か handler member を持つ2つのエフェクトを並べた | ``effects `Query` and `Reader` of handler `Clash` both have `query` `` / ``effect `Audit` is listed more than once in handler `Repeated` `` |
| E4013 | E0462 | handler の型引数が、`:` の後のエフェクト、フィールドの型、init の引数の型のどれにも現れない | ``type parameter `A` of handler `H` does not appear in its effects, fields or init parameters`` |
| E4101 | E0411 | 同じ with のハンドラの依存が循環している | ``handlers depend on each other: `Stamped` -> `Ticking` -> `Stamped` `` |
| E4102 | E0421 | layer の中で同じエフェクトを2つのハンドラが供給する、または同じハンドラを2回並べた | ``effect `Logger` is provided by both `Counter` and `Quiet` in layer `Loud` `` |
| E4103 | E0422 | layer が互いを含む | ``layers include each other: `LoopA` -> `LoopB` -> `LoopA` `` |
| E4104 | E0434, E0435 | init の引数の過不足。引数を取るハンドラや handler member を引数なしで書いた、または引数を取らないもの（引数のない init のハンドラ、layer、ラベル）に引数を書いた（[状態と資源](/guide/resources/)） | ``handler `WorkerKv` needs arguments for its `init` `` / ``handler member `Open` needs arguments`` / ``handler `FakeKv` takes no arguments`` |
| E4105 | E0447 | handler member を `x =` なしで with の項目に書いた、layer の項目に書いた、with で layer を名前に束縛した、またはハンドラを作らないラベルの項目（`L`、P がエフェクトの `L by P`）を名前に束縛した | ``handler member `Open` must be bound to a name in `with` `` / ``handler member `Open` cannot be an item of layer `App` `` / ``layer `App` cannot be bound to a name: it provides more than one effect`` / ``label item `AuditLog by Console` cannot be bound to a name: it makes no handler`` |
| E4106 | E0448 | handler member を、with の項目と init の外で開いた | ``handler member `Open` can only be opened in `with` or called in an `init` `` |
| E4107 | E0459 | 型引数を持つハンドラの型引数が、with や layer の項目、`by` の右で決まらない（決まらない、本体のエフェクトの2つ以上に合う、同じ with の別の項目を上書きしうる） | ``cannot infer the type arguments of handler `Memory[S]` `` / ``cannot infer the type arguments of handler `Empty[A]`: both `State[List[Int]]` and `State[List[String]]` fit`` / ``cannot infer the type arguments of handler `InMemoryRepo[K, V]`: it may override `Repo[UserId, User]` of `AppLive` `` |
| E4201 | E0429 | ラベルの元のエフェクトがラベルか組み込みのエフェクト（[エフェクトのラベル](/guide/labels/)） | ``label `Nested` cannot stand for `Audit`: `Audit` is a label`` |
| E4202 | E0430 | ラベルでないエフェクトを with に書いた、または `by` の左に書いた（[エフェクトのラベル](/guide/labels/)） | ``effect `Log` is not a label: `with` takes a handler, a layer or a label`` / ``only a label can take `by`, but `Log` is not a label`` |
| E4203 | E0431 | `by` の右が、ラベルの元のエフェクトと別のエフェクトを供給する（[エフェクトのラベル](/guide/labels/)） | ``label `Audit` stands for `Log`, but `OtherH` provides `Other` `` |
| E4204 | E0432 | 同じ with で同じラベルに2回 `by` を書いた | ``label `Audit` is given a provider more than once in this `with` `` |
| W4201 | W0401 | with のラベルの項目（`L`、`L by P`）が使われない | ``label `Audit` is listed here but never used`` |
| E4301 | E0402, E0403 | 本体の R が、宣言や文脈の許す R に含まれない（uses 節、const、layer の項目の引数、main、テスト関数、`@export` の fn）。関数の値の R が、期待する関数型の R に含まれないときも含む。task の R から来るエフェクトや、名前に束縛した項目、モジュールの External には、それぞれの注記と助言が付く（[エフェクト](/guide/effects/)） | ``effect `Logger` is not declared in `uses` `` / ``effect `Clock` is not provided in `main` `` / ``effect set mismatch: expected `uses {}`, found `uses { Logger }` `` |
| E4302 | E0416 | Immediate を求める効果の集合が Immediate でない（[型と効果の体系](/reference/type-system/)） | ``effect `Clock` may suspend, but `R` of `update` must be `Immediate` `` |
| E4303 | E0417 | fn の操作（suspend fn でないもの）を実装する本体の R が Immediate でなく、中断しうる呼び出しを含む。`suspend` のない handler member の init と release も同じ（[中断する操作](/guide/suspend/)） | ``calling `stamp` may suspend because it uses effect `Clock`, but operation `now` is not a `suspend fn` `` |
| E4304 | E0322 | 効果の集合でない型引数に Immediate を付けた（[型と効果の体系](/reference/type-system/)） | `` `Immediate` can only constrain effect sets, but `A` is not used in `uses` `` |
| E4305 | E0461 | suspend fn の実装で、resume を直接呼んだ後か resume を渡した後に、中断しうる呼び出しが評価されうる。続きは resume の前に Spawn で始める（[中断する操作](/guide/suspend/)） | ``call to `send` may suspend after `resume` has been called`` |
| E4401 | E0401 | 能力の値のエフェクトにその操作がない | ``effect `Logger` has no operation `infoo` `` |
| E4402 | E0414 | ホストのエフェクトか External を `use` した | `` `Async` is a host effect and cannot be used with `use` `` / `` `ProcessHost` is a host effect and cannot be used with `use` `` / `` `External` cannot be used with `use` `` |
| E4403 | E0452 | `use F1 + ... + Fm` 型の引数に、どれかの Fi を持たない能力を渡した | ``expected `use Query + Execute`, found `use Query`, which does not have `Execute` `` |
| E4404 | E0453 | 効果の別名を `x.op(...)` か `x.op` の受け手以外に書いた、または効果の別名から handler member を開いた（[エフェクト](/guide/effects/)） | `` `log` is an effect alias, not a value: only `log.op(...)` and `log.op` can be written`` / ``handler member `Open` cannot be opened through effect alias `fs` `` |
| E4405 | E0455 | 能力が、それを作った with の外へ出る（本体の値の型、本体から出るエラーの型、with の R）。init で `Self(...)` に渡したフィールドが init の中の with の能力を持つときも含む（[エフェクト](/guide/effects/)） | ``capability `log` leaves the `with` that made it`` |
| E4406 | E0456 | 操作の戻り値の型に、能力の型か、その操作のエフェクト以外の能力に縛られた型がある。能力は handler member で渡す | ``the result of operation `open` cannot contain a capability type: `use Conn` `` |
| E4407 | E0458 | E の能力に縛られた型の値を、E を実装するハンドラの外で作った（[型と効果の体系](/reference/type-system/)） | ``a value of `EnemyId` can only be made inside a handler of `Engine` `` |
| E4408 | E0340 | Capability の制約を、ふつうの型でない型引数（エラーの集合、エフェクトの集合）に付けた | `` `Capability` can only constrain ordinary type parameters, but `R` is used in `uses` `` |
| W4401 | W0403 | `use E` を式として書いた（`(use E).op(...)` と `x = use E` のどちらも）。0.30 でエラーになる。`x <- E` か名前に束縛した with の項目 `with x = H` に書き換える。言語サーバーが書き換えの quick fix を出す（[エフェクト](/guide/effects/)） | `` `use Logger` as an expression is deprecated`` |

### E5xxx と W5xxx 外部関数とターゲット

| コード | 旧コード | 内容 | 文面の例 |
|---|---|---|---|
| E5001 | E0412 | エントリからたどれる外部関数に、ビルドするターゲットの言語の `@external` がない。`check` と言語サーバーは出さない（[外部関数](/guide/external/)） | ``external function `wasm_now` has no `@external(js, ...)` for target `js` `` |
| E5002 | E0445 | 外部関数の uses 節に、ProcessHost と PageHost 以外のエフェクト（Async と集合の型引数を含む）がある（[外部関数](/guide/external/)） | ``the uses of external function `write_host` can contain only `ProcessHost` and `PageHost` `` |
| E5003 | E0454 | 外部関数に渡す、または外部関数が返すコールバックの R に、ホストのエフェクトと（呼び出しで渡す関数では）その外部関数のモジュールの External 以外のエフェクトか、`@borrowed` のない引数での能力がある（[外部関数](/guide/external/)） | ``effect `Greeter` cannot be used by a callback of external function `set_timeout`: the host calls it without handlers`` / ``effect `Greeter` cannot be in the `uses` of a callback: the host calls it without handlers`` / ``capability `g` cannot be used by a callback of external function `set_timeout`: the host may call it after `g` has ended`` |
| E5004 | E0457 | 外部関数の関数型の引数以外に `@borrowed` を付けた（[外部関数](/guide/external/)） | `` `@borrowed` can only be written on a parameter of function type of an external function`` |
| E5101 | E0436 | `@export` の fn の引数か戻り値が境界の型でない（[外部関数](/guide/external/)） | ``exported function `f` cannot take `List[Int]` `` |
| E5102 | E0437 | エントリのモジュールの外に、`@export` の fn か `@entry` がある | `` `@export` is only allowed in the entry module `` / `` `@entry` is only allowed in the entry module `` |
| E5103 | E0438 | 同じターゲットに同じ名前の export が2つある | `` `fetch` is exported twice for target `js` `` |
| E5104 | E0439 | `@entry` の引数が entry adapter でない | `` `Http.get` is not an entry adapter `` |
| E5105 | E0440 | その fn を entry adapter の最初の引数に渡せない | `` `app` does not fit `Http.serve` `` |
| E5201 | E0427 | ビルドするターゲットが `native` で、エントリからたどれる外部関数がコールバックを取るか返す（[ターゲット](/reference/targets/)） | ``external function `on_data` takes a callback, which target `native` does not support yet`` |
| E5202 | E0441 | `native` で、export する fn が中断しうる | ``exported function `f` may suspend, which target `native` does not support`` |
| E5203 | E0442 | `native` で `@entry(Http.serve)` を使った（[ターゲット](/reference/targets/)） | ``HTTP services are not supported on target `native` yet`` |
| E5204 | E0443 | `native` で、エントリからたどれる外部関数か export する fn が、境界でまだ扱えない型（Array を含むもの）を取るか返す（[ターゲット](/reference/targets/)） | ``external function `rows` returns `Array[String]`, which target `native` does not support yet`` |

### E9xxx と W9xxx ツール

| コード | 旧コード | 内容 | 文面の例 |
|---|---|---|---|
| E9001 | E0901 | パスが見つからない | ``path `app` not found`` |
| E9002 | E0902 | ファイルかディレクトリを読めない | ``cannot read `src/a.emel`: permission denied`` |
| E9003 | E0903 | 出力を書き込めない | ``cannot write `target/emela/js/main.mjs` `` |
| W9001 | W0901 | `emela pome publish` で、公開 API の変更に対して版の上げ幅が足りない | ``removing `Quince.Router.mount` needs a new major version (v1.2.0 → v2.0.0)`` |
| E9101 | E0904, E0907, E0909 | 外部のツールが見つからない、起動できない、または古い（JS のホストが `--target js` で求める版より古い、cc。`EMELA_CC` に空白があれば `EMELA_CC_ARGS` を助言する。wasmtime が `--target wasm` で 49 より古い）（[emela コマンド](/tools/cli/)） | ``cannot start `node` `` / ``cannot start `cc` `` / ``` `wasmtime` not found ``` |
| E9102 | E0906 | JS の出力段が不正な出力を返した（処理系の内部の誤り） | `invalid output from the JS backend` |
| E9103 | E0908 | 出力した C のコンパイルに失敗した（処理系かホストの C の誤り） | ``` `cc` failed to compile the output of target `native` ``` |
| W9101 | W0902 | `EMELA_NODE` を設定している（[emela コマンド](/tools/cli/)） | `EMELA_NODE is deprecated; use EMELA_JS_HOST` |
