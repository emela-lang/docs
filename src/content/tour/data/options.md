---
title: Option
description: null の代わりに、値があるかないかを型で表す
order: 5
---

Emela には null がありません。値がないかもしれないときは `Option[A]` 型を使います。値があれば `Some(値)`、なければ `None` です。

`List.find` は条件に合う最初の要素を探します。見つからないこともあるので、戻り値は `Option[String]` です。`Option[String]` は `String` とは別の型なので、中身を使うには「ないとき」をどうするか決めなければなりません。決め忘れはコンパイルエラーになります。

- `match` で `Some(name)` と `None` を場合分けする
- `Option.or(opt, 既定値)` で、ないときの値を決める
- `Option.map(opt, f)` で、あるときだけ中身を変換する

`find_user` は `match` で場合分けし、`main` は `Option.or` と `Option.map` を使っています。

これで2章は終わりです。値がない場合を型で表すのと同じように、Emela では失敗する場合も型で表します。次の章ではそれを見ます。

> **試してみよう**
> `greeting(find_user(users, "a"))` の `"a"` を `"z"` に変えてみてください。

```emela check tour
fn find_user(users: List[String], prefix: String) -> Option[String] {
  List.find(users, |name| String.starts_with(name, prefix))
}

fn greeting(user: Option[String]) -> String {
  user match {
    Some(name) -> "Hello, #{name}!"
    None       -> "Nobody here."
  }
}

fn main() {
  users = ["alice", "bob"]
  dbg(find_user(users, "b"))
  dbg(find_user(users, "z"))
  dbg(greeting(find_user(users, "a")))
  dbg(find_user(users, "z") |> Option.or("guest"))
  dbg(find_user(users, "b") |> Option.map(String.to_ascii_uppercase))
  ()
}
```

```console
$ emela run main.emel
Some("bob")
None
"Hello, alice!"
"guest"
Some("BOB")
```
