---
title: ターゲット
description: JS・WASM・C の Tier と対象のホスト、数値と文字列の規定、末尾呼び出し、規定しない点
---

同じ Emela のプログラムは、どのターゲットでも同じ観測可能な結果を返さなければなりません。そのために、数値と文字列の意味をターゲットから独立に定めています。

## ターゲットと Tier

ターゲットは JS、WASM、C の3つです。

| ターゲット | Tier | 出力 |
|---|---|---|
| JS | 1 | JavaScript のモジュール（`main.mjs`）とランタイム |
| WASM | 1 | WebAssembly のモジュール |
| C | 2 | C のソース。cc でコンパイルして native の実行ファイルを作る |

- Tier 2 のターゲットは、意味は Tier 1 と同じで、このページの規定をすべて満たし、同じテストスイートを通すことを条件にします。ただし、新しい機能が Tier 1 より遅れて入って構いません。

```sh
emela run --target js main.emel    # 既定
emela run --target c main.emel     # cc で実行ファイルを作って動かす
```

`--target` を省くと、`Pome.toml` の `[build].target`、それもなければ `js` になります（[CLI](/tools/cli/)）。

:::caution[今の実装で使えるターゲット]
今のコンパイラの `--target` は `js` と `c` だけです。WASM の出力はまだなく、`--target wasm` は引数の誤りになります。

C のターゲットには、次の制限があります。

- `String.length`、`String.chars`、区切りが空文字列の定数の `String.split` は、書記素クラスタの表がまだないので、コンパイル時のエラーになる
- コールバックを取るか返す外部関数は使えない（E0427）
:::

### 対象のホスト

- JS のターゲットは、サーバーで動くホストを前提にします。Node 18 以降と、`node:` のモジュールと `fetch` を持つ Deno、Bun です。
- ブラウザは 0.20 の対象にしません。platform のハンドラ（[プラットフォーム](/std/platform/)）は、ブラウザでの動きを規定しません。
- C のターゲットの対象は macOS（arm64）と Linux（x86_64）で、C11 のコンパイラを前提にします。cc は、環境変数 `EMELA_CC` があればそれを、なければ PATH の `cc` を使います。Windows は後の版に回します。
- 外部関数の型を C の型にどう写すかは、[外部関数](/guide/external/) の対応表にあります。

## 数値

| 項目 | 規定 |
|---|---|
| Int の範囲 | -2,147,483,648 から 2,147,483,647 |
| Int64 の範囲 | -2^63 から 2^63 - 1 |
| 整数のあふれ | 2の補数で巻き戻る。defect にはならない |
| 整数の除算 | 0の方向へ切り捨てる。剰余の符号は被除数に従う |
| 整数のゼロ除算 | defect |
| Float | IEEE 754 binary64。ゼロ除算は IEEE のとおり無限大か NaN になる。`%` は fmod（被除数の符号） |
| 型の変換 | 暗黙には行わない。`Int64.from_int` のような関数で明示する |
| Float から Int への変換 | `Float.floor`、`ceil`、`round`、`truncate` で明示する。結果が Int の範囲外か、`NaN`、±`Infinity` なら defect（巻き戻しも飽和もしない）。`Float.round` は 0.5 を 0 から遠い方へ丸める（`2.5` は 3、`-2.5` は -3） |
| Int64 から Int への変換 | `Int64.to_int` は下位32ビットに巻き戻す |

```emela check
fn main() {
  max = 2147483647
  dbg(max + 1)                     # -2147483648
  dbg(-7 / 2)                      # -3
  dbg(-7 % 2)                      # -1
  dbg(1.0 / 0.0)                   # Infinity
  dbg(-7.5 % 2.0)                  # -1.5
  dbg(Float.round(2.5))            # 3
  dbg(Float.round(-2.5))           # -3
  dbg(Int.checked_add(max, 1))     # None
  dbg((0 - max - 1) / -1)          # -2147483648
  big: Int64 = 4294967297
  dbg(Int64.to_int(big))           # 1
  ()
}
```

JS と C のどちらで動かしても、コメントのとおりの値が出ます。

- あふれを検出したいときは、`Int.checked_add` のような関数を使います。
- 最小値を -1 で割ったとき（`-2147483648 / -1`）も、あふれとして巻き戻ります。

### 比較の関数

- 比較の関数（`Int.compare`、`Float.compare` など）と、その上の `min`、`max` は、演算子の `<` と違い全順序で比べます。
- `Float.compare` は NaN を一番大きい値とし、NaN どうしは Equal、`0.0` と `-0.0` も Equal とします。
- `min` と `max` は、同じ値なら第1引数を返し、NaN を伝えません（`Float.min(NaN, 1.0)` は `1.0`。JS の `Math.min` とは違います）。
- `abs` は最小値で巻き戻って最小値を返します。

:::caution[0.21 で入る予定]
数値の `compare`、`min`、`max`、`abs` は、同梱の core にまだありません。
:::

## 文字列

- String は Unicode 文字の列で、内部の符号化は観測できません。
- 位置を数値で指定する API は持ちません。文字列をたどるときは `String.chars` や `String.split` などの関数を使います。
- `String.length` は見た目の文字数（書記素クラスタの数）を返します。`String.length("👍")` は 1 です。
- 文字の型は持ちません。1文字は長さ1の String です。コードポイントを扱うときは `String.code_points(s) -> List[Int]` と `String.from_code_point(n) -> Option[String]` を使います。
- 書記素クラスタの境界は Unicode の版によって変わります。ターゲットの間で結果をそろえるために、使う Unicode の版を固定します。どの版にするかは未決です。
- バイト数が要るときは `String.byte_size` を使います。UTF-8 で符号化したときのバイト数を返します。
- 文字列の大小比較は、コードポイントの辞書順です。
- `String.split(s, "")` は書記素クラスタごとに分けます（`String.chars` と同じ）。`String.split("", "")` は `[]`、`String.split("", ",")` は `[""]` です。
- `String.contains`、`starts_with`、`ends_with`、`split` の照合はコードポイントの列で行い、書記素の境界は見ません。
- `String.from_code_point(n)` は、`n` が Unicode のスカラー値（0〜10FFFF でサロゲートを除く）でなければ `None` を返します。
- `String.trim` が取り除く空白は、Unicode の White_Space 特性の25文字で、表は固定します（U+FEFF と U+200B は含めません）。

```emela check
fn main() {
  dbg(String.length("👍"))             # 1
  dbg(String.byte_size("é"))           # 2
  dbg(String.code_points("é"))         # [233]
  dbg(String.from_code_point(55296))   # None（サロゲート）
  dbg(String.split("", ","))           # [""]
}
```

## 末尾呼び出し

自分自身への末尾呼び出しがスタックを消費しないことを、すべてのターゲットで保証します。suspend な操作を含む関数でも同じです。それ以外の再帰の深さの上限は、実装依存です。

末尾位置は次のとおりです。

- 関数の本体のブロックの最後の式
- 末尾位置にある if の両方の分岐、match の各腕の本体、ブロックの最後の式
- 末尾位置にある `&&` と `||` の右辺（`a && b` は `if a { b } else { False }`、`a || b` は `if a { True } else { b }` と同じ）

次の中は末尾位置ではありません。

- 無名関数の本体（自分自身への呼び出しにならない）
- `escape` の対象の式（escape の腕が後に走りうる）
- `with` の本体（ハンドラの release が後に走る）

相互再帰の末尾呼び出しは保証しません。

```emela check
fn count(n: Int, acc: Int) -> Int {
  if n == 0 { acc } else { count(n - 1, acc + 1) }
}

fn main() {
  dbg(count(1_000_000, 0))    # JS でも C でも 1000000
}
```

## 規定しない点

次の点は実装依存で、プログラムが依存してはいけません。

- 値のメモリ上の表現と、解放のタイミング
- Trait の実装方式（辞書渡しか、型ごとの複製か）
- 継続の実装方式
- 実行可能な fiber が複数あるときの実行順序

## 参考: 想定する実装方式

この節は規定ではありません。

| 項目 | JS | WASM | C |
|---|---|---|---|
| 純粋な関数 | 普通の関数 | 普通の関数 | 普通の関数 |
| fn の操作 | ハンドラを引数で渡して直接呼ぶ | 同じ | 同じ |
| suspend fn に到達する関数 | ジェネレータに変換する | ステートマシンに変換する。Stack Switching が使えるようになれば差し替える | ステートマシンに変換する（WASM と同じ低い IR から出す） |
| 多相な R の関数（`List.map` の `R(f)`） | 元の関数は中断しない出力のままにし、中断しうる関数を渡す呼び出しのために「中断用の写し」（`List.map$suspend8`）を別に出力する（特殊化） | ジェネリクスと一緒に単相化する | 同じ |
| Async | ハンドラの値を持たないので、証拠の表に載せない。R が Async だけの main とテスト関数は引数なしで呼ぶ | 同じ | 同じ |
| エラー | 戻り値として返す | 同じ | 同じ |
| defect | 専用クラスの例外 | 戻り値で明示的に伝える（例外を使わない） | 同じ |
| メモリ管理 | ホストの GC | 線形メモリ上の参照カウント（Perceus 方式） | 参照カウント（Perceus 方式） |
| ランタイム | コンパイラが出力先に書き出す | 出力するモジュールにリンクする | C のソースとして出力と一緒にコンパイルする |
