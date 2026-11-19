---
title: いくつものエラー
description: エラーの集合を | で並べ、一部だけ受け止める
order: 4
---

関数が何種類かのエラーで失敗しうるときは、`fails NotFound | Banned` のように `|` で並べます。`login` は、名前が見つからなければ `NotFound` で、禁止された名前なら `Banned` で失敗します。2つの関数を呼んでいるので、エラーも2つの集合を合わせたものになります。

`escape` の腕は、全部のエラーについて書かなくてかまいません。受け止めたエラーは集合から消え、残りはそのまま呼び出し元へ伝わります。`login_or_guest` は `NotFound` だけを受け止めるので、エラーは `Banned` と推論されます。そのため `main` まで届いた `Banned` でプログラムが止まります。

腕の書き方はほかにもあります。

- 腕の中で `fail` すると、別のエラーに変えられる（`Banned(name:) -> fail Forbidden(reason: name)`）
- 腕のパターンを `_` にすると、どのエラーでも受け止める。エラーの中身は捨てる

> **試してみよう**
> `login_or_guest` の `escape` に `Banned(_) -> "nobody"` の腕を足してください。

```emela check tour
error NotFound(id: Int)
error Banned(name: String)
  derive Show

fn find_name(names: List[String], id: Int) -> String fails NotFound {
  List.get(names, id) match {
    Some(name) -> name
    None       -> fail NotFound(id:)
  }
}

fn check(name: String) -> String fails Banned {
  if name == "mallory" { fail Banned(name:) } else { name }
}

fn login(names: List[String], id: Int) -> String fails NotFound | Banned {
  check(find_name(names, id))
}

fn login_or_guest(names: List[String], id: Int) {
  login(names, id) escape {
    NotFound(_) -> "guest"
  }
}

fn main() {
  names = ["alice", "bob", "mallory"]
  dbg(login_or_guest(names, 0))
  dbg(login_or_guest(names, 9))
  dbg(login_or_guest(names, 2))
  ()
}
```

```console
$ emela run main.emel
"alice"
"guest"
error: Banned(name: "mallory")
```
