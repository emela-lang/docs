---
title: ターゲット
description: JS・WASM・native の Tier と出力、実行に要るもの、数値と文字列の規定、末尾呼び出し、外部関数の境界、規定しない点
---

:::note[規範は仕様]
このページは仕様の [16 章 ターゲット](https://github.com/emela-lang/emela/blob/main/spec/targets/16-targets.md) と、[JS](https://github.com/emela-lang/emela/blob/main/spec/targets/js.md)、[native](https://github.com/emela-lang/emela/blob/main/spec/targets/native.md)、[WASM](https://github.com/emela-lang/emela/blob/main/spec/targets/wasm.md) の各節を日本語でまとめたものです。規範となるのは英語の [仕様](https://github.com/emela-lang/emela/tree/main/spec) で、食い違うときは仕様に従います。
:::

同じ Emela のプログラムはどのターゲットでも同じ観測可能な結果を返さなければなりません。そのため数値と文字列の意味をターゲットから独立に定めています。

## ターゲットと Tier

ターゲットは JS、WASM、native の3つです。

| ターゲット | Tier | 出力 | 実行に要るもの |
|---|---|---|---|
| `js` | 1 | ES モジュールの `main.mjs` とランタイム | Node.js 22 以降か Bun 1.4.3 以降 |
| `wasm` | 1 | WASI 0.3 のコンポーネント `main.wasm` 1つ | Wasmtime 49 以降 |
| `native` | 2 | このマシン向けの実行ファイル `main`。C を出力し、このマシンの C コンパイラでコンパイルする | C11 のコンパイラと、POSIX の C ヘッダとライブラリ |

Tier 2 のターゲットは、意味が Tier 1 と同じで、このページの規定をすべて満たし、同じテストスイートを通すことを条件にします。新しい機能は Tier 1 より遅れて入ってかまいません。

```sh
emela run main.emel                   # 既定は js
emela run --target wasm main.emel     # main.wasm を書いて wasmtime で動かす
emela run --target native main.emel   # cc で実行ファイルを作って動かす
```

`--target` を省くと、`Pome.toml` の `[build].target`、それもなければ `js` になります（[emela コマンド](/tools/cli/)）。`emela doctor` は、各ターゲットが使うプログラムがあり、版が足りているかを確かめます。

`c` は `native` の古い名前です。`--target c`、`[build].target = "c"`、`[pome].targets` の `"c"` は `native` を選び、警告 W0903 を出します。0.29 で知らないターゲットになります。

### 対象のホスト

- JS のターゲットはサーバーで動くホストを前提にします。Node.js 22 以降か Bun 1.4.3 以降です。`emela run` と `emela test` が起動するホストは環境変数 `EMELA_JS_HOST` で選びます。
- ブラウザはターゲットではありません。platform のハンドラ（[プラットフォーム](/std/platform/)）は、ブラウザでの動きを規定しません。
- WASM のターゲットは WASI 0.3 のコンポーネントを出力し、`wasmtime run -S p3=y main.wasm` で動かします。外部のツールチェーンは使いません。
- native のターゲットは、コンパイラを動かしているマシン向けにだけビルドします。ほかの OS や CPU 向けのクロスビルドはしません。対象は macOS（arm64）と glibc の Linux（x86_64）です。ほかの POSIX のシステムでも動くことはありますが、試験はしていません。Windows は対象外です。

### 出力先

| ターゲット | `build` と `run` | `test` | 書き出すもの |
|---|---|---|---|
| `js` | `target/emela/js` | `target/emela/test` | `main.mjs`、`emela_runtime.mjs`、`@external` が指すファイルを写した `emela_core/`、`emela_project/`、`emela_tests/`、`emela_pomes/`。HTTP サービスでは `serve.mjs` も |
| `wasm` | `target/emela/wasm` | `target/emela/test-wasm` | `main.wasm` だけ。ランタイムも同じコンポーネントに入る |
| `native` | `target/emela/native` | `target/emela/test-native` | 実行ファイル `main` と、ホストの C から読むヘッダ `emela.h`。ほかに出力した C などを置くが、名前と中身は規定しない |

### ターゲットごとに使えないもの

JS と WASM は、言語のすべての構文を出力できます。違いはホストとつなぐ部分にあります。

| ターゲット | まだ使えないもの | 出る診断 |
|---|---|---|
| `wasm` | 利用者が書いた `@external(wasm, ...)` と `@export(wasm, ...)` | コードのないコンパイル時のエラー |
| `wasm` | 標準入力（`SystemStdin`） | エントリからたどれると E0412 |
| `native` | `String.length`、`String.chars`、区切りが空文字列の定数の `String.split`（書記素クラスタの表が要る） | コードのないコンパイル時のエラー |
| `native` | 区切りが実行時に空文字列になる `String.split` を、ASCII でない文字列に使う | 実行時の defect |
| `native` | コールバックを取るか返す外部関数 | E0427 |
| `native` | 境界の型に `Bytes` か `Array` を含む外部関数と export | E0443 |
| `native` | HTTP サービス（`@entry(Http.serve)`） | E0442 |
| `native` | 中断しうる export の fn | E0441 |
| `native`、`wasm` | `Std.Http` のクライアント（`SystemHttp` は JS にだけ実装がある） | E0412 |

:::caution[仕様と 0.28.1 の違い]
仕様の `[target.wasm.external]` は、`SystemClock.sleep` と `Std.FileSystem` も WASM ではまだ使えないとしています。emela 0.28.1 ではどちらも動きます。`emela run --target wasm` はプロジェクトのディレクトリを `wasmtime run --dir` で渡します。
:::

検査するのはエントリからたどれる関数だけです。たどれない関数に使えないものが含まれていても、コンパイル時のエラーにはなりません。`with Platform` と書いても、`Http` を実際に使わなければ native と WASM でビルドできます。

## 数値

| 項目 | 規定 |
|---|---|
| Int の範囲 | -2,147,483,648 から 2,147,483,647 |
| Int64 の範囲 | -2^63 から 2^63 - 1 |
| 整数のあふれ | 2の補数で巻き戻る。defect にはならない |
| 整数の除算 | 0の方向へ切り捨てる。剰余の符号は被除数に従う |
| 整数のゼロ除算 | defect |
| Float | IEEE 754 binary64。ゼロ除算は IEEE のとおり無限大か NaN になる。`%` は fmod（被除数の符号） |
| 型の変換 | 暗黙には変換しない。`Int64.from_int` のような関数で明示する |
| Float から Int への変換 | `Float.floor`、`ceil`、`round`、`truncate` で明示する。結果が Int の範囲外か、`NaN`、±`Infinity` なら defect（巻き戻しも飽和もしない）。`Float.round` は 0.5 を 0 から遠い方へ丸める（`2.5` は 3、`-2.5` は -3） |
| Int64 から Int への変換 | `Int64.to_int` は下位32ビットに巻き戻す |
| ビットシフト | シフト量は Int64 の版でも Int。負なら defect。型の幅（32 か 64）以上なら全部のビットを押し出した値にし、幅で剰余を取らない |
| Float の等価 | IEEE 754 の比較に従う。`NaN` は自分自身とも等しくなく、`0.0 == -0.0` |
| 数値の表示（Show） | Float は往復できる最短の桁数で表す。有限の整数値には `.0` を付け、それ以外は `1e+21`、`-2.5e-8`、`Infinity`、`NaN` の形。Int64 に接尾辞は付けない |

```emela check
fn main() {
  max = 2147483647
  dbg(max + 1) # -2147483648
  dbg(-7 / 2) # -3
  dbg(-7 % 2) # -1
  dbg(1.0 / 0.0) # Infinity
  dbg(-7.5 % 2.0) # -1.5
  dbg(Float.round(2.5)) # 3
  dbg(Float.round(-2.5)) # -3
  dbg(Int.checked_add(max, 1)) # None
  dbg((0 - max - 1) / -1) # -2147483648
  big: Int64 = 4294967297
  dbg(Int64.to_int(big)) # 1
  ()
}
```

JS、WASM、native のどれで動かしても、コメントのとおりの値が出ます。

- あふれを検出したいときは、`Int.checked_add` のような関数を使います。
- 最小値を -1 で割ったとき（`-2147483648 / -1`）も、あふれとして巻き戻ります。

### 比較の関数

- `Float.compare` と、Int、Int64、Float の `min` と `max` は、全順序で比べます。Float では、この順序は演算子の `<` と違います。
- `Float.compare` は NaN を一番大きい値とし、NaN どうしは Equal、`0.0` と `-0.0` も Equal とします。
- `min` と `max` はこの順序で選び、等しいときは第1引数を返します。NaN が一番大きいので、片方だけが NaN のとき `Float.min` はもう片方を、`Float.max` は NaN を返します。
- `abs` は最小値で巻き戻って最小値を返します。

```emela check
fn main() {
  nan = 0.0 / 0.0
  dbg(Float.compare(nan, 1.0)) # Greater
  dbg(Float.compare(0.0, -0.0)) # Equal
  dbg(Float.min(nan, 1.0)) # 1.0
  dbg(Float.max(nan, 1.0)) # NaN
  dbg(Int.abs(-2147483647 - 1)) # -2147483648
  dbg(nan == nan) # False
  ()
}
```

## 文字列

- String は Unicode のスカラー値（サロゲートを除くコードポイント）の列で、内部の符号化は観測できません。サロゲートや不正な並びを含む String はありません。ホストから受け取る値は境界で正規化します。
- 位置を数値で指定する API は持ちません。文字列をたどるときは `String.chars` や `String.split` などの関数を使います。
- `String.length` は見た目の文字数（書記素クラスタの数）を返します。`String.length("👍")` は 1 です。
- 文字の型は持ちません。1文字は長さ1の String です。コードポイントを扱うときは `String.code_points(s) -> List[Int]` と `String.from_code_point(n) -> Option[String]` を使います。
- 書記素クラスタの境界は Unicode の版によって変わります。JS と WASM で結果をそろえるために、使う Unicode の版を固定します。どの版にするかは未決です。今の JS の出力はホストの `Intl.Segmenter` で境界を決めるので、ホストの Unicode の版に従います。
- バイト数が要るときは `String.byte_size` を使います。UTF-8 で符号化したときのバイト数を返します。
- 文字列の大小比較はコードポイントの辞書順です。
- `String.split(s, "")` は書記素クラスタごとに分けます（`String.chars` と同じ）。`String.split("", "")` は `[]`、`String.split("", ",")` は `[""]` です。
- `String.contains`、`starts_with`、`ends_with`、`split` の照合はコードポイントの列で見て、書記素の境界は見ません。
- `String.from_code_point(n)` は、`n` が Unicode のスカラー値（0〜10FFFF でサロゲートを除く）でなければ `None` を返します。
- `String.trim` が取り除く空白は、Unicode の White_Space 特性の25文字で、表は固定します（U+FEFF と U+200B は含めません）。

```emela check
fn main() {
  dbg(String.length("👍")) # 1
  dbg(String.byte_size("é")) # 2
  dbg(String.code_points("é")) # [233]
  dbg(String.from_code_point(55296)) # None（サロゲート）
  dbg(String.split("", ",")) # [""]
  ()
}
```

## 末尾呼び出し

自分自身への末尾呼び出しがスタックを消費しないことを、すべてのターゲットで保証します。suspend な操作を含む関数でも、局所関数でも同じです。それ以外の再帰の深さの上限は、実装依存です。

末尾位置は次のとおりです。

- 関数の本体のブロックの最後の式
- 末尾位置にある if の両方の分岐、match の各腕の本体、ブロックの最後の式
- 末尾位置にある `&&` と `||` の右辺（`a && b` は `if a { b } else { False }`、`a || b` は `if a { True } else { b }` と同じ）

次の中は末尾位置ではありません。

- 無名関数の本体と局所関数の本体（外側の関数から見た位置として。そこで外側の関数を呼んでも、自分自身への呼び出しにならない）
- `escape` の対象の式（escape の腕が後に走りうる）
- `with` の本体（ハンドラの release が後に走る）

相互再帰の末尾呼び出しは保証しません。仕様では、コンパイラが相互再帰の末尾呼び出しを検出して警告し、escape の対象と with の本体の中の、末尾呼び出しに見える自分自身への呼び出しには linter が「保証されない」と警告します。

:::caution[0.28.1 との違い]
emela 0.28.1 は、相互再帰の末尾呼び出しにまだ警告を出しません。
:::

```emela check
fn count(n: Int, acc: Int) -> Int {
  if n == 0 { acc } else { count(n - 1, acc + 1) }
}

fn main() {
  dbg(count(1_000_000, 0)) # どのターゲットでも 1000000
  ()
}
```

## 外部関数の境界

外部関数の宣言と書き方は [外部関数](/guide/external/) にあります。`@external` の言語は、ビルドするターゲットで決まります。

| ターゲット | `@external` の言語 |
|---|---|
| `js` | `js` |
| `wasm` | `wasm` |
| `native` | `c` |

ビルドするターゲットの言語の注釈がない外部関数は、エントリからたどれるときだけエラーになります（E0412）。

- ハンドラを with に書くと、その init と release から呼ぶ fn がたどれる側に入ります。操作の本体から呼ぶ fn は、その操作がどこかで呼ばれるか値として使われるときだけ入ります。
- ライブラリだけのプロジェクトでは、エントリの代わりに公開関数からたどれる外部関数を検査します。
- この検査は `build`、`run`、`test` でします。`emela check` と言語サーバーはターゲットを決めないので検査しません。
- たどれないのに出力された外部関数に注釈がなければ、呼ばれたときに defect（``external function `f` is not available on this target``）になります。

### JS

- 境界の値の表現は次のとおりです。Int は number、Int64 は bigint、Float は number、Bool は boolean、String は string、Bytes は `Uint8Array`、`Array[A]` は JS の `Array`、`()` は `undefined`、`@external type` はホストのオブジェクトそのもの、関数型は JS の関数です。
- Bytes が来るはずの位置の値は `instanceof Uint8Array` を満たさなければなりません（Node.js の `Buffer` はよい）。Array が来るはずの位置の値は `Array.isArray` を満たさなければなりません。満たさなければ defect です。
- JS から受け取った文字列に対になっていないサロゲートが含まれるときは、境界で置換文字（U+FFFD）に直します。
- 外部関数が投げた例外は defect です。
- suspend fn の外部関数が Promise でない値を返したときは、解決した値として扱います。
- ランタイムは suspend fn の外部関数の最後の引数に `AbortSignal` を足して渡し、待っている fiber が中断されると abort します。止めないと、結果を捨てても通信やタイマーが残り、プロセスが終わりません。
- suspend fn の操作の実装の中で外部関数を待っているときも、resume の前に呼び出し元が中断されれば、実装を巻き戻して abort します。
- `@export(js, "name")` の fn は `main.mjs` の名前付き export になります。中断しうる fn は Promise を返します。

### native（C）

| Emela の型 | C の引数 | C の戻り値 |
|---|---|---|
| Int | `int32_t` | `int32_t` |
| Int64 | `int64_t` | `int64_t` |
| Float | `double` | `double` |
| Bool | `bool` | `bool` |
| String | `const char *`（NUL 終端の UTF-8） | `char *`（`malloc` で確保した NUL 終端） |
| `()` | 引数にならない | `void` |
| `@external type` | `void *` | `void *` |

- C に渡す文字列はランタイムのもので、ホストは書き換えも解放もしません。ポインタは関数が戻るまでだけ有効です。U+0000 を含む文字列は、渡す前に defect になります。
- C から受け取った String は写してから `free` します。UTF-8 として正しくない並びは置換文字に直します。NULL が返ったら defect です。
- 表にない C の型（`size_t`、`int` など）は、C の側に小さな変換の関数を書いて表の型にします。整数の幅をコンパイラは推し量りません。
- C には例外がありません。失敗はホスト側から値で返し、ハンドラの中で fail にします。C の関数が `abort` したりシグナルで止まったりすると、defect ではなくプロセスが終わります（終了コードは 128 + シグナル番号）。
- C コンパイラは環境変数 `EMELA_CC`、なければ PATH の `cc` です。追加のフラグは `EMELA_CC_ARGS` に書きます。
- `emela.h` の形はほかの API と同じく版によって変わることがあります。

native の suspend fn の外部関数は、引数の後ろに `em_task *task` を受け取って `void` を返し、完了を後から関数で知らせます。

- 完了の関数は `em_complete_int`、`em_complete_int64`、`em_complete_float`、`em_complete_bool`、`em_complete_string`（`malloc` で確保した NUL 終端の UTF-8 を渡す）、`em_complete_unit`、`em_complete_handle`（`@external type`）です。
- ホスト側の誤りは `em_complete_defect(task, message)` で知らせます。待っている fiber で defect になります。
- 完了の関数は各 `task` にちょうど1回呼びます。2回目は defect です。
- 完了の関数はどのスレッドからも呼べます。ほかの `em_` の関数は、ランタイムのスレッド（外部関数の中と、ランタイムが呼ぶコールバックの中）からだけ呼べます。
- 待ちの登録は `em_after(ms, task, callback, ctx)`、`em_on_readable(fd, task, callback, ctx)`、`em_on_writable(fd, task, callback, ctx)` です。中断の知らせは `em_on_cancel(task, callback, ctx)` で受けます。
- 待っている fiber が中断された後も、C の側は完了の関数をちょうど1回呼びます（値は捨てられます）。
- 別のスレッドに task を渡すホストの関数は、自分で待ちを登録してイベントループを待たせておきます。別のスレッドが持つ task だけでは、起動が止まったとみなされます。

## 規定しない点

次の点は実装依存で、プログラムが依存してはいけません。

- 値のメモリ上の表現と、解放のタイミング
- Trait の実装方式（辞書渡しか、型ごとの複製か）
- 継続の実装方式
- 実行可能な fiber が複数あるときの実行順序
- 必要なメモリを得られなかったプログラムの結果（defect になるか、release が走るか、`Exit.attempt` で観測できるか、何を出力するか、終了コード）

## 参考: 想定する実装方式

この節は規定ではありません。

| 項目 | JS | WASM | native |
|---|---|---|---|
| 純粋な関数 | 普通の関数 | 普通の関数 | 普通の関数 |
| fn の操作 | ハンドラを引数で渡して直接呼ぶ | 同じ | 同じ |
| suspend fn に到達する関数 | ジェネレータに変換する | ステートマシンに変換する。Stack Switching が使えるようになれば差し替える | ステートマシンに変換する（WASM と同じ低い IR から出す） |
| 多相な R の関数（`List.map` の `R(f)`） | 元の関数は中断しない出力のままにし、中断しうる関数を渡す呼び出しのために「中断用の写し」（`List.map$suspend8`）を別に出力する（特殊化） | ジェネリクスと一緒に単相化する | 同じ |
| Async | ハンドラの値を持たないので、証拠の表に載せない。R が Async だけの main とテスト関数は引数なしで呼ぶ | 同じ | 同じ |
| エラー | 戻り値として返す | 同じ | 同じ |
| defect | 専用クラスの例外 | 戻り値で明示的に伝える（例外を使わない） | 同じ |
| メモリ管理 | ホストの GC | 線形メモリ上の参照カウント（Perceus 方式） | 参照カウント（Perceus 方式） |
| `Array.set` | 写す | 引数の参照カウントが1ならその場で書き換える | WASM と同じ |
| ランタイム | コンパイラが出力先に書き出す | 出力するコンポーネントにリンクする | C のソースとして出力と一緒にコンパイルする |
