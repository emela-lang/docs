---
title: エフェクト（uses）
description: capability・effect row・handler・discharge・権限表
---

関数が要求する **capability（能力）** を、関数型の `uses` 節に **effect row** として書きます。
effect は静的な契約であり、型検査後に消去され、**実行時表現もランタイムコストも持ちません**。

## 用語

| 用語 | 定義 |
|---|---|
| **effect / capability** | 関数が要求する能力（`Io`・`Socket` など）。名前は大文字始まり。 |
| **effect row** | effect の集合。`uses` 節が持つ値。順序・重複は正規化され、集合として扱う。 |
| **プリミティブ effect** | `extern fn` 操作を1つ以上持つ effect。実体をホスト（platform 関数）が供給する。 |
| **派生 effect** | `extern fn` を持たない effect。実体を **handler** が供給する。 |
| **handler** | 派生 effect の各操作を、依存 effect の上で実装する単位。 |
| **discharge** | row 中の各派生 effect を、その handler の依存 row で置換する固定点変換。 |
| **leaf row** | source row を discharge した結果。プリミティブ effect と未解決の派生 effect からなる。 |
| **権限表** | プログラムがホストへ要求する import 集合。leaf row のプリミティブ要素に等しい。 |

## モデル

中心テーゼ：**関数の `uses` 節（の leaf row）が、そのまま WASM モジュールがホストへ要求する import 集合＝サンドボックスの権限表になる**。これが二重の保証を与えます。

- **静的**：宣言なき副作用は effect 検査が型エラーとして拒否する。
- **動的**：import されていないホスト関数は、WASM サンドボックスが実行時にも呼ばせない。

派生 effect の handler は [トレイトの impl](/reference/traits/) と同じく **静的に解決・単相化・消去** されます（コンパイル時 DI）。限定継続を伴う実行時 effect handler（Koka 型）は採りません。

`throws E`（error channel）と `uses F`（capability channel）は **独立した2本の channel** です。error は `uses` に寄与せず、`throw` や `?` は effect を発生させません（→ [エラー](/reference/errors/)）。

## 関数型の effect row

関数型の完全形：

```text
(A, B) -> T throws E uses F
```

```text
Row     ::= '{' [Name (',' Name)*] ('..' RowVar)? '}'  |  RowVar
RowVar  ::= "'" ident
```

- **型の表記** で `uses` を省略した型は `uses {}`（純粋）です。型は明示的な契約であり、推論されません。`uses {}` は省略できます。
- `throws E` と `uses F` はいずれも型の一部・public API の一部です。`uses` の異なる関数型は **異なる型** です。

```text
Path -> String                              -- 純粋・非送出
Path -> String uses { Fs }                  -- effectful・非送出
Path -> String throws IoError               -- 送出・純粋
Path -> String throws IoError uses { Fs }   -- 送出・effectful
```

（**関数定義** の `uses` 省略は推論を意味します。→ [推論と注釈](#推論と注釈)。省略の意味は「型の表記」と「定義」で異なります。）

## effect の宣言

```emela
module io

effect Io {
    extern fn write_stdout(s: String) -> Unit
    extern fn write_stderr(s: String) -> Unit

    pub fn print<T: Show>(s: T) -> Unit { write_stdout(s.to_string()) }
    pub fn eprint<T: Show>(s: T) -> Unit { write_stderr(s.to_string()) }
}
```

- `effect Name { items }` はモジュール内のトップレベルアイテム（enum と同格）です。`Name` は大文字で始まらなければなりません。
- `items` は `fn` / `pub fn` / `extern fn` を含めます。各操作は暗黙に `uses { Name }` を持ち、操作に明示的な `uses` 節を書くことはエラー、`intrinsic fn` はエラーです。
- `extern fn` を1つ以上持つ effect は **プリミティブ effect** です。その実体はホストの platform 関数が供給します（→ [ランタイム境界](/reference/runtime-boundary/)）。canonical platform 名は **モジュール名** で修飾します（例：`io.write_stdout`）。effect 名 `Io` は row・呼び出し構文・診断にのみ現れます。
- `extern fn` を持たない effect は **派生 effect** です。
- 1つの effect はプリミティブか派生のいずれか一方です。
- extern バッキング操作は同じ effect ブロック内からのみベア名で呼べます。

## effect 操作の呼び出しと uses ゲート

effect 操作は **修飾形 `Name.op(...)` でのみ** 呼べます。ベア名 `op(...)` で effect 操作に解決してはなりません。

`Name.op(...)` が解決されるのは、次の **両方** が成り立つときです。

1. `Name` がスコープ内の effect（同一ファイル宣言 ∪ import 済み公開 effect）に解決できる。
2. 語彙的に囲む最も内側の `uses` 保持スコープ（関数定義・関数リテラル）の宣言 `uses` row に `Name` が含まれる。

```emela
fn f() -> Unit uses { Io } {
    Io.print("hi")       -- OK
}

fn g() -> Unit uses { Io } {
    print("hi")          -- error: `print` は effect `Io` の操作。`Io.print(...)` と呼ぶ
    Io.write_stdout("x") -- error: `write_stdout` は `Io` の非公開操作
}

fn h() -> Unit {
    Io.print("hi")       -- error: effect `Io` は `h` の `uses` に宣言されていない
}
```

`uses { Name }` の各名前も、スコープ内の effect に解決されなければなりません。

## 推論と注釈

- **関数定義**（名前付き `fn`・無名関数）で `uses` を省略した場合、effect row は本体から **推論** されます。推論される row は、呼び出し・guard・分岐の和集合に従う **最小の row** です。
- 再帰・相互再帰は最小不動点で解きます。
- `pub fn` は `uses` を **明示しなければなりません**。public API の effect は推論結果ではなく宣言です。`extern fn` / `intrinsic fn` も常に明示です。
- `uses` 注釈は **上界** です。推論 row を `I`、宣言 row を `D` として `I ⊆ D` でなければなりません。過大宣言 `D ⊋ I` は合法です（将来 effect を追加する予約に使えます）。過大宣言は権限表を増やしません。

```emela
fn load() -> String {                    -- uses { Fs } と推論（private は注釈不要）
    Fs.read("config.txt")
}

pub fn main() -> Unit uses { Io, Fs } {  -- pub は明示必須
    Io.print(load())                     -- 推論 { Io, Fs } ⊆ 宣言 { Io, Fs }
}

fn bad() -> Unit uses { Io } {
    Fs.read(path)                        -- error: 推論 { Fs } ⊄ 宣言 { Io }
}
```

## Subsumption と row 拡張

具体 row `F1 ⊆ F2` のとき、型 `(A) -> T uses F1` の関数値は、型 `(A) -> T uses F2` が期待されるあらゆる位置に適合します。

```text
F1 ⊆ F2
─────────────────────────────────────────
(A) -> T uses F1  <:  (A) -> T uses F2
```

関数型がネストする場合は通常の変性に従います（**パラメータ位置の row は反変**、**結果位置は共変**）。

```emela
fn twice(f: (Int) -> Int uses { Fs, Net }) -> Int uses { Fs, Net } { ... }
fn pure_inc(x: Int) -> Int { x + 1 }     -- uses {}
twice(pure_inc)                          -- OK: {} ⊆ { Fs, Net }
```

具体 effect と row 変数を並べた拡張 row も書けます。単一化は **最小解** を取ります。

```text
uses { Io, ..'e }     -- 意味: { Io } ∪ 'e
```

## effect-row 多相

`map` / `filter` / `fold` のような高階関数を、純粋・effectful の両方に同一定義で適用するため、`uses` を **effect-row 変数** で受け取れます。

```emela
fn map<T, U>(xs: Array<T>, f: (T) -> U uses 'e) -> Array<U> uses 'e { ... }

map([1, 2, 3], fn (x: Int) -> Int { x + 1 })                   -- 'e = {} → map 全体 uses {}
map(paths, fn (p: Path) -> String uses { Fs } { Fs.read(p) })  -- 'e = { Fs }
```

- effect-row 変数は sigil `'` を付けた識別子（`'e`）で書きます。**型パラメータ `<...>` とは別カテゴリ** で、`<...>` に書いてはなりません。
- `'e` は **`uses` の位置にのみ** 現れます。引数型・戻り値型・`throws` 型には書けません。
- `'e` は宣言不要で、`uses` 位置に現れた時点でシグネチャに暗黙に全称量化されます。
- 各 effect-row 変数は、少なくとも1つのパラメータの `uses` 位置に現れなければなりません。
- effect row は静的契約で実行時表現を持たないため、effect-row 多相は **単相化を必要としません**。

## handler・discharge・erasure

**派生 effect** の操作は本体を持たないシグネチャ宣言であり、実体を **handler** が供給しなければなりません。

```emela
effect Log {                 -- 派生 effect（extern を持たない）
    pub fn info(msg: String) -> Unit
    pub fn error(msg: String) -> Unit
}

handler for Log uses { Io } {          -- 依存 effect Io の上で実装
    fn info(msg: String) -> Unit  { Io.write_stdout("[INFO] " ++ msg ++ "\n") }
    fn error(msg: String) -> Unit { Io.write_stderr("[ERROR] " ++ msg ++ "\n") }
}
```

- `handler for E uses { R } { items }` は派生 effect `E` の **default handler** を宣言します。`E` のすべての操作にちょうど1つ、シグネチャが厳密に一致する実装を与えなければなりません。
- handler 本体が使用する effect は依存 row `R` に含まれていなければなりません。`R` は派生 effect を含んでよく、その場合 discharge は推移的に進みます。
- default handler は `E` を宣言したモジュールに置きます。`E` が import 済みなら、その default handler も自動的に in-scope です。
- handler は第一級の値ではありません。束縛・受け渡し・戻りはできません。

### 未解決 effect と discharge

in-scope な default handler を持たない派生 effect を **未解決 effect** と呼びます。未解決 effect の操作呼び出し **自体はエラーになりません**。その effect は discharge されずに row に蓄積し、呼び出し元へ伝播します。エラーになるのは境界だけです。

```text
source row  S  = 本体が発生させる effect の union（派生を含む）
discharge      = handler を持つ派生 E を deps(handler(E)) で置換、固定点まで反復
leaf row  L    = discharge(S) = { プリミティブ } ∪ { 未解決の派生（residue） }
```

- 派生 `E` の `E.op(...)` は、default handler の実装をコンパイル時に一意に選び、直接 call へ **単相化置換** します。
- 派生 effect・handler・その解決は typed IR 化の前に **完全に消去** されます。IR に残るのはプリミティブ effect の platform 呼び出しだけです。辞書渡し・evidence・実行時ディスパッチは生成しません。
- プログラムのエントリ（`main`）と executable 境界では、その関数の **leaf row はプリミティブ effect のみからなっていなければなりません**。residue（未解決の派生 effect）が残ればコンパイルエラーです。中間の関数は未解決 effect を row に持ってよいです。

```emela
import std.io
import std.log

fn greet(name: String) -> Unit uses { Log } {
    Log.info("hello, " ++ name)
}

fn main() -> Unit uses { Log } {
    greet("emela")
    -- source row : { Log }
    -- discharge  : Log -> { Io }（handler の依存）
    -- leaf row   : { Io } ← 権限表・manifest はこれ
}
```

## 権限表：source row と leaf row

- **権限表を成すのは discharge 後の leaf row のプリミティブ要素** です。source row（派生を含みうる）は人間が読む intent の宣言で、実際にホストへ要求する import 集合はプリミティブな leaf です。
- capability manifest は到達可能な platform 呼び出しから計算されます（`uses` 非依存）。**派生 effect は manifest に現れません**（純 Emela の抽象であり、新たなホスト権限を生みません）。
- したがって過大宣言は Runtime 要求を増やしません。

## 組み込みプリミティブ effect

ホストが供給するプリミティブ effect。名前は大文字始まり。

| effect | 主な操作 | 備考 |
|---|---|---|
| `Io` | `write_stdout` / `write_stderr`（+ `print` など） | 標準出力・標準エラー |
| `Clock` | 時刻取得 | — |
| `Socket` | `listen` / `accept` / `read` / `write` / `close` | 平文 TCP のみ。TLS は含まない。`Bytes` を境界型とする |
| `Http` | HTTP クライアント | TLS がホスト責務のため **プリミティブのまま** |

派生 effect の例として `HttpServer`（`Socket` の上の handler）や `Log`（`Io` の上）があります。
`host.*` は embedder が定義する capability の名前空間です（→ [ランタイム境界](/reference/runtime-boundary/#embedder-定義-capabilityhost)）。
