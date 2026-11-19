---
title: 標準ライブラリの構成
description: core と std の区分、ページの案内、ハンドラの名前、API の約束
---

Emela の標準ライブラリは、コンパイラに同梱された `.emel` のソースです。import なしで使える小さな core と、`Std` の下に置いた std に分かれています。ホストに触れる機能は、どれも std のエフェクトとして提供されます。

```emela check
import Std.Process.{Process}
import Std.Console.{Console}
import Std.Env.{Env}

fn greeting(name: Option[String]) -> String {
  name |> Option.map(|n| "Hello, #{n}!") |> Option.or("Hello!")
}

fn main() {
  with Process {
    (use Console).print_line(greeting((use Env).get("USER")))
  }
}
```

```console
$ USER=emela emela run main.emel
Hello, emela!
```

`Option.map` と `Option.or` は core なので import が要りません。`Console` と `Env` は std のエフェクトで、`Std.Process` の `Process` がホストを使うハンドラをまとめて供給します。

このページと続くガイドは、部品のつながりと使い方を例で説明します。関数の一覧は [API リファレンス](/std/api/) にあります。API リファレンスは `emela doc --std` がソースのドキュメントコメント（英語）から作ったもので、どの型と関数も載っています。

## core と std

| 区分 | 名前 | 使い方 | 中身 |
|---|---|---|---|
| Prelude | 修飾なし | import なしで見える | 基本の型、`Some` などの構成子、Trait の `Eq` `Ord` `Show`、`panic` `todo` `dbg` `inspect`、`ParseError` |
| core | `List`、`String` など短い名前 | import なしで、`List.map` と修飾して呼ぶ | コンパイラが構文として知っている型のモジュール（`Bool`、`Int`、`Int64`、`Float`、`String`、`List`、`Option`） |
| std | `Std.Console` など `Std` の下 | import して使う | それ以外のすべて |

Prelude と core は純粋で、それだけで書いた関数は純粋です。std のモジュールは性質で4つの層に分かれます。

| 層 | 性質 | モジュール |
|---|---|---|
| 値 | 純粋で、ホストに依らない | `Std.Map`、`Std.Set`、`Std.Array`、`Std.Bytes`、`Std.Instant`、`Std.Duration`、`Std.Path`、`Std.Dynamic`、`Std.Json`、`Std.Shape` |
| エフェクト | 並行性と状態 | `Std.State`、`Std.Fiber`、`Std.Exit`、`Std.Cause`、`Std.Deferred`、`Std.Semaphore`、`Std.Queue` |
| platform | ホストとの境界。エフェクトと本物のハンドラ | `Std.Console`、`Std.Process`、`Std.Clock`、`Std.Random`、`Std.Env`、`Std.FileSystem`、`Std.Http`、`Std.Platform` |
| テスト | 差し替え用のハンドラ | `TestClock`、`TestConsole` など。それぞれのエフェクトと同じモジュールにある |

## どのページに何があるか

| ページ | 扱うモジュール |
|---|---|
| [Prelude と core](/std/core/) | Prelude、`Bool`、`Int`、`Int64`、`Float`、`String`、`List`、`Option` |
| [コレクション](/std/collections/) | `List`、`Std.Array`、`Std.Map`、`Std.Set`、`Std.Bytes` |
| [Process と Platform](/std/platform/) | `Std.Platform`、`Std.Process`、`Std.Console`、`Std.Clock`、`Std.Instant`、`Std.Duration`、`Std.Random`、`Std.Env` |
| [FileSystem と Path](/std/file-system/) | `Std.FileSystem`、`Std.Path` |
| [Http](/std/http/) | `Std.Http`、`Std.Http.Request`、`Std.Http.Response` |
| [JSON と Dynamic](/std/json/) | `Std.Json`、`Std.Dynamic`、`Std.Shape` |
| [State と Fiber](/std/state-fiber/) | `Std.State`、`Std.Fiber`、`Std.Exit`、`Std.Cause`、`Std.Deferred`、`Std.Semaphore`、`Std.Queue` |

## なぜ Std の下に置くのか

ソースのルート直下に、`list.emel` や `string.emel` のような core のモジュールと同じ名前のファイルは置けません。std のモジュールまで短い名前にすると、std にモジュールを足すたびに、利用者のファイル名が1つずつ予約名になっていきます。

std を `Std` の下に置いたので、予約名は `std.emel` と `std/` だけで済みます。自分のプロジェクトに `http.emel` を書いても `Std.Http` とはぶつかりません。モジュール名の決まりは [モジュール](/guide/modules/) にあります。

## ハンドラの名前

platform のエフェクトには、ホストを使う本物のハンドラと、テスト用のハンドラがあります。本物には `System`、テスト用には `Test` を前に付け、どちらもエフェクトと同じモジュールに置きます。

```emela
import Std.Clock.{Clock, SystemClock, TestClock}
```

ハンドラの名前にターゲットの名前は入りません。1つのハンドラがターゲットごとの実装を持ち、ビルドするターゲットで使う実装が決まります。実装のないターゲットで操作を呼ぶとコンパイルのエラーになります（ネイティブの `SystemHttp` など）。呼ばない操作は検査しないので、`with Platform` はどのターゲットでも書けます。

本物のハンドラは layer にまとめてあり、`main` ではふつう `with Platform { ... }` か `with Process { ... }` と書きます。2つの違いは [Process と Platform](/std/platform/) にあります。テスト用のハンドラを束ねた layer はありません。テスト用のハンドラはそれぞれ別の型の State に状態を置くので、束ねても `State.run` を重ねる手間は減らないためです。

## API の約束

core と std の関数は次の約束で名前と引数を決めています。自分のライブラリを書くときも、そろえておくと読みやすくなります。

### 対象を最初の引数に

操作の対象は最初の引数に置きます。そのため、パイプでつなげます。値の型を定義したモジュールの関数は、メソッド呼び出し（`xs.map(f)`）でも呼べます。`xs.map(f)` は `List.map(xs, f)` と同じです。

```emela check
fn main() {
  dbg([1, 2, 3] |> List.map(|x| x * 2) |> List.filter(|x| x > 2)) # [4, 6]
  dbg([3, 1, 2].sort().reverse()) # [3, 2, 1]
  _ = dbg(["a", "b"] |> List.join(", ")) # "a, b"
}
```

### 関数を受ける引数は f

関数を受ける引数の名前は `f` で、名前でなく位置で渡します（`List.map(xs, |x| ...)`）。畳み込みの初期値の引数名は `from` です。コレクションの要素に `f` を呼ぶ関数は、コレクションの順（List は先頭から、Map と Set はキーの順）に、要素ごとに多くて1回呼びます。

```emela check
fn main() {
  _ = dbg(List.fold([1, 2, 3], from: 0, f: |acc, x| acc + x)) # 6
}
```

### つなぐ関数の名前

| 働き | 名前 | 例 |
|---|---|---|
| 2つをつなぐ | `append` | `List.append(xs, ys)`、`String.append(a, b)` |
| 並びを平らにする | `flatten` / `concat` | `List.flatten(xss)`、`String.concat(parts)` |
| 区切りを挟んでつなぐ | `join` | `List.join(parts, sep)` |

### うまくいかないときの返し方

| 場面 | 返し方 | 例 |
|---|---|---|
| 探して無い、範囲の外 | `Option` を返す | `List.get`、`List.find`、`Env.get` |
| 入力の形が正しくない | `error` を宣言して `fail` する | `Int.parse(s) -> Int fails ParseError` |
| 外の世界の失敗 | エフェクトの操作の `fails` に書く | `FileSystem.read_text` の `FileNotFound` |
| 呼んだ側の前提が崩れた | defect | `Int.shift_left` に負のシフト量 |

`parse` に Option の版はありません。欲しいときは escape で変えます。

```emela check
fn port(text: String) -> Option[Int] {
  Some(Int.parse(text)) escape {
    ParseError(..) -> None
  }
}

fn main() {
  dbg(port("8080")) # Some(8080)
  _ = dbg(port("80a")) # None
}
```

入力の形の誤りはどれも Prelude の `error ParseError(input: String)` で表します。`input` は入力の全体です。エラーの書き方は [エラー](/guide/errors/) にあります。

### 名前の型

| 形 | 意味 | 例 |
|---|---|---|
| `to_*` | 失敗しない変換 | `Int.to_string`、`Int64.to_int` |
| `from_*` | 失敗しない作成 | `Float.from_int`、`Instant.from_unix_milliseconds` |
| `parse` | 失敗しうる、文字列からの変換 | `Int.parse`、`Bool.parse` |
| `is_*` | Bool を返す判定 | `List.is_empty`、`Option.is_some` |

### 変換の置き場所

2つの型の間の変換は、後から足した型（依存する側）のモジュールに、行きと帰りをまとめて置きます。基本の型は後から足した型を知らないためです。

- Int と Int64 の間は `Int64.from_int` と `Int64.to_int`
- Int と Float の間は `Float.from_int`（戻りは `Float.floor` などの丸め）
- Instant と Int64 の間は `Instant.from_unix_milliseconds` と `Instant.to_unix_milliseconds`

ただし String への変換だけは、どの型も自分のモジュールの `to_string` に置きます（`Int.to_string`、`Duration.to_string`）。

## std の外に置くもの

形がまだ固まっていない純粋な Emela の部品は、std に入れる前に Pome `github.com/emela-lang/x`（ルート名 `X`）で先に出し、使われて固まったら std に取り込みます。テストの比較の補助や生成器は Pome `github.com/emela-lang/brix` にあり、テストの依存として使います。フレームワークのように好みの分かれるものは std に入れず、独立した Pome にします。依存の書き方は [プロジェクトと Pome](/tools/pome/) にあります。
