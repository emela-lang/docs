---
title: 診断コード
description: コンパイラとツールの診断のコード、表示の形式、帯、全コードの一覧
---

:::note[規範は仕様]
このページは仕様の [付録 A 診断コード](https://github.com/emela-lang/emela/blob/main/spec/diagnostics.md) を日本語でまとめたものです。規範となるのは英語の [仕様](https://github.com/emela-lang/emela/tree/main/spec) で、食い違うときは仕様に従います。一覧は emela 0.28.0 の時点のものです。
:::

コンパイラとツールの診断にはコードが振られています。エラーで止まったときは、ここでコードを引くと、何が起きたかと関係するページが分かります。

## 形

- エラーは `E` + 4桁、警告は `W` + 4桁です。一度振った番号は診断を廃止しても使い回しません。
- 番号は段ごとの帯に分けます。警告も同じ帯を使います（`W03xx` は型の警告）。
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
error[E0211]: cannot find value `usr` in this scope
   ╭─[ main.emel:3:7 ]
   │
 3 │   x = usr
   │       ─┬─
   │        ╰───
───╯
   = help: did you mean `user`?

error[E0301]: type mismatch: expected `Int`, found `String`
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

| 帯 | 段 |
|---|---|
| E01xx | 字句と構文（E0101〜E0109 は字句、E0110〜E0189 は構文、E0190〜E0199 は字句の追加分） |
| E02xx | モジュール、import、プロジェクトの構成 |
| E03xx | 型 |
| E04xx | effect、handler、layer、capture set |
| E05xx〜E08xx | 予約（Trait と derive、外部関数、テストなどに、使うときに割り当てる） |
| E09xx | ツール（入出力、JS のホスト、C コンパイラ、wasmtime など） |

## 一覧

文面の例はその診断の代表的な文面です。かっこの中のリンクは規則を説明しているページです。欠番も、番号を使い回さないことを示すために残しています。

### E01xx 字句と構文

| コード | 内容 | 文面の例 |
|---|---|---|
| E0101 | 文字列が閉じていない | `unterminated string literal` |
| E0102 | 補間 `#{` が閉じていない | `unterminated interpolation` |
| E0103 | どの名前のクラスにも合わない（[字句と予約語](/reference/lexical/)） | ``invalid name `Http_client`: not a lower, type, or upper name`` |
| E0104 | 数値の形になっていない | ``invalid number literal `1e9` `` |
| E0105 | 認識できない文字 | ``unrecognized character `é` `` |
| E0106 | `\` の後ろに文字がない（行末の `\`。複数行の文字列の中を含む） | ``missing character after `\` `` |
| E0107 | 使えないエスケープ | ``unknown escape sequence `\q` `` |
| E0108 | `\u{...}` の誤り（形の崩れ、サロゲート、10FFFF 超え） | ``` `\u{D800}` is a surrogate, not a Unicode scalar value ``` |
| E0109 | 複数行の文字列の形の誤り（開く `"""` の後が改行でない、閉じる `"""` が行に1つでない、閉じる行より浅いインデント） | ``expected a newline after the opening `"""` `` |
| E0110 | 来るはずのトークンがない。文面には期待したトークンの表示名が入る（記号と予約語はバッククォートで囲み、名前とリテラルは `lower name` のような種類名、入力の終わりは `end of file`） | ``expected `)` `` |
| E0111 | 型が来るはずの位置に型がない | `expected type` |
| E0112 | 要素が1つのタプル（型・パターン・式の `(a,)`、型とパターンの `(a)`） | `a tuple type needs at least two elements` |
| E0113 | パターンが来るはずの位置にパターンがない | `expected pattern` |
| E0114 | `..` の後ろに要素がある | ``` `..` must come last ``` |
| E0115 | リストの `..` の前に要素がない（`[..rest]`） | ``` `..` needs at least one element before it ``` |
| E0116 | 欠番（パターンの負の数の暫定の診断だった。0.20.1 で廃止） | |
| E0117 | パターンの文字列に補間がある | `string interpolation is not allowed in a pattern` |
| E0118 | 式が来るはずの位置に式がない | `expected expression` |
| E0119 | 比較演算子の連鎖（`a < b < c`） | `comparison operators cannot be chained` |
| E0120 | 名前付き引数の後ろの位置引数 | `positional arguments cannot follow named arguments` |
| E0121 | 括弧のない `use X.op()` | ``wrap `use` in parentheses to call its operations: `(use X).op()` `` |
| E0122 | 文・腕・宣言の後ろに改行か `}` がない | ``expected newline or `}` after statement`` |
| E0123 | パターンの外の `_` | ``` `_` can only be used in patterns ``` |
| E0124 | パターンの外の、式のない `..` | ``` `..` without an expression can only be used in patterns ``` |
| E0125 | 束縛の左辺がパターンとして読めない（`a + b = 1`） | `invalid left-hand side of binding: expected a pattern` |
| E0126 | 宣言が来るはずの位置に宣言がない | `expected declaration` |
| E0127 | 宣言の後ろの import（[モジュール](/guide/modules/)） | `imports must come before declarations` |
| E0128 | 1つのバリアントで名前付きと名前なしのフィールドを混ぜた（[データ型](/guide/data/)） | `a variant cannot mix named and positional fields` |
| E0129 | trait の本体の導出規則（導出規則の構文が決まるまでの暫定） | `derive rules in traits are not supported yet` |
| E0130 | `@external` がない。本体のない fn、トップレベルの suspend fn、フィールドのない type（[外部関数](/guide/external/)） | ``a function without a body must be `@external` `` |
| E0131 | `opaque` を type / enum 以外に付けた、または `pub` なしで付けた | ``` `opaque` can only be used on `type` and `enum` ``` |
| E0132 | バリアントのない enum | `an enum needs at least one variant` |
| E0133 | impl に `pub` や注釈を付けた | ``` `impl` cannot have `pub` or annotations ``` |
| E0134 | handler の操作の引数に型を書いた | `handler operation parameters take their types from the effect` |
| E0135 | impl と handler の fn に本体がない | `this function needs a body` |
| E0136 | impl の fn に戻り値の型、fails、uses を書いた | `impl methods take their signature from the trait` |
| E0137 | エフェクトの操作に `uses` 節を書いた（[エフェクト](/guide/effects/)） | ``effect operations cannot have a `uses` clause`` |
| E0138 | `@external` の引数の形の誤り（ターゲットの名前がない、文字列でない引数、文字列が1つか2つでない、文字列の補間）（[外部関数](/guide/external/)） | ``expected `@external(target, "name")` `` |
| E0139 | 1つの fn に同じ言語の `@external` が2つ以上ある（[外部関数](/guide/external/)） | ``duplicate `@external` for target `js` `` |
| E0140 | `@external` か `@export` の言語の名前を知らない（今は js、wasm、c）（[外部関数](/guide/external/)） | ``unknown language `node` `` |
| E0141 | `@external type` の注釈に引数を付けた（[外部関数](/guide/external/)） | ``` `@external` on a type takes no arguments ``` |
| E0142 | match を前置で書いた（[パターンマッチ](/guide/pattern-matching/)） | ``` `match` comes after the value: write `value match { ... }` ``` |
| E0144 | impl を `impl Trait for Type` か `impl[...] Type: Trait` の形で書いた（[Trait](/guide/traits/)） | ``write `impl User: Show` instead of `impl Show for User` `` |
| E0145 | handler を `implements` で書いた（[エフェクト](/guide/effects/)） | ``write `handler ConsoleLogger: Logger` instead of `implements` `` |
| E0146 | `@export` の引数の形の誤り。トップレベルの本体のある fn 以外に付けたときも含む（[外部関数](/guide/external/)） | ``expected `@export(target, "name")` `` |
| E0147 | uses 節を書く位置（シグネチャ、関数型、エフェクトの操作）に `use` を書いた | ``write `uses { Http }` instead of `use Http` `` |
| E0148 | `fn(...)` を式として書いた。無名関数は `\|x\| body` と書く（[束縛と関数](/guide/functions/)） | ``anonymous functions are written `\|x\| body` `` |
| E0149 | 無名関数を、ブロックの最後でない文として書いた。行頭の `\|\|` が前の行の続きにならないことを助言に出す | `this anonymous function is never used` |
| E0150 | 局所関数に型引数、注釈、`pub`、`suspend` を付けた（[束縛と関数](/guide/functions/)） | `a local function cannot have type parameters` |
| E0151 | 局所関数をブロックの最後の文として書いた（[束縛と関数](/guide/functions/)） | ``local function `go` is never called`` |
| E0152〜 | 構文のエラー | パーサで割り当てて、この表に足す |

### E02xx と W02xx モジュール、import、プロジェクトの構成

| コード | 内容 | 文面の例 |
|---|---|---|
| E0201 | ファイル名がモジュール名にならない（[モジュールと名前の解決](/reference/modules/)） | ``file name `Foo` cannot be a module name: not lower snake_case`` |
| E0202 | ディレクトリ名がモジュール名にならない | ``directory name `My-Dir` cannot be a module name: not lower snake_case`` |
| E0203 | 予約されたモジュール名（ソースのルート直下の `prelude.emel`、core のモジュール名、`std`、テストのルート直下の `main.emel` と `lib.emel`）。依存のルート名が予約された名前のときも含む | ``module name `Prelude` is reserved`` |
| E0204 | モジュールの重複（大文字小文字の違いだけのもの、ソースのルートとテストのルートにまたがるものを含む）。依存のルート名がほかのモジュールやルート名とぶつかるときも含む（[プロジェクトと Pome](/tools/pome/)） | ``duplicate module `Http.Client` `` |
| E0205 | import 先のモジュールがない | ``undefined module `Http.Clinet` `` |
| E0206 | import の循環（自己 import を含む） | ``import cycle: `A` -> `B` -> `A` `` |
| E0207 | ディレクトリを渡したが `Pome.toml` が見つからない | ``no `Pome.toml` found in `proj` or its ancestors`` |
| E0208 | 渡したファイルかディレクトリがソースのルートの外にある。テストのルートのファイルを `build` や `run` に渡したときも含む（[emela コマンド](/tools/cli/)） | ``directory `scripts` is outside the source root `src` `` |
| E0209 | エントリが見つからない（build と run だけ） | ``entry `src/main.emel` not found`` |
| E0210 | エントリがモジュールにならない | ``entry `src/Main.emel` is not a module`` |
| E0211 | 未定義の名前 | ``cannot find value `usr` in this scope`` |
| E0212 | モジュール、Trait、エフェクトに、その名前の項目がない | ``module `Http.Client` has no item `gett` `` |
| E0213 | 同じ名前空間での定義の重複。後の定義を指し、前の定義の位置を添える | ``duplicate definition of `User` `` |
| E0214 | pub でない定義を、ほかのモジュールから参照した | `` `parse_raw` is private to `Email` `` |
| E0215 | opaque な型を定義したモジュールの外で構築した（[モジュール](/guide/modules/)） | ``cannot construct opaque type `Email` outside its module`` |
| E0216 | opaque な型を定義したモジュールの外でパターンに書いた（[モジュール](/guide/modules/)） | ``cannot match on opaque type `Email` outside its module`` |
| E0217 | 名前は見つかったが、その位置に書けない種類だった | ``expected an error, found type `User` `` |
| E0218 | `.` の左の名前が、モジュールと Trait の両方を指す | ``ambiguous name `Show`: both a module and a trait`` |
| E0219 | `self` か `Self` を、使えない場所に書いた | `` `self` is only available in handlers, traits, and impls `` |
| E0220 | 1つのパターンか引数の並びで、同じ名前を2回束縛した | `` `x` is bound more than once `` |
| E0221 | 型の位置にエフェクトの名前を書いた。集合でない型引数の位置（`List[Db]`）も含む（[型と効果の体系](/reference/type-system/)） | ``effect `Logger` cannot be used as a type`` |
| E0222 | 部分更新の呼び出し先が、構成子1つのもの（type、error、フィールドのある handler）でない（[データ型](/guide/data/)） | ``cannot update enum variant `Circle` with `..` `` |
| E0223 | 部分更新で、変えるフィールドを位置で書いた（[データ型](/guide/data/)） | ``fields to update must be named: `field: value` `` |
| E0224 | `@intrinsic` を同梱の core のソースの外で使った（[字句と予約語](/reference/lexical/)） | ``` `@intrinsic` can only be used in the bundled core library ``` |
| E0225 | `@intrinsic` を、本体のない fn、エフェクト、フィールドのない type 以外に付けた | ``` `@intrinsic` can only be used on a function without a body ``` |
| E0226 | `@test` を、引数のある fn、本体のない fn、トップレベルの fn 以外に付けた、または `@test` に引数を付けた（[テスト](/guide/testing/)） | ``test function `takes` cannot take parameters`` |
| E0227 | テスト関数を、テスト関数でない fn や const から参照した（[テスト](/guide/testing/)） | ``test function `adds` can only be used from test functions`` |
| E0228 | `@internal` の fn を、同梱の core のモジュールの外から参照した | ``function `Secret.peek` can only be used from the bundled core library`` |
| E0229 | `@internal` を、同梱の core の外か、トップレベルの fn 以外に付けた | ``` `@internal` can only be used in the bundled core library ``` |
| E0230 | `emela run` のエントリに main がなく、HTTP サービスでもない。ライブラリだけのプロジェクトを `run` したときも含む（[実行時の意味](/reference/semantics/)） | ``entry `src/main.emel` has no `main` function`` |
| E0231 | const が名前だけで循環している（[データ型](/guide/data/)） | ``constants refer to each other: `A` -> `B` -> `A` `` |
| E0232 | `Pome.toml` の `[build].target` が知らないターゲット（[プロジェクトと Pome](/tools/pome/)） | ``unknown target `node` in `[build].target` `` |
| E0233 | 依存の Pome の `@external` か `@export` を、`[external]` の `allow` で許していない（[プロジェクトと Pome](/tools/pome/)） | `` `github.com/acme/x` uses `@external`, but it is not allowed `` |
| E0234 | 依存の `[pome].emela` が今のコンパイラより新しい、または版として読めない | `` `github.com/acme/x` needs emela 0.22.0 or newer; this is 0.21.0 `` |
| E0235 | 依存のルート名がモジュール名にならない、またはソースパスからルート名を作れない | `` `Json-codec` (the root name of `github.com/acme/x`) is not a module name `` |
| E0236 | 言語サーバーが `Pome.toml` の依存を使えない（lock がない、キャッシュにない） | ``the dependencies cannot be used: no Pome.lock; run `emela pome install` `` |
| E0237 | 依存の Pome の `@external` の fn が pub | ``an `@external` function cannot be `pub` in a dependency`` |
| E0238 | 依存グラフの Pome の `[pome].targets` にビルドするターゲットがない | `` `github.com/emela-lang/x/platform-cloudflare` supports only js, not wasm `` |
| E0239 | ソースのルートのモジュールが、テストのルートのモジュールか `[dev-dependencies]` の Pome を import した（[テスト](/guide/testing/)） | `` `Brix.Pbt.Property` can only be imported under `test/` `` |
| E0240 | 同じ Pome が `[dependencies]` と `[dev-dependencies]` の両方にある | `` `github.com/emela-lang/brix` is in both [dependencies] and [dev-dependencies] `` |
| W0201 | 型名の型引数が、外側の同じ名前の型を隠す（[字句と予約語](/reference/lexical/)） | ``type parameter `Item` shadows type `Item` `` |
| W0202 | モジュールの定義か import が、Prelude の同じ名前を隠す | `` `Some` shadows a Prelude name `` |
| W0203 | 依存の `[pome].emela` が今のコンパイラより古い minor（ビルドは続ける） | `` `github.com/acme/x` is written for emela 0.20.1; this is 0.21.0 `` |
| W0204 | `[external]` の `allow` の Pome が依存グラフにない | `` `github.com/acme/old` is allowed in [external] but not depended on `` |
| W0205 | ビルドする Pome の `[pome].license` が文字列でない、または SPDX のライセンス式でない（[プロジェクトと Pome](/tools/pome/)） | `` `MIT/Apache-2.0` is not an SPDX license expression `` |
| W0206 | `[experimental]` か `--experimental-<name>` の実験的な機能が、知らない名前、安定した機能、取り除いた機能のどれか（[プロジェクトと Pome](/tools/pome/)） | ``unknown experimental feature `name` `` |
| W0207 | `[experimental]` の値が真偽値でない | `` `[experimental].name` must be `true` or `false` `` |

### E03xx と W03xx 型

| コード | 内容 | 文面の例 |
|---|---|---|
| E0301 | 型が合わない | ``type mismatch: expected `Int`, found `String` `` |
| E0302 | 無限型 | ``infinite type: `?0` occurs in `List[?0]` `` |
| E0303 | match が網羅していない（[パターンマッチ](/guide/pattern-matching/)） | ``non-exhaustive match: `Rect(_, _)` not covered`` |
| E0304 | 型引数の数が合わない（組み込みの型、type / enum / error、型引数） | ``wrong number of type arguments: `List` takes 1, found 2`` |
| E0305 | 呼び出しの引数の数が合わない | ``wrong number of arguments: `connect` takes 2, found 3`` |
| E0306 | その名前の引数がない。引数名を持たない関数値を名前付き引数で呼んだときも含む | ``no parameter named `prot` in `connect` `` |
| E0307 | 同じ引数を2回渡した。位置引数と名前付き引数で同じ仮引数を指したときも含む | ``argument `port` given more than once`` |
| E0308 | 名前付きフィールドの構成子のパターンで、`..` を書かずにフィールドを省いた（[パターンマッチ](/guide/pattern-matching/)） | ``pattern `User` does not mention fields `id`, `email` `` |
| E0309 | 構成子のパターンのフィールドの数が合わない（多すぎる、または `..` なしで足りない） | ``pattern `Rect` has 2 fields, found 1`` |
| E0310 | 数値が来るはずの位置に数値でない型（算術演算子、単項マイナス） | ``expected a number (`Int`, `Int64` or `Float`), found `String` `` |
| E0311 | 整数リテラルが型の範囲を超えた（[字句と予約語](/reference/lexical/)） | ``integer literal `3000000000` is out of range for `Int` `` |
| E0312 | メソッド呼び出しかフィールドの参照で、その名前のフィールドも関数もない。メソッドとして見つかった関数を呼ばずに書いたときも含む | ``no field or function `nmae` for type `User` `` |
| E0313 | フィールドを持たない型で、フィールドの参照かメソッド呼び出しの関数が見つからない | ``type `Int` has no field or function `nmae` `` |
| E0314 | 型が決まらない値のフィールドを参照した、またはメソッドを呼んだ | ``the type of this value must be known to access field `name` `` |
| E0315 | opaque な型のフィールドを定義したモジュールの外で参照した（[モジュール](/guide/modules/)） | ``cannot access field `value` of opaque type `Email` outside its module`` |
| E0316 | トップレベルの fn、局所関数、handler の init の引数に型がない（[束縛と関数](/guide/functions/)） | ``parameter `x` of a top-level function needs a type`` |
| E0317 | 束縛か無名関数の引数のパターンが、必ずは成功しない（[パターンマッチ](/guide/pattern-matching/)） | ``refutable pattern in binding: `None` not covered`` |
| E0318 | 本体のエラーが宣言の E に含まれない（`-> T` の未処理のエラー、`fails` にないエラー、const の値や layer の項目の引数の失敗）（[エラー](/guide/errors/)） | ``unhandled error `NotFound` `` / ``error `DbError` is not declared in `fails` `` |
| E0319 | エラーの型でない値を `fail` に渡した。1つのエラーの型を表す型引数をエラーでない型で具体化した（[エラー](/guide/errors/)） | ``expected an error value, found `Int` `` |
| E0320 | escape の腕のパターンが変数、または `_` の腕にガードがある（[エラー](/guide/errors/)） | ``escape arms must match an error constructor or `_` `` |
| E0321 | 関数の値の E が、期待する関数型の E に含まれない（[型と効果の体系](/reference/type-system/)） | ``error set mismatch: expected `fails {}`, found `fails Timeout` `` |
| E0322 | 効果の集合でない型引数に Immediate を付けた（[型と効果の体系](/reference/type-system/)） | `` `Immediate` can only constrain effect sets, but `A` is not used in `uses` `` |
| E0323 | 名前付き型の集合の型引数に、その種類のタグか集合の型引数でないものを書いた | `` `E` of `Handler` is an error set, found type `Int` `` |
| E0324 | 集合でない型引数の位置に集合を書いた | `expected a type, found a set: sets can only be passed to set type parameters` |
| E0325 | impl が、既定の実装のない Trait の関数を実装していない（[Trait](/guide/traits/)） | ``incomplete impl: missing methods `show`, `merge` `` |
| E0326 | 型が Trait を満たさない（`==`、大小の比較、補間、制約、derive の対象のフィールド。derive できるのは Eq、Ord、Show、Encode、Decode、ObjectKey、Shaped だけ）（[Trait](/guide/traits/)） | ``type `User` does not implement `Eq` `` |
| E0327 | 欠番（`@export` の fn だけを外に出し、それが境界の型しか取らないため） | |
| E0328 | impl の頭が、型の名前と重複のない型引数の並びになっていない | ``impl head must be a type with distinct type parameters: `List[Int]` `` |
| E0329 | 上位 Trait が循環している | ``trait `A` is its own supertrait: `A` -> `B` -> `A` `` |
| E0330 | 同じ型と Trait の組に impl が2つある（derive と手書きの impl の重なりを含む） | `` `Show` is already implemented for `User` `` |
| E0331 | 型を定義したモジュールでも Trait を定義したモジュールでもない場所の impl | `` `Show` for `User` can only be implemented in the module of `Show` or of `User` `` |
| E0332 | impl の fn の引数の数が Trait の宣言と違う | ``wrong number of parameters: `show` of `Show` takes 1, found 2`` |
| E0333 | Trait の関数の Self が、その関数の中で決まらない | ``cannot infer which impl of `Parse` to use: add a type annotation`` |
| E0334 | 型のモジュールで、最初の引数がその型の fn に、その型のフィールドと同じ名前を付けた | ``function `headers` has the same name as a field of `Request` `` |
| E0335 | メソッド呼び出しの候補が2つ以上ある。助言に修飾した書き方を出す | ``ambiguous method `show` for `User`: `User.show` and `Show.show` `` |
| E0336 | opaque な型に `derive Decode` か `derive ObjectKey`、フィールドのない `@external type` に `derive Encode` などを付けた | ``cannot derive `Decode` for opaque type `Email` `` |
| E0337 | `@key` と `@tag` を当てた後で、フィールドのキーかバリアントのタグが重なる | ``key `dueAt` is used by both `due_at` and `due` `` |
| E0338 | `@key` をフィールド以外に、`@tag` をバリアント以外に付けた、同じものを2回付けた、引数が文字列リテラル1つでない | `` `@key` takes one string literal `` |
| E0339 | `derive ObjectKey` を、フィールドが1つでない型か、中身を持つバリアントのある enum に付けた | ``cannot derive `ObjectKey` for `Point`: it has 2 fields`` |
| W0301 | 冗長な腕（[パターンマッチ](/guide/pattern-matching/)） | `unreachable match arm` |
| W0302 | escape の腕が受けるエラーが元の式から起きない、または `_` の腕で元の式の E が空 | ``error `Timeout` is never raised here`` / `no error is raised here` |
| W0303 | pub でない型に derive した実装がどこでも要らない | ``derived `Ord` for `Point` is never used`` |
| W0304 | main の戻り値の型が `()`、`ExitCode`、Never のどれでもない（[実行時の意味](/reference/semantics/)） | ``the value of type `Int` returned by `main` is discarded`` |

### E04xx と W04xx effect、handler、layer、capture set

| コード | 内容 | 文面の例 |
|---|---|---|
| E0401 | 能力の値のエフェクトにその操作がない | ``effect `Logger` has no operation `infoo` `` |
| E0402 | 本体の R が、宣言や文脈の許す R に含まれない（uses 節、const、layer の項目の引数、main、テスト関数、`@export` の fn）（[エフェクト](/guide/effects/)） | ``effect `Logger` is not declared in `uses` `` / ``effect `Clock` is not provided in `main` `` |
| E0403 | 関数の値の R が、期待する関数型の R に含まれない | ``effect set mismatch: expected `uses {}`, found `uses { Logger }` `` |
| E0404 | handler が操作か handler member を全部は実装していない（[エフェクト](/guide/effects/)） | ``handler `Half` does not implement operation `warn` `` |
| E0405 | handler が同じ操作か同じ handler member を2回実装した | ``operation `info` is implemented more than once`` |
| E0406 | handler の操作の引数の数が宣言と違う | ``wrong number of parameters: operation `info` takes 1, found 2`` |
| E0407 | uses を省略した、または uses にホストのエフェクトを持つ `@external` の fn か、`@external suspend fn` を、ハンドラの外で使った（[外部関数](/guide/external/)） | ``external function `console_log` can only be used in handlers`` |
| E0408 | 欠番（能力の値を引数に渡した。`use E` を型にしたときに廃止） | |
| E0409 | 欠番（能力の値をデータ構造に入れた。同上） | |
| E0410 | 欠番（能力の値を関数から返した。同上） | |
| E0411 | 同じ with のハンドラの依存が循環している | ``handlers depend on each other: `Stamped` -> `Ticking` -> `Stamped` `` |
| E0412 | エントリからたどれる外部関数に、ビルドするターゲットの言語の `@external` がない。`check` と言語サーバーは出さない（[外部関数](/guide/external/)） | ``external function `wasm_now` has no `@external(js, ...)` for target `js` `` |
| E0413 | ホストのエフェクトか Scope のハンドラを書いた（[中断する操作](/guide/suspend/)） | ``handler `Runtime` cannot implement `Async`: only the host provides it`` |
| E0414 | ホストのエフェクトを `use` した | `` `Async` is a host effect and cannot be used with `use` `` |
| E0415 | ハンドラの操作の suspend の有無が、エフェクトの宣言と違う（[中断する操作](/guide/suspend/)） | ``operation `now` is not a `suspend fn` in effect `Clock` `` |
| E0416 | Immediate を求める効果の集合が Immediate でない（[型と効果の体系](/reference/type-system/)） | ``effect `Clock` may suspend, but `R` of `update` must be `Immediate` `` |
| E0417 | fn の操作（suspend fn でないもの）を実装する本体の R が Immediate でなく、中断しうる呼び出しを含む。`suspend` のない handler member の init と release も同じ（[中断する操作](/guide/suspend/)） | ``calling `stamp` may suspend because it uses effect `Clock`, but operation `now` is not a `suspend fn` `` |
| E0418 | ハンドラの値を、そのハンドラの init の外で、名前か `Self` で作った（[状態と資源](/guide/resources/)） | ``handler `Counter` can only be constructed in its own `init` `` |
| E0419 | フィールドのあるハンドラに init がない（[状態と資源](/guide/resources/)） | ``handler `NoInit` has fields but no `init` `` |
| E0420 | release が失敗しうる（[状態と資源](/guide/resources/)） | ``` `release` of handler `Counter` cannot fail, but this may fail with error `Boom` ``` |
| E0421 | layer の中で同じエフェクトを2つのハンドラが供給する、または同じハンドラを2回並べた | ``effect `Logger` is provided by both `Counter` and `Quiet` in layer `Loud` `` |
| E0422 | layer が互いを含む | ``layers include each other: `LoopA` -> `LoopB` -> `LoopA` `` |
| E0423 | 型引数のあるエフェクトの型引数を書いていない（`use State`、uses 節、handler の頭） | ``missing type arguments for effect `State[S]` `` |
| E0424 | エフェクトの型引数を集合として使った（組み込みのエフェクトは除く） | ``type parameter `E` of effect `Raise` is used as a set, but effect type parameters must be ordinary types`` |
| E0425 | `Fiber.scope` の値の型に `Fiber`、`Deferred`、`Semaphore`、`Queue` が含まれる（[並行処理](/guide/concurrency/)） | ``a `Fiber` cannot leave the `Fiber.scope` that started it`` |
| E0426 | 利用者のエフェクトの操作に型引数を書いた | ``operation `wrap` cannot have type parameters: only built-in effects may declare them`` |
| E0427 | ビルドするターゲットが `native` で、エントリからたどれる外部関数がコールバックを取るか返す（[ターゲット](/reference/targets/)） | ``external function `on_data` takes a callback, which target `native` does not support yet`` |
| E0428 | 欠番（C の suspend fn の外部関数を、完了を後から知らせる形で認めたため） | |
| E0429 | ラベルの元のエフェクトがラベルか組み込みのエフェクト（[エフェクトのラベル](/guide/labels/)） | ``label `Nested` cannot stand for `Audit`: `Audit` is a label`` |
| E0430 | ラベルでないエフェクトを with に書いた、または `by` の左に書いた（[エフェクトのラベル](/guide/labels/)） | ``effect `Log` is not a label: `with` takes a handler, a layer or a label`` |
| E0431 | `by` の右が、ラベルの元のエフェクトと別のエフェクトを供給する（[エフェクトのラベル](/guide/labels/)） | ``label `Audit` stands for `Log`, but `OtherH` provides `Other` `` |
| E0432 | 同じ with で同じラベルに2回 `by` を書いた | ``label `Audit` is given a provider more than once in this `with` `` |
| E0433 | ラベルのハンドラを書いた（[エフェクトのラベル](/guide/labels/)） | ``handler `AuditH` cannot implement label `Audit` `` |
| E0434 | init が引数を取るハンドラを、with や layer の項目、`by` の右に引数なしで書いた（[状態と資源](/guide/resources/)） | ``handler `WorkerKv` needs arguments for its `init` `` |
| E0435 | 引数を取らないもの（引数のない init のハンドラ、layer、ラベル）に引数を書いた | ``handler `FakeKv` takes no arguments`` |
| E0436 | `@export` の fn の引数か戻り値が境界の型でない（[外部関数](/guide/external/)） | ``exported function `f` cannot take `List[Int]` `` |
| E0437 | エントリのモジュールの外に、`@export` の fn か `@entry` がある | `` `@export` is only allowed in the entry module `` |
| E0438 | 同じターゲットに同じ名前の export が2つある | `` `fetch` is exported twice for target `js` `` |
| E0439 | `@entry` の引数が entry adapter でない | `` `Http.get` is not an entry adapter `` |
| E0440 | その fn を entry adapter の最初の引数に渡せない | `` `app` does not fit `Http.serve` `` |
| E0441 | `native` で、export する fn が中断しうる | ``exported function `f` may suspend, which target `native` does not support`` |
| E0442 | `native` で `@entry(Http.serve)` を使った（[ターゲット](/reference/targets/)） | ``HTTP services are not supported on target `native` yet`` |
| E0443 | `native` で、エントリからたどれる外部関数か export する fn が、境界でまだ扱えない型（Bytes か Array を含むもの）を取るか返す | ``external function `read_file` takes `Bytes`, which target `native` does not support yet`` |
| E0444 | 実験的な機能 `capture-checking` で、ルートを持つ値が、それを供給する with か `Fiber.scope` の外へ出る | ``a value that holds `log` cannot leave the `with` that provides it`` |
| E0445 | 外部関数の uses 節に、ProcessHost、PageHost、Async、集合の型引数以外のエフェクトがある | ``the uses of external function `write_host` can contain only `ProcessHost` and `PageHost` `` |
| E0446 | ソースで宣言したエフェクトに操作も handler member もない | ``effect `Marker` has no operations`` |
| E0447 | handler member を `x =` なしで with の項目に書いた、layer の項目に書いた、または with で layer を名前に束縛した | ``handler member `Open` must be bound to a name in `with` `` |
| E0448 | handler member を、with の項目と init の外で開いた | ``handler member `Open` can only be opened in `with` or called in an `init` `` |
| E0449 | 内側のハンドラが handler member に合わない（init の引数の名前か型が違う、別のエフェクトを実装している） | ``the init of `Open` takes `(path: Int)`, but handler member `Open` of `Files` takes `(path: String)` `` |
| E0450 | handler の `:` の後に並べた2つのエフェクトに、同じ名前の操作か handler member がある | ``effects `Query` and `Reader` of handler `Clash` both have `query` `` |
| E0451 | handler の `:` の後に同じエフェクトを2回並べた | ``effect `Audit` is listed more than once in handler `Repeated` `` |
| E0452 | `use F1 + ... + Fm` 型の引数に、どれかの Fi を持たない能力を渡した | ``expected `use Query + Execute`, found `use Query`, which does not have `Execute` `` |
| W0401 | with のラベルの項目（`L`、`L by P`）が使われない | ``label `Audit` is listed here but never used`` |
| W0402 | ルートを持つ値が、それを供給する with か `Fiber.scope` の外へ出る。`capture-checking` を有効にすると E0444 になる | ``a value that holds `log` leaves the `with` that provides it`` |

### E09xx と W09xx ツール

| コード | 内容 | 文面の例 |
|---|---|---|
| E0901 | パスが見つからない | ``path `app` not found`` |
| E0902 | ファイルかディレクトリを読めない | ``cannot read `src/a.emel`: permission denied`` |
| E0903 | 出力を書き込めない | ``cannot write `target/emela/js/main.mjs` `` |
| E0904 | JS のホストが見つからない、起動できない、または `--target js` で求める版より古い（[emela コマンド](/tools/cli/)） | ``cannot start `node` `` |
| E0905 | JS の出力がまだない（0.20 の途中の段だけ） | `JS backend is not available yet` |
| E0906 | JS の出力段が不正な出力を返した（処理系の内部の誤り） | `invalid output from the JS backend` |
| E0907 | cc が見つからない、起動できない。`EMELA_CC` に空白があれば `EMELA_CC_ARGS` を助言する（[emela コマンド](/tools/cli/)） | ``cannot start `cc` `` |
| E0908 | 出力した C のコンパイルに失敗した（処理系かホストの C の誤り） | ``` `cc` failed to compile the output of target `native` ``` |
| E0909 | `--target wasm` で wasmtime が見つからない、起動できない、または 49 より古い | ``` `wasmtime` not found ``` |
| W0901 | `emela pome publish` で、公開 API の変更に対して版の上げ幅が足りない | ``removing `Quince.Router.mount` needs a new major version (v1.2.0 → v2.0.0)`` |
| W0902 | `EMELA_NODE` を設定している（[emela コマンド](/tools/cli/)） | `EMELA_NODE is deprecated; use EMELA_JS_HOST` |
| W0903 | `--target`、`[build].target`、`[pome].targets` でターゲット `c` を使った。0.29 で取り除く | ``target `c` is deprecated; use `native` `` |
