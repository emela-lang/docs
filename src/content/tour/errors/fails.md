---
title: fails
description: 関数が起こしうるエラーは型の一部になる
order: 2
---

関数がどのエラーで失敗しうるかは、その関数の型の一部です。`-> String fails NotFound` は「`String` を返すか、`NotFound` で失敗する」という意味です。

戻り値の型の書き方で、エラーの扱いが決まります。

- `-> String fails NotFound` と書くと、エラーはその集合に決まる。それ以外のエラーは起こせない
- `-> Int` だけを書くと、失敗しない関数になる。本体のエラーを受け止めていなければコンパイルエラー
- 戻り値の型を省くと、エラーも本体から推論される

`greet` は戻り値の型を省いています。中で `find_name` を呼んでいて、そのエラーを受け止めていないので、`greet` のエラーは `NotFound` と推論されます。エラーを伝えるだけなら、呼び出す側には何も書き足しません。

`count` は `-> Int` と書いているので、失敗しないことが型で保証されます。

> **試してみよう**
> `greet` に `-> String` と書き足して、コンパイラが何と言うか見てください。

```emela check tour
error NotFound(id: Int)
  derive Show

fn find_name(names: List[String], id: Int) -> String fails NotFound {
  List.get(names, id) match {
    Some(name) -> name
    None       -> fail NotFound(id:)
  }
}

fn greet(names: List[String], id: Int) {
  "Hello, #{find_name(names, id)}!"
}

fn count(names: List[String]) -> Int {
  List.length(names)
}

fn main() {
  names = ["alice", "bob"]
  dbg(count(names))
  dbg(greet(names, 0))
  dbg(greet(names, 2))
  ()
}
```

```console
$ emela run main.emel
2
"Hello, alice!"
error: NotFound(id: 2)
```
