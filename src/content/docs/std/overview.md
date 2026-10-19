---
title: 標準ライブラリの構成
description: Prelude、core、std の区分と、ハンドラの名前、API の約束
---

Emela の標準ライブラリはコンパイラに同梱された `.emel` のソースです。import なしで使える小さな core と、`Std` の下に置いた std に分かれていて、ホストに触れる機能はすべて std のエフェクトとして提供されます。

```emela check
import Std.Platform.{Platform}
import Std.Console.{Console}
import Std.Env.{Env}

fn greeting(name: Option[String]) -> String {
  name |> Option.map(fn(n) { "Hello, #{n}!" }) |> Option.or("Hello!")
}

fn main() {
  with Platform {
    (use Console).print_line(greeting((use Env).get("USER")))
  }
}
```

```console
$ USER=emela emela run main.emel
Hello, emela!
```

`Option.map` と `Option.or` は core なので import が要りません。`Console` と `Env` は std のエフェクトで、`Std.Platform` の `Platform` がホストのハンドラを供給します。

## Prelude、core、std

| 区分 | 名前 | 使い方 | 中身 |
|---|---|---|---|
| Prelude | 修飾なし | import なしで見える | 基本の型、`Some` などの構成子、`panic` / `todo` / `dbg`、`ParseError` |
| core | `List`、`String` など短い名前 | import なしで `List.map` と修飾して呼ぶ | コンパイラが構文として知っている型のモジュール（`Int`、`Int64`、`Float`、`String`、`List`、`Option`） |
| std | `Std.Console` など `Std` の下 | import して使う | それ以外のすべて |

Prelude には純粋なものしか入っておらず、Prelude と core だけで書いた関数は純粋です。core はコンパイラの組み込み関数と一対一で対応していて、小さく保ちます。std に入れるのは、ほとんどのプログラムが使い、形が1つに決まるもの（ホストの境界、並行と状態、基本の値の型、テストの部品など）です。

## どのページに何があるか

| ページ | 扱うモジュール |
|---|---|
| [core](/std/core/) | Prelude、`Int`、`Int64`、`Float`、`String`、`List`、`Option` |
| [Console・Clock・Random・Env](/std/platform/) | `Std.Console`、`Std.Clock`、`Std.Random`、`Std.Env`、`Std.Instant`、`Std.Duration`、`Std.Platform` |
| [FileSystem と Path](/std/file-system/) | `Std.FileSystem`、`Std.Path` |
| [Http](/std/http/) | `Std.Http` |
| [State・Fiber・Deferred](/std/state-fiber/) | `Std.State`、`Std.Fiber`、`Std.Cause`、`Std.Deferred` |

## なぜ Std の下に置くのか

ソースのルート直下に、`list.emel` や `string.emel` のような core のモジュールと同じ名前のファイルは置けません。std のモジュールまで短い名前にすると、std にモジュールを足すたびに、利用者のファイル名が1つずつ予約名になっていきます。

std を `Std` の下に置いたので、予約名は `std.emel` と `std/` だけで済みます。自分のプロジェクトに `http.emel` を書いても `Std.Http` とはぶつかりません。モジュール名の決まりは [モジュール](/guide/modules/) にあります。

## ハンドラの名前

platform のエフェクトにはホストを使う本物のハンドラと、テスト用のハンドラがあります。名前は前に付ける語で分け、どちらもエフェクトと同じモジュールに置きます。

| エフェクト | 本物のハンドラ | テスト用のハンドラ |
|---|---|---|
| `Console` | `SystemConsole` | `TestConsole` |
| `Clock` | `SystemClock` | `TestClock` |
| `Random` | `SystemRandom` | なし |
| `Env` | `SystemEnv` | なし |
| `FileSystem` | `SystemFileSystem` | `TestFileSystem` |
| `Http` | `SystemHttp` | `TestHttp` |

```emela
import Std.Clock.{Clock, SystemClock, TestClock}
```

ハンドラの名前にターゲットの名前は入りません。1つのハンドラがターゲットごとの実装を持ち、ビルドするターゲットで使う実装が決まります。0.20 では Http に C の実装がなく、C で `send` を呼ぶとコンパイルのエラーになります。呼ばなければ検査しないので、`with Platform` は C でも使えます。

## Platform

`Std.Platform` の `Platform` は、System のハンドラを全部束ねた layer です。

```emela
pub layer Platform {
  SystemConsole
  SystemClock
  SystemRandom
  SystemEnv
  SystemFileSystem
  SystemHttp
}
```

`main` はふつう `with Platform { ... }` と書きます。一部だけ差し替えるときは、差し替えるハンドラを後ろに並べます（`with Platform, TestClock { ... }`）。後に書いたハンドラが同じエフェクトのハンドラを置き換えます。

テスト用のハンドラを束ねた layer はありません。テスト用のハンドラはそれぞれ別の型の State に依存するので、束ねても `State.run` を重ねる手間は減らないためです。使い方は [Console・Clock・Random・Env](/std/platform/) にあります。

## API の約束

core と std の関数は次の約束に従って名前と引数を決めています。自分のライブラリを書くときも、そろえておくと読みやすくなります。

### 対象を最初の引数に

操作の対象は最初の引数に置きます。そのためパイプでつなげます。

```emela check
fn main() {
  dbg([1, 2, 3] |> List.map(fn(x) { x * 2 }) |> List.filter(fn(x) { x > 2 }))
  dbg(["a", "b"] |> String.join(", "))
}
```

### 関数を受ける引数は f

関数を受ける引数の名前は `f` で、名前でなく位置で渡します（`List.map(xs, fn(x) { ... })`）。畳み込みの初期値の引数名は `from` です。

```emela check
fn main() {
  dbg(List.fold([1, 2, 3], from: 0, f: fn(acc, x) { acc + x }))
}
```

### つなぐ関数の名前

| 働き | 名前 | 例 |
|---|---|---|
| 2つをつなぐ | `append` | `List.append(xs, ys)`、`String.append(a, b)` |
| 並びを平らにする | `flatten` / `concat` | `List.flatten(xss)`、`String.concat(parts)` |
| 区切りを挟んでつなぐ | `join` | `String.join(parts, sep)` |

### うまくいかないときの返し方

場面で返し方を分けます。

| 場面 | 返し方 | 例 |
|---|---|---|
| 探して無い、範囲の外 | `Option` を返す | `List.get`、`List.find`、`Env.get` |
| 入力の形が正しくない | `error` を宣言して `fail` する | `Int.parse(s) -> Int fails ParseError` |
| 外の世界の失敗 | エフェクトの操作の `fails` に書いて `fail` する | `FileSystem.read_text` の `FileNotFound` |
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
  dbg(port("80a"))  # None
}
```

入力の形の誤りはどれも Prelude の `error ParseError(input: String)` で表します。`input` は入力の全体です。エラーの書き方は [エラー](/guide/errors/) にあります。

### 名前の型

| 形 | 意味 | 例 |
|---|---|---|
| `to_*` | 失敗しない変換 | `Int.to_string`、`Int64.to_int` |
| `from_*` | 失敗しない作成 | `Float.from_int`、`Instant.from_unix_milliseconds` |
| `parse` | 失敗しうる文字列からの変換 | `Int.parse`、`Float.parse` |
| `is_*` | Bool を返す判定 | `List.is_empty`、`Option.is_some` |

Option の既定値は `Option.or(opt, default)`、Option を返す関数をつなぐのは `Option.and_then` です。

### 変換の置き場所

2つの型の間の変換は後から足した型（依存する側）のモジュールに、行きと帰りをまとめて置きます。基本の型は後から足した型を知らないためです。

- Int と Int64 の間は `Int64.from_int` と `Int64.to_int`
- Int と Float の間は `Float.from_int`（戻りは `Float.floor` などの丸め）
- Instant と Int64 の間は `Instant.from_unix_milliseconds` と `Instant.to_unix_milliseconds`

ただし String への変換だけはどの型も自分のモジュールの `to_string` に置きます（`Int.to_string`、`Duration.to_string`）。同じ変換を両方の型に置くことはしません。

## 0.21 以降に入るもの

:::caution[0.21 で入る予定]
次のものは 0.20 の std にありません。

- コレクションの `Std.Map`、`Std.Set`、`Std.Array`。Trait（Eq、Ord、Hash、Show）の上に作ります。0.20 の `==` と表示は Trait でなくランタイムの組み込みの処理で動くので、純粋な Emela で書くと、中身が同じでも作り方で比較や表示が変わりうるためです。コレクションは不変です
- JSON の変換。導出規則を持つ Trait（Encode、Decode）として入ります
- `Semaphore`、`Queue` と Http のサーバー

それまでは、キーと値の組は `List[(String, String)]` のようなタプルのリストで持ちます（Http のヘッダもこの形です）。
:::

## github.com/emela-lang/x

形がまだ固まっていない純粋な Emela の部品は、std に入れる前に Pome `github.com/emela-lang/x`（ルート名 `X`）で先に出し、使われて固まったら std に取り込みます。フレームワークのように好みの分かれるものは std に入れず、独立した Pome にします。

:::caution[依存はまだ使えない]
0.20 のコンパイラは `Pome.toml` の `[dependencies]` をまだ読まないので、`x` を依存に足して使うことはできません。Pome の現状は [プロジェクトと Pome](/tools/pome/) にあります。
:::
