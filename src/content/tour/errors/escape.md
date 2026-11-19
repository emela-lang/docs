---
title: escape
description: エラーを受け止めて、普通の値に戻す
order: 3
---

`式 escape { 腕 }` は、式の評価中に起きたエラーを受け止めます。腕の書き方は `match` と同じで、パターンにはエラーの構成子を書きます。

`name_or_guest` は、`find_name` が `NotFound` で失敗したら `"guest"` を返します。エラーを受け止めたので、`name_or_guest` はもう失敗しません。`-> String` と書けるのはそのためです。

腕では、エラーのフィールドも取り出せます。`main` の2つ目の `escape` は `NotFound(id:)` で `id` を取り出し、メッセージに使っています。

腕の結果は、元の式と同じ型にします。`find_name` は `String` を返すので、腕も `String` を返します。

> **試してみよう**
> `name_or_guest` の `escape { ... }` を消して、コンパイラが何と言うか見てください。

```emela check tour
error NotFound(id: Int)

fn find_name(names: List[String], id: Int) -> String fails NotFound {
  List.get(names, id) match {
    Some(name) -> name
    None       -> fail NotFound(id:)
  }
}

fn name_or_guest(names: List[String], id: Int) -> String {
  find_name(names, id) escape {
    NotFound(_) -> "guest"
  }
}

fn main() {
  names = ["alice", "bob"]
  dbg(name_or_guest(names, 1))
  dbg(name_or_guest(names, 5))
  message = find_name(names, 9) escape {
    NotFound(id:) -> "no user #{id}"
  }
  dbg(message)
  ()
}
```

```console
$ emela run main.emel
"bob"
"guest"
"no user 9"
```
