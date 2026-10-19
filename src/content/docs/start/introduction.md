---
title: Emela とは
description: Emela がどういう言語か、何が嬉しいかを例で見る
---

Emela は、関数が起こしうるエラーと使う副作用が型に出る関数型言語です。型はコンパイラが推論するので、ふだんのコードには書きません。出力先は JavaScript、WebAssembly、C で、どのターゲットでも同じ結果を返すことを仕様で求めています。

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

`greeting` には型を書いていませんが、`NotFound` で失敗しうること、`Users` を使うことが型に載ります。`main` はその両方を片付けてから終わらなければなりません。エラーは `escape` で値に戻し、エフェクトは `with` でハンドラを渡して消します。

## 失敗の見落としをコンパイラが拾う

戻り値の型を `-> String` と書くと「失敗しない」という意味になります。中で `greeting` を呼んで `NotFound` を受けなければ、コンパイルが通りません。

```emela check=error
type User(id: Int, name: String)

error NotFound(id: Int)

effect Users {
  fn find(id: Int) -> User fails NotFound
}

fn greeting(id: Int) {
  user = (use Users).find(id)
  "Hello, #{user.name}!"
}

fn banner(id: Int) -> String use { Users } {
  greeting(id)
}

fn main() {}
```

```text
error: unhandled error `NotFound`
   = help: handle it with `escape`, or declare it with `fails`
```

どの関数がどのエラーで失敗するかを、例外の文書や実装を読まずに型から知れます。

## 実装はハンドラで差し替える

`Users` の実装は `with` に渡すハンドラで決まります。本番ではデータベースに問い合わせるハンドラを、テストでは `SampleUsers` のような手元のハンドラを渡します。`greeting` 自身は書き換えず、モックの仕組みも要りません。

## 決めてあること

次の点は設計の土台で、後の版でも変えません。

継続は one-shot で、中断した計算を再開できるのは1回までです。エラーはエフェクトとは別のチャネルで扱い、`fail` と `escape` はハンドラを通りません。ゼロ除算や `assert` の失敗は defect で、型に出ず `escape` でも受けられません。Result 型、`?` 演算子、try / catch もありません。

変数は不変で、同じ名前で束縛し直すことはできても再代入はありません。ループ構文もなく、繰り返しは再帰か `List.map` のような関数で書きます。高カインド型、部分型、null、暗黙の型変換、演算子の多重定義は持たず、値の不在は `Option` で表します。

## 0.1x からの作り直し

0.20 は 0.1x 系とは別の言語として作り直した版です。構文も型の体系も互換性はありません。capability を `uses` 節で追跡していた 0.1x の考え方は、エフェクトとハンドラ、型付きのエラーに置き換わりました。0.1x のコンパイラは emela リポジトリの `legacy` ブランチに残っています。0.1x 向けに書かれた記事やコードは、0.20 ではそのまま動きません。
