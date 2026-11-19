---
title: type
description: フィールドを持つ型を定義し、値を作り、一部だけ変えた値を作る
order: 1
---

`type 名前(フィールド: 型, ...)` で、いくつかの値をまとめた型を定義します。同じ名前の構成子もできて、`User(id: 1, name: "alice", admin: False)` のように呼ぶと値ができます。

フィールドは `alice.name` のように読みます。値は変わらないので、フィールドを書き換えることはできません。代わりに `User(admin: True, ..alice)` と書くと、`admin` だけを変えた新しい値ができます。元の `alice` はそのままです。

型の宣言の後ろの `derive Show, Eq` は、文字列にする方法（Show）と `==` で比べる方法（Eq）を、フィールドから自動で作ります。`dbg` は derive がなくても値を表示できますが、`==` を使うには Eq が要ります。

> **試してみよう**
> `derive Show, Eq` を消して、どの行がエラーになるか見てください。

```emela check tour
type User(id: Int, name: String, admin: Bool) derive Show, Eq

fn main() {
  alice = User(id: 1, name: "alice", admin: False)
  promoted = User(admin: True, ..alice)

  dbg(alice.name)
  dbg(promoted)
  dbg(alice == promoted)
  dbg("#{alice}")
  ()
}
```

```console
$ emela run main.emel
"alice"
User(id: 1, name: "alice", admin: True)
False
"User(id: 1, name: \"alice\", admin: False)"
```
