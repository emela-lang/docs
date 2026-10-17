---
title: Emela とは
description: Emela の位置づけ、3本の柱、2つの層、固定した前提
---

Emela は、Effect-TS の開発パターンと厳格なエフェクト型を、1つの言語として提供する関数型言語です。関数が起こしうるエラーと使う副作用は型に現れ、コンパイラが推論します。出力先は JavaScript、WebAssembly、C で、同じプログラムがどのターゲットでも同じ結果を返すことを仕様で求めています。

```emela check
import Std.Console.{Console}
import Std.Platform.{Platform}

type User(id: Int, name: String)

error NotFound(id: Int)

effect Users {
  fn find(id: Int) -> User fails NotFound
}

handler SampleUsers implements Users {
  fn find(id) {
    if id == 1 { User(id: 1, name: "alice") } else { fail NotFound(id:) }
  }
}

# 推論される型: fn(Int) -> String fails NotFound use { Users }
fn greeting(id: Int) {
  user = (use Users).find(id)
  "Hello, #{user.name}!"
}

fn main() {
  with Platform, SampleUsers {
    console = use Console
    console.print_line(greeting(1))
    console.print_line(greeting(2) escape { NotFound(_) -> "Hello, guest!" })
  }
}
```

```console
$ emela run main.emel
Hello, alice!
Hello, guest!
```

`greeting` の型には何も書いていませんが、`NotFound` で失敗しうること、`Users` を使うことが型に載ります。`main` はそのどちらも片付けてから終わらなければなりません。エラーは `escape` で値に戻し、エフェクトは `with` でハンドラを供給して消します。テストでは `SampleUsers` を別のハンドラに差し替えるだけで済み、モックの仕組みは要りません。

## 3本の柱

言語の機能は、次の3つのどれかに属します。どれにも属さない機能は入れません。

| 柱 | 構文 | 詳しくは |
|---|---|---|
| データの定義 | `type`、`enum`、`error` | [データ型](/guide/data/) |
| データを操作する関数 | `fn`、`match`、`\|>` | [束縛と関数](/guide/functions/)、[パターンマッチ](/guide/pattern-matching/) |
| 副作用の明示 | `effect`、`use`、`with` | [エフェクトとハンドラ](/guide/effects/) |

## 2つの層

| 層 | 書く人 | 含まれるもの |
|---|---|---|
| 日常の層 | アプリケーションを書く人 | `type` `enum` `error` `fn` `match` `use` `with` `fail` `escape` |
| 基盤の層 | ライブラリやランタイム境界を書く人 | `effect` `handler` `layer` `suspend` `trait` `impl`、`fails` 節と `use` 節、制約、`@external` |

日常の層のコードを書くのに基盤の層の知識が要るなら、それは設計の不具合として扱います。アプリケーションのコードでは、型注釈の `fails` や `use` を書かなくても推論で済み、同梱の `Platform` や自分のチームが用意したハンドラを `with` で並べるだけで動きます。

## 固定した前提

次の点は設計の土台で、後の版でも変えません。

- 継続は one-shot に限ります。中断した計算を再開できるのは高々1回です（[中断する操作](/guide/suspend/)）。
- エラーはエフェクトではなく、独立したチャネルで扱います。`fail` と `escape` はハンドラを通りません（[エラー](/guide/errors/)）。
- 期待されるエラー（型に現れる）と defect（型に現れない異常終了）を区別します。ゼロ除算や `assert` の失敗は defect で、`escape` では受けられません。
- 変数は不変です。同じ名前で束縛し直すことはできますが、再代入はありません。ループ構文もなく、繰り返しは再帰か `List.map` のような関数で書きます。自分自身への末尾呼び出しはスタックを消費しません。
- 高カインド型、部分型、null、暗黙の型変換、演算子の多重定義は持ちません。Result 型、`?` 演算子、try / catch もありません。値の不在は `Option` で表します。

## 0.1x からの作り直し

0.20 は、0.1x 系とは別の言語として作り直した版です。構文も型の体系も互換性はありません。capability を `uses` 節で追跡していた 0.1x の考え方は、エフェクトとハンドラ、型付きのエラーに置き換わりました。0.1x のコンパイラは emela リポジトリの `legacy` ブランチに残っています。0.1x 向けに書かれた記事やコードは、0.20 ではそのまま動きません。

## 次に読む

- [インストール](/start/installation/) と [最初のプロジェクト](/start/first-project/) で手元で動かす
- [言語ツアー](/start/tour/) で主な機能を一巡りする
- [実装の状況](/start/status/) で、仕様のうちどこまでが今のコンパイラで動くかを確かめる
- 他の言語を知っているなら [他の言語から](/from/overview/)
