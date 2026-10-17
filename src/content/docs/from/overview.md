---
title: 他の言語から
description: Emela が持つもの、持たないものを他の言語の言葉で並べた早見表と、言語ごとのページへの案内
---

Emela は、Effect-TS の開発パターン（型に出るエラー、型に出る依存、差し替えられる実装、構造化された並行性）を、ライブラリでなく言語そのものにした関数型言語です。この章では、すでに知っている言語の言葉で Emela を位置づけます。

## ひとことで言うと

- 関数の型は `T`（値）、`E`（起こしうるエラーの集合）、`R`（使うエフェクトの集合）の3つ組です。Effect-TS の `Effect<A, E, R>` や ZIO の `ZIO[R, E, A]` を、すべての関数が持っていると考えてください。
- E と R は推論されます。ふだんのコードには書かず、公開 API で書いて固定します。
- 副作用は `effect` で宣言した操作を通してしか起こせません。実装（handler）は呼ぶ側が `with` で供給します。テストではハンドラを差し替えるだけで、モックのライブラリは要りません。
- 構文は Gleam に近く、`|>`、`type` と `enum`、引数名つきの呼び出し、`match` があります。

```emela check
import Std.Console.{Console, SystemConsole}

error NotFound(id: Int)

type User(id: Int, name: String)

effect Users {
  fn find(id: Int) -> User fails NotFound
}

handler SampleUsers implements Users {
  fn find(id) {
    id match {
      1 -> User(id: 1, name: "alice")
      _ -> fail NotFound(id:)
    }
  }
}

# 推論される型: fn(Int) -> String fails NotFound use Users
fn greeting(id: Int) {
  user = (use Users).find(id)
  "Hello, #{user.name}!"
}

fn main() {
  with SystemConsole, SampleUsers {
    message = greeting(2) escape {
      NotFound(id:) -> "no user #{id}"
    }
    (use Console).print_line(message)
  }
}
```

## 持つもの、持たないもの

| 機能 | Emela | 代わりに使うもの |
|---|---|---|
| null / nil / None | ない | `Option[A]`（`Some(x)` と `None`） |
| 例外（throw / try / catch） | ない | `error` を宣言して `fail`、受けるのは `escape` |
| Result 型と `?` | ない | 失敗は何も書かなければ呼び出し元へ伝わる。E が型に出る |
| for / while ループ | ない | `List.map`、`List.fold`、再帰（自分への末尾呼び出しはスタックを使わない） |
| 可変な変数 | ない | 同じ名前での束縛し直し、可変な状態は `State` のエフェクト |
| クラスとメソッド呼び出し `x.f()` | ない | `type` と、モジュールの関数を `x \|> Mod.f` で呼ぶ |
| 演算子の多重定義 | ない | `Money.add(a, b)` のような関数 |
| 高カインド型（`F[_]`） | ない | エフェクトで抽象する |
| 部分型、継承 | ない | `enum` の直和と、エフェクトによる差し替え |
| 一般の union 型 | ない | `enum`。union はエラーの集合にだけ現れる |
| async / await | ない | 中断しうる操作も普通の呼び出しと同じ形で書く。並行は `Fiber` |
| 切り離された goroutine / daemon thread | ない | fiber は必ずスコープ（`Fiber.scope`）の中で起動し、スコープより先に終わる |
| 型クラス / interface | あり（`trait`） | 0.21 で入る予定 |
| 依存性の注入 | 言語にある | `effect`、`handler`、`layer`、`with` |
| リソースの後始末 | 言語にある | ハンドラの `init` と `release` |
| 文字列補間 | ある | `"#{name}"`。`+` で文字列はつなげない |
| ジェネリクス | ある | `fn map[A, B](xs: List[A], f: fn(A) -> B) -> List[B]` |

:::caution[0.21 で入る予定]
`trait`、`impl`、`derive` と、Trait の制約の検査は 0.21 で入ります。0.20 では `==` と文字列補間が、型の構造をそのまま見て全部の型で動きます。`Map`、`Set`、`Array` と JSON の Encode / Decode も 0.21 です。
:::

## 2つの層

Emela の機能は、日常のコードで使うものと、ライブラリや境界を書く人が使うものに分かれています。

| 層 | 含まれるもの |
|---|---|
| 日常 | `type` `enum` `error` `fn` `match` `use` `with` `fail` `escape` |
| 基盤 | `effect` `handler` `layer` `suspend` `trait` `impl`、`fails` 節と `use` 節、`@external` |

アプリケーションを書くときは、上の段だけで足りるように作ってあります。エフェクトやハンドラは標準ライブラリにあるもの（`Console`、`Clock`、`Http` など）をまず使い、自分の境界（データベースや外部サービス）を宣言するときに下の段に降ります。

## 言語ごとのページ

| ページ | 中心になる対応 |
|---|---|
| [TypeScript と Effect-TS から](/from/typescript/) | `Effect<A, E, R>`、`Effect.gen`、`Context.Tag` と `Layer`、`catchTag`、Fiber と Scope |
| [Gleam から](/from/gleam/) | ほぼ同じ構文の中の違い。後置の match、`use` の意味、Result がないこと |
| [Kotlin から](/from/kotlin/) | data class と sealed class、null 安全、例外、coroutine と structured concurrency |
| [Scala から](/from/scala/) | case class と enum、for 内包、given、ZIO と Cats Effect |
| [Rust から](/from/rust/) | struct と enum、`Result` と `?`、trait、async、所有権がないこと |
| [Go から](/from/go/) | `if err != nil`、interface、goroutine と errgroup、context のキャンセル |
| [Python から](/from/python/) | 動的型と推論、例外、クラス、`with` 文、asyncio |
| [C / C++ から](/from/c-cpp/) | struct と union、ポインタと null、エラーコードと例外、RAII、C ターゲットと `@external(c, ...)` |
| [Java から](/from/java/) | record と sealed interface、検査例外、DI とモック、try-with-resources、StructuredTaskScope |
| [Ruby から](/from/ruby/) | nil、ブロックと Enumerable、raise と rescue、オープンクラスがないこと、Fiber と Ractor |

言語そのものを最初から順に知りたいときは [Emela のツアー](/start/tour/) から、規則を詳しく知りたいときは [ガイド](/guide/basics/) から読んでください。

## 気をつけるところ

- 名前の大文字と小文字に意味があります。変数と関数は `snake_case`、型・構成子・エフェクト・モジュールは `PascalCase` です。`HTTP` は型名に使えず、`Http` と書きます。
- 文は改行で終わり、セミコロンはありません。
- `match` は後置です（`x match { ... }`）。前置で書くとエラー（E0142）になります。
- `use X` は import ではなく、エフェクト X の能力の値を取り出す式です。
- 能力の値（`use X` の値）は、引数に渡す、データに入れる、返すのどれもできません。使わせたいときはクロージャを渡します。
- `main` の R は空でなければなりません。使うエフェクトは `main` の中の `with` で全部供給します。標準のハンドラは `Std.Platform` の `Platform` にまとまっています。
