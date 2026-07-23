---
title: エラー（throws）
description: error channel・throw・?・try–catch・panic
---

回復可能な失敗は、関数型の `throws E` 節と `throw` 式で表します。`throws` は
[`uses`（capability channel）](/reference/effects/)とは **独立した error channel** です。
error は `uses` に寄与せず、`throw` や `?` は effect を発生させません。

## 失敗の3分類

| 種類 | 表現 | 用途 |
|---|---|---|
| 回復可能な失敗 | `throws E`（error channel） | 呼び出し元が対処しうる失敗 |
| 値の不在 | `Option<T>`（通常の値） | 「無い」を返す |
| 回復不能な異常 | `panic` | プログラムを異常終了させる |

回復可能な失敗を `Result<T, E>` で表しません。`Result` は組み込み型ではありません。

## throws と throw

関数が送出しうる error の型は、戻り値型に続く `throws E` 節で宣言します。

```emela
fn read(path: Path) -> String throws IoError uses { Fs }
fn parse(input: String) -> Ast throws ParseError
```

- `throws E` を持たない関数は error を送出しません。これは `throws Never` と等価です。
- `E` は **単一の型** です。複数種類の error は enum で束ねます。
- capability を `throws` に書くことはできません。`throws` と `uses` は別 channel です。
- `throw e` は通常の値を返しません。型は `Never` で、任意の期待型に適合します。
- `throw e` が現れる関数は `throws E` を宣言していなければならず、`e` の型は `E` に適合していなければなりません（`try` block 内にあるときは `catch` に捕捉されます）。

## throwing な呼び出しの扱い

throwing な呼び出しは、次のいずれかの位置に置かなければなりません。満たさない throwing な呼び出しはコンパイルエラーです。

1. `?` を付けて error を呼び出し元へ伝播する。
2. `try` block 内に置き、`catch` で捕捉する。

## `?` operator

`?` は throwing な呼び出しの error を、現在の関数の `throws` 節へ伝播する短絡評価 operator です。

```emela
let value = expr?
-- ≡
let value = try { expr } catch { e -> throw e }
```

- `expr?` を使う関数の戻り値型は `throws E` を宣言していなければなりません。
- `?` が伝播する error 型は、現在の関数が宣言する error 型と **一致** していなければなりません。異なる場合は `try` / `catch` で明示的に変換します。
- `?` は throwing な呼び出し専用で、`Option<T>` には使えません。不在を error として伝播するには `Option.ok_or(o, e) -> T throws E` で明示的に橋渡ししてから `?` を使います。
- `?` は対象の式を1回だけ評価し、成功なら値を取り出し、error なら短絡します。後続の式は評価されません。
- `?` 自体は effect を発生させません。`expr?` の effect は `expr` と同じです。

```emela
fn load(path: Path) -> Config throws IoError uses { Fs } {
    let text = read(path)?    -- read: throws IoError → そのまま伝播
    parse(text)?
}
```

## try / catch 式

`try { block } catch { arms }` は式です。

- `block` を評価します。成功値 `v` で完了すれば式全体の値は `v` で、`catch` は評価されません。
- `block` の評価中に error `e` が送出されたら、`e` を `catch` の arm に上から順に match します。一致した arm の本体を評価し、その値が式全体の値になります。
- `try` block 内では throwing な呼び出しに `?` を付ける必要はありません。送出された error はすべて `catch` に routing されます。
- `catch` の arm は、送出されうる error 型を **網羅** していなければなりません（wildcard arm を使ってよい）。
- 式の型は、`block` の成功値の型とすべての `catch` arm 本体の型の共通型です。
- **error channel の解消**：`catch` がすべてハンドルすれば、`try` / `catch` 式自体は error を送出しません。したがって `throws` を宣言しない関数でも、throwing な呼び出しを `try` / `catch` で包めば呼べます。arm 本体で再度 `throw` すれば再送出でき、その場合は関数が対応する `throws` を宣言していなければなりません。
- effect は `block` と到達しうる `catch` arm 本体の effect の和集合です。

```emela
fn loadOrDefault(path: Path) -> Config uses { Fs } {
    try {
        parse(read(path))
    } catch {
        IoError::NotFound -> defaultConfig()
        e -> panic("unrecoverable")
    }
}
```

## panic

`panic` は組み込みの回復不能エラーです。現在の評価を終了し、プログラムを回復不能な異常終了へ移行させます。

- `panic` は通常の値を返さず、型は `Never` で任意の期待型に適合します。
- 回復可能な失敗に `panic` を使ってはなりません。回復可能な失敗は `throws` または `Option` で表します。
- `panic` は `throws` でも `uses` でもなく、どちらの channel にも現れません。
- WASM では panic を runtime trap または runtime-provided panic handler に lower してよく、embedder は panic message をログに出して異常終了してよいですが、通常評価へ復帰してはなりません。

## エントリポイント

プログラムのエントリ `main` の `throws` は `Never` でなければなりません。`main` は `throws` 節を省略するか `throws Never` を宣言します。
`main` 本体が throwing な呼び出しや `throw` を含む場合、`main` 自身が `try` / `catch` で処理するか `panic` で異常終了させなければなりません。error を `main` の外へ伝播することはできません。

## ホストの失敗（fallible platform 関数）

ホスト（platform 関数）が報告する失敗も、この `throws` channel に流れます（→ [ランタイム境界](/reference/runtime-boundary/)）。

- registry のエントリと `extern fn` は `throws E` を宣言してよく、宣言しないエントリは失敗しません（`throws Never` と等価）。
- `E` は、その extern を宣言する core モジュール内で宣言された、型パラメータを持たない `pub enum` でなければなりません。
- 呼び出し側から見て通常の Emela error であり、上記の規則がそのまま適用されます。
- `throws` の有無は `uses` row・カバレッジ検査・capability manifest に一切影響しません。error は capability ではありません。
- ホストは1回の呼び出しにつき、成功値または error 値の **ちょうど一方** を返さなければなりません。想定内の失敗で trap / panic してはなりません。

```emela
effect Fs {
    extern fn read(path: String) -> String throws FsError
}
```
