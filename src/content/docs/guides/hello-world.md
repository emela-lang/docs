---
title: Hello, World
description: Emela で最初のプログラムを書く
---

Emela で `Hello, World!` を出力するには、次のように書きます。

```emela run
import std.io

fn main() -> Unit uses { Io } {
    Io.print("Hello, World!\n")
}
```

## 1行ずつ

```emela
import std.io
```

標準ライブラリの `io` モジュールを import します。Emela の import は **モジュール単位** で、
関数を個別に import することはできません。`std.io` は effect `Io` と、その操作 `print` などを持ちます。

```emela
fn main() -> Unit uses { Io } {
```

`main` はプログラムのエントリポイントです。`fn` で関数を定義し、`-> Unit` は戻り値の型（値を1つだけ持つ型 `Unit`）、
`uses { Io }` は **この関数が capability `Io` を使う** ことの宣言です。

標準出力への書き込みは副作用なので、`Io` を `uses` に書かないと `Io.print` は呼べません。
試しに `uses { Io }` を消すとコンパイルエラーになります。

```emela
    Io.print("Hello, World!\n")
```

effect の操作は必ず **修飾形 `Effect.op(...)`** で呼びます。`Io.print` は文字列を標準出力へ書き出します。
`\n` は改行のエスケープです。

## ビルドして実行

プロジェクト（`Pome.toml` を持つディレクトリ）のルートで：

```sh
emela build src/main.emel
```

`main.emel` の `main` から到達できる副作用が `Io.print`（capability `Io`）だけなので、
生成される WebAssembly が要求する権限もそれだけになります。これがコンパイル時に確定し、
成果物には[権限表（capability manifest）](/reference/runtime-boundary/#capability-manifest)として埋め込まれます。

## 次のステップ

- [言語ツアー](/guides/tour/) — enum・`match`・ジェネリクス・pipeline などを一巡り
- [エフェクト（uses）](/reference/effects/) — `uses` と capability の仕組み
