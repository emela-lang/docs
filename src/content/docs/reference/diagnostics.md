---
title: 診断コード
description: コンパイラとツールの診断のコード、表示の形式、帯、全コードの一覧
---

コンパイラとツールの診断にはコードが振られています。エラーで止まったときは、ここでコードを引くと、何が起きたかと関係するページが分かります。

## 形

- エラーは `E` + 4桁、警告は `W` + 4桁です。一度振った番号は診断を廃止しても使い回しません。
- 番号は段ごとの帯に分けます。警告も同じ帯を使います（`W03xx` は型の警告）。
- 文面は英語です。文面は仕様の一部ではなく、改善のために変わることがあります。コードは変わりません。

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

## 帯

| 帯 | 段 |
|---|---|
| E01xx | 字句と構文（E0101〜E0109 は字句、E0110〜E0189 は構文、E0190〜E0199 は字句の追加分） |
| E02xx | モジュール、import、プロジェクトの構成 |
| E03xx | 型 |
| E04xx | effect、handler、layer、capture set |
| E05xx〜E08xx | 予約（Trait と derive、外部関数、テストなどに、使うときに割り当てる） |
| E09xx | ツール（入出力、node など） |

## 一覧

文面の例はその診断の代表的な文面です。かっこの中のリンクは規則を説明しているページです。

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
| E0110 | 来るはずのトークンがない。文面には期待したトークンの表示名が入る（記号と予約語はバッククォートで囲み、名前とリテラルは `lower name` `integer literal` のような種類名、入力の終わりは `end of file`） | ``expected `)` `` |
| E0111 | 型が来るはずの位置に型がない | `expected type` |
| E0112 | 要素が1つのタプル（型・パターン・式の `(a,)`、型とパターンの `(a)`） | `a tuple type needs at least two elements` |
| E0113 | パターンが来るはずの位置にパターンがない | `expected pattern` |
| E0114 | `..` の後ろに要素がある | ``` `..` must come last ``` |
| E0115 | リストの `..` の前に要素がない（`[..rest]`） | ``` `..` needs at least one element before it ``` |
| E0116 | 欠番（パターンの負の数の暫定の診断だった。0.20.1 で負の数を書けるようにして廃止） | |
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
| E0128 | 1つのバリアントで名前付きと名前なしのフィールドを混ぜた（[文法](/reference/grammar/)） | `a variant cannot mix named and positional fields` |
| E0129 | trait の本体の導出規則（導出規則の構文が決まるまでの暫定） | `derive rules in traits are not supported yet` |
| E0130 | `@external` がない: 本体のない fn、トップレベルの suspend fn、フィールドのない type（[文法](/reference/grammar/)） | ``a function without a body must be `@external` `` |
| E0131 | `opaque` を type / enum 以外に付けた、または `pub` なしで付けた | ``` `opaque` can only be used on `type` and `enum` ``` |
| E0132 | バリアントのない enum | `an enum needs at least one variant` |
| E0133 | impl に `pub` や注釈を付けた（[文法](/reference/grammar/) の impl_decl） | ``` `impl` cannot have `pub` or annotations ``` |
| E0134 | handler の操作の引数に型を書いた（handler_item） | `handler operation parameters take their types from the effect` |
| E0135 | impl と handler の fn に本体がない | `this function needs a body` |
| E0136 | impl の fn に戻り値、fails、use を書いた（impl_item） | `impl methods take their signature from the trait` |
| E0137 | エフェクトの操作に `use` 節を書いた（[文法](/reference/grammar/) の op_sig） | ``effect operations cannot have a `use` clause`` |
| E0138 | `@external` の引数の形の誤り（ターゲットの名前がない、文字列でない引数、文字列が1つか2つでない、文字列の補間）（[外部関数](/guide/external/)） | ``expected `@external(target, "name")` `` |
| E0139 | 1つの fn に同じターゲットの `@external` が2つ以上ある（[外部関数](/guide/external/)） | ``duplicate `@external` for target `js` `` |
| E0140 | 知らないターゲットの名前（今は js、wasm、c）（[外部関数](/guide/external/)） | ``unknown target `node` `` |
| E0141 | `@external type` の注釈に引数を付けた（[外部関数](/guide/external/)） | ``` `@external` on a type takes no arguments ``` |
| E0142 | match を前置で書いた（[パターンマッチ](/guide/pattern-matching/)） | ``` `match` comes after the value: write `value match { ... }` ``` |
| E0143〜 | 構文のエラー | パーサで割り当てて、この表に足す |

### E02xx と W02xx モジュール、import、プロジェクトの構成

| コード | 内容 | 文面の例 |
|---|---|---|
| E0201 | ファイル名がモジュール名にならない（[モジュール](/guide/modules/)） | ``file name `Foo` cannot be a module name: not lower snake_case`` |
| E0202 | ディレクトリ名がモジュール名にならない | ``directory name `My-Dir` cannot be a module name: not lower snake_case`` |
| E0203 | 予約されたモジュール名（ソースのルート直下の `prelude.emel`、core のモジュールと同じ名前のファイル、`std.emel` と `std/`）（[モジュールと名前の解決](/reference/modules/)） | ``module name `Prelude` is reserved`` |
| E0204 | モジュールの重複（大文字小文字の違いだけのものを含む） | ``duplicate module `Http.Client` `` |
| E0205 | import 先のモジュールがない | ``undefined module `Http.Clinet` `` |
| E0206 | import の循環（自己 import を含む） | ``import cycle: `A` -> `B` -> `A` `` |
| E0207 | ディレクトリを渡したが `Pome.toml` が見つからない | ``no `Pome.toml` found in `proj` or its ancestors`` |
| E0208 | 渡したファイルかディレクトリがソースのルートの外にある（[モジュールと名前の解決](/reference/modules/)、[CLI](/tools/cli/)） | ``file `scripts/x.emel` is outside the source root `src` `` / ``directory `scripts` is outside the source root `src` `` |
| E0209 | エントリが見つからない（build と run のみ） | ``entry `src/main.emel` not found`` |
| E0210 | エントリがモジュールにならない | ``entry `src/Main.emel` is not a module`` |
| E0211 | 未定義の名前 | ``undefined name `usr` `` |
| E0212 | モジュール、Trait、エフェクトに、その名前の項目がない | ``module `Http.Client` has no item `gett` `` |
| E0213 | 同じ名前空間での定義の重複 | ``duplicate definition of `User` `` |
| E0214 | pub でない定義を、他のモジュールから参照した | `` `parse_raw` is private to `Email` `` |
| E0215 | opaque な型を定義モジュールの外で構築した（[モジュール](/guide/modules/)） | ``cannot construct opaque type `Email` outside its module`` |
| E0216 | opaque な型を定義モジュールの外でパターンに書いた（[モジュール](/guide/modules/)） | ``cannot match on opaque type `Email` outside its module`` |
| E0217 | 名前は見つかったが、その位置に書けない種類だった | ``expected an error, found type `User` `` |
| E0218 | `.` の左の名前が、モジュールと Trait の両方を指す | ``ambiguous name `Show`: both a module and a trait`` |
| E0219 | `self` か `Self` を、使えない場所に書いた | `` `self` is only available in handlers, traits, and impls `` |
| E0220 | 1つのパターンか引数の並びで、同じ名前を2回束縛した | `` `x` is bound more than once `` |
| E0221 | 型の位置にエフェクトの名前を書いた。集合でない型引数の位置（`List[Db]`）に書いたときも含む（[型と効果の体系](/reference/type-system/)） | ``effect `Logger` cannot be used as a type`` |
| E0222 | 部分更新の呼び出し先が、構成子1つのもの（type、error、フィールドのある handler）でない（[データ](/guide/data/)） | ``cannot update enum variant `Circle` with `..` `` |
| E0223 | 部分更新で、変えるフィールドを位置で書いた（[データ](/guide/data/)） | ``fields to update must be named: `field: value` `` |
| E0224 | `@intrinsic` を同梱の core のソースの外で使った（[字句と予約語](/reference/lexical/)） | ``` `@intrinsic` can only be used in the bundled core library ``` |
| E0225 | `@intrinsic` を本体のない fn 以外に付けた（[字句と予約語](/reference/lexical/)） | ``` `@intrinsic` can only be used on a function without a body ``` |
| E0226 | `@test` を、引数のある fn、本体のない fn、トップレベルの fn 以外に付けた、または `@test` に引数を付けた（[字句と予約語](/reference/lexical/)） | ``test function `takes` cannot take parameters`` |
| E0227 | テスト関数を、テスト関数でない fn や const から参照した（[テスト](/guide/testing/)） | ``test function `adds` can only be used from test functions`` |
| E0228 | `@internal` の fn を、同梱の core のモジュールの外から参照した（[字句と予約語](/reference/lexical/)） | ``function `Secret.peek` can only be used from the bundled core library`` |
| E0229 | `@internal` を、同梱の core の外か、トップレベルの fn 以外に付けた（[字句と予約語](/reference/lexical/)） | ``` `@internal` can only be used in the bundled core library ``` |
| E0230 | `emela run` のエントリに main がない（[実行時の意味](/reference/semantics/)） | ``entry `src/main.emel` has no `main` function`` |
| E0231 | const が名前だけで循環している（[データ](/guide/data/)） | ``constants refer to each other: `A` -> `B` -> `A` `` |
| E0232 | `Pome.toml` の `[build].target` が知らないターゲット（[Pome](/tools/pome/)） | ``unknown target `node` in `[build].target` `` |
| W0201 | 型名の型引数が、外側の同じ名前の型を隠す（[字句と予約語](/reference/lexical/)） | ``type parameter `Item` shadows type `Item` `` |
| W0202 | モジュールの定義か import が、Prelude の同じ名前を隠す | `` `Some` shadows a Prelude name `` |

### E03xx と W03xx 型

| コード | 内容 | 文面の例 |
|---|---|---|
| E0301 | 型が合わない | ``type mismatch: expected `Int`, found `String` `` |
| E0302 | 無限型 | ``infinite type: `?0` occurs in `List[?0]` `` |
| E0303 | match が網羅していない（[パターンマッチ](/guide/pattern-matching/)） | ``non-exhaustive match: `Rect(_, _)` not covered`` |
| E0304 | 型引数の数が合わない（組み込みの型、type / enum / error、型引数） | ``wrong number of type arguments: `List` takes 1, found 2`` |
| E0305 | 呼び出しの引数の数が合わない（[型と効果の体系](/reference/type-system/)） | ``wrong number of arguments: `connect` takes 2, found 3`` |
| E0306 | その名前の引数がない。引数名を持たない関数値を名前付き引数で呼んだときも含む（[型と効果の体系](/reference/type-system/)） | ``no parameter named `prot` in `connect` `` |
| E0307 | 同じ引数を2回渡した。位置引数と名前付き引数で同じ仮引数を指したときも含む（[型と効果の体系](/reference/type-system/)） | ``argument `port` given more than once`` |
| E0308 | 名前付きフィールドの構成子のパターンで、`..` を書かずにフィールドを省いた（[パターンマッチ](/guide/pattern-matching/)） | ``pattern `User` does not mention fields `id`, `email` `` |
| E0309 | 構成子のパターンのフィールドの数が合わない（多すぎる、または `..` なしで足りない）（[型と効果の体系](/reference/type-system/)） | ``pattern `Rect` has 2 fields, found 1`` |
| E0310 | 数値が来るはずの位置に数値でない型（算術演算子、単項マイナス）（[型と効果の体系](/reference/type-system/)） | ``expected a number (`Int`, `Int64` or `Float`), found `String` `` |
| E0311 | 整数リテラルが型の範囲を超えた（[字句と予約語](/reference/lexical/)） | ``integer literal `3000000000` is out of range for `Int` `` |
| E0312 | その名前のフィールドがない | ``no field `nmae` on type `User` `` |
| E0313 | フィールドを持たない型のフィールドを参照した | ``type `Int` has no fields`` |
| E0314 | 型が決まらない値のフィールドを参照した | ``the type of this value must be known to access field `name` `` |
| E0315 | opaque な型のフィールドを定義モジュールの外で参照した（[モジュール](/guide/modules/)） | ``cannot access field `value` of opaque type `Email` outside its module`` |
| E0316 | トップレベルの fn の引数に型がない（[関数](/guide/functions/)） | ``parameter `x` of a top-level function needs a type`` |
| E0317 | 束縛のパターンが必ずは成功しない（[パターンマッチ](/guide/pattern-matching/)） | ``refutable pattern in binding: `None` not covered`` |
| E0318 | 本体のエラーが宣言の E に含まれない（`-> T` の未処理のエラー、`fails` にないエラー、const の値の失敗）（[エラー](/guide/errors/)） | ``unhandled error `NotFound` `` / ``error `DbError` is not declared in `fails` `` |
| E0319 | エラーの型でない値を `fail` に渡した。1つのエラーの型の型引数をエラーでない型で具体化した（[エラー](/guide/errors/)） | ``expected an error value, found `Int` `` |
| E0320 | escape の腕のパターンがエラーの構成子でない（[エラー](/guide/errors/)） | `escape arms must match an error constructor` |
| E0321 | 関数の値の E が、期待する関数型の E に含まれない（[型と効果の体系](/reference/type-system/)） | ``error set mismatch: expected `fails {}`, found `fails Timeout` `` |
| E0322 | 効果の集合でない型引数に Immediate を付けた（[型と効果の体系](/reference/type-system/)） | `` `Immediate` can only constrain effect sets, but `A` is not used in `use` `` |
| E0323 | 名前付き型の集合の型引数に、その種類のタグか集合の型引数でないものを書いた（[型と効果の体系](/reference/type-system/)） | `` `E` of `Handler` is an error set, found type `Int` `` |
| E0324 | 集合でない型引数の位置に集合を書いた（[型と効果の体系](/reference/type-system/)） | `expected a type, found a set: sets can only be passed to set type parameters` |
| W0301 | 冗長な腕（[パターンマッチ](/guide/pattern-matching/)） | `unreachable match arm` |
| W0302 | escape の腕が受けるエラーが、元の式から起きない（[型と効果の体系](/reference/type-system/)） | ``error `Timeout` is never raised here`` |

### E04xx と W04xx effect、handler、layer、capture set

| コード | 内容 | 文面の例 |
|---|---|---|
| E0401 | 能力の値のエフェクトにその操作がない（[型と効果の体系](/reference/type-system/)） | ``effect `Logger` has no operation `infoo` `` |
| E0402 | 本体の R が、宣言や文脈の許す R に含まれない（use 節、const、main、テスト関数）（[エフェクト](/guide/effects/)、[型と効果の体系](/reference/type-system/)、[テスト](/guide/testing/)） | ``effect `Logger` is not declared in `use` `` / ``effect `Clock` is not provided in `main` `` |
| E0403 | 関数の値の R が、期待する関数型の R に含まれない | ``effect set mismatch: expected `use {}`, found `use Logger` `` |
| E0404 | handler が操作を全部は実装していない（[エフェクト](/guide/effects/)） | ``handler `Half` does not implement operation `warn` `` |
| E0405 | handler が同じ操作を2回実装した（[エフェクト](/guide/effects/)） | ``operation `info` is implemented more than once`` |
| E0406 | handler の操作の引数の数が宣言と違う（[型と効果の体系](/reference/type-system/)） | ``wrong number of parameters: operation `info` takes 1, found 2`` |
| E0407 | use を省略した `@external` の fn か `@external suspend fn` を、ハンドラの外で使った（[外部関数](/guide/external/)） | ``external function `console_log` can only be used in handlers`` |
| E0408 | 能力の値を引数に渡した（[エフェクト](/guide/effects/)） | `a capability cannot be passed as an argument` |
| E0409 | 能力の値をデータ構造に入れた（[エフェクト](/guide/effects/)） | `a capability cannot be stored in a data structure` |
| E0410 | 能力の値を関数から返した（[エフェクト](/guide/effects/)） | `a capability cannot be returned from a function` |
| E0411 | 同じ with のハンドラの依存が循環している（[型と効果の体系](/reference/type-system/)） | ``handlers depend on each other: `Stamped` -> `Ticking` -> `Stamped` `` |
| E0412 | エントリからたどれる外部関数に、ビルド対象のターゲットの `@external` がない（[外部関数](/guide/external/)） | ``external function `wasm_now` has no `@external` for target `js` `` |
| E0413 | Async か Scope のハンドラを書いた（[中断](/guide/suspend/)、[型と効果の体系](/reference/type-system/)） | ``handler `Runtime` cannot implement `Async`: only the runtime provides it`` / ``handler `MyScope` cannot implement `Scope`: only `Fiber.scope` provides it`` |
| E0414 | `use Async` を書いた（[中断](/guide/suspend/)） | `` `Async` has no operations and cannot be used with `use` `` |
| E0415 | ハンドラの操作の suspend の有無が、エフェクトの宣言と違う（[中断](/guide/suspend/)） | ``operation `now` is not a `suspend fn` in effect `Clock` `` |
| E0416 | Immediate を求める効果の集合が Immediate でない（[型と効果の体系](/reference/type-system/)） | ``effect `Clock` may suspend, but `R` of `update` must be `Immediate` `` |
| E0417 | fn の操作（suspend fn でないもの）の実装の本体の R が Immediate でなく、中断しうる呼び出しを含む（[中断](/guide/suspend/)、[型と効果の体系](/reference/type-system/)） | ``calling `stamp` may suspend because it uses effect `Clock`, but operation `now` is not a `suspend fn` `` |
| E0418 | ハンドラの値を、そのハンドラの init の外で作った（[リソース](/guide/resources/)） | ``handler `Counter` can only be constructed in its own `init` `` |
| E0419 | フィールドのあるハンドラに init がない（[リソース](/guide/resources/)） | ``handler `NoInit` has fields but no `init` `` |
| E0420 | release が失敗しうる（[リソース](/guide/resources/)） | ``` `release` of handler `Counter` cannot fail, but this may fail with error `Boom` ``` |
| E0421 | layer の中で同じエフェクトを2つのハンドラが供給する。layer の宣言で1回だけ報告する（[型と効果の体系](/reference/type-system/)） | ``effect `Logger` is provided by both `Counter` and `Quiet` in layer `Loud` `` |
| E0422 | layer が互いを含む。layer の宣言で1回だけ報告する（[型と効果の体系](/reference/type-system/)） | ``layers include each other: `LoopA` -> `LoopB` -> `LoopA` `` |
| E0423 | 型引数のあるエフェクトの型引数を書いていない（`use State`、use 節、`implements State`）（[エフェクト](/guide/effects/)） | ``missing type arguments for effect `State[S]` `` |
| E0424 | エフェクトの型引数を集合として使った（組み込みのエフェクトは除く。[型と効果の体系](/reference/type-system/)） | ``type parameter `E` of effect `Raise` is used as a set, but effect type parameters must be ordinary types`` |
| E0425 | `Fiber.scope` の値の型に `Fiber` か `Deferred` が含まれる（[並行性](/guide/concurrency/)） | ``a `Fiber` cannot leave the `Fiber.scope` that started it`` |
| E0426 | 利用者のエフェクトの操作に型引数を書いた（[型と効果の体系](/reference/type-system/)） | ``operation `wrap` cannot have type parameters: only built-in effects may declare them`` |
| E0427 | ビルド対象が `c` で、エントリからたどれる外部関数がコールバックを取るか返す（[外部関数](/guide/external/)） | ``external function `on_data` takes a callback, which target `c` does not support yet`` |
| E0428 | （欠番。C の suspend fn の外部関数を完了を後から知らせる形で認めたため） | — |
| E0429 | ラベルの元のエフェクトがラベルか組み込みのエフェクト（[ラベル](/guide/labels/)） | ``label `Nested` cannot stand for `Audit`: `Audit` is a label`` |
| E0430 | ラベルでないエフェクトを with に書いた、`by` の左に書いた（[ラベル](/guide/labels/)） | ``effect `Log` is not a label: `with` takes a handler, a layer or a label`` |
| E0431 | `by` の右が、ラベルの元のエフェクトと別のエフェクトを担う（[ラベル](/guide/labels/)） | ``label `Audit` stands for `Log`, but `OtherH` provides `Other` `` |
| E0432 | 同じ with で同じラベルに2回 `by` を書いた（[型と効果の体系](/reference/type-system/)） | ``label `Audit` is given a provider more than once in this `with` `` |
| E0433 | ラベルのハンドラを書いた（[ラベル](/guide/labels/)） | ``handler `AuditH` cannot implement label `Audit` `` |
| W0401 | with のラベルの項目が使われない（[型と効果の体系](/reference/type-system/)） | ``label `Audit` is listed here but never used`` |

### E09xx ツール

| コード | 内容 | 文面の例 |
|---|---|---|
| E0901 | パスが見つからない | ``path `app` not found`` |
| E0902 | ファイルかディレクトリを読めない | ``cannot read `src/a.emel`: permission denied`` |
| E0903 | 出力を書き込めない | ``cannot write `target/emela/js/main.mjs` `` |
| E0904 | node が見つからない、起動できない | ``cannot start `node` `` |
| E0905 | JS の出力がまだない（0.20 の途中の段だけ） | `JS backend is not available yet` |
| E0906 | JS の出力段が不正な出力を返した（処理系の内部の誤り） | `invalid output from the JS backend` |
| E0907 | cc が見つからない、起動できない（[CLI](/tools/cli/)） | ``cannot start `cc` `` |
| E0908 | 出力した C のコンパイルに失敗した（処理系かホストの C の誤り） | `` `cc` failed to compile `target/emela/c/main.c` `` |
