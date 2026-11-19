---
title: エラーと Option
description: Option とエラーを行き来する、どちらを使うか
order: 5
---

値がないことは `Option` でも、エラーでも表せます。

- ないことが普通の結果で、呼んだ側がその場で扱うなら `Option`。`List.find` や `List.get` がこれ
- 処理を続けられない失敗で、呼び出し元へ伝えたいならエラー

両者は行き来できます。`Option.or_fail(opt, e)` は、`Some(x)` なら `x` を返し、`None` ならエラー `e` で失敗します。`find_name` はこれで `match` を1行にしています。

逆向きは `Some(式) escape { エラー(_) -> None }` と書きます。成功したら `Some` で包み、失敗したら `None` にします。`try_find` は失敗しない関数になり、戻り値は `Option[String]` です。

これで3章は終わりです。失敗が型に表れるのと同じように、Emela では関数が外の世界に触るかどうかも型に表れます。次の章ではそれを見ます。

> **試してみよう**
> `try_find` の `escape { ... }` を消すと、失敗しないはずの関数にエラーが残ります。コンパイラの説明を読んでみてください。

```emela check tour
error NotFound(id: Int)
  derive Show

fn find_name(names: List[String], id: Int) -> String fails NotFound {
  List.get(names, id) |> Option.or_fail(NotFound(id:))
}

fn try_find(names: List[String], id: Int) -> Option[String] {
  Some(find_name(names, id)) escape {
    NotFound(_) -> None
  }
}

fn main() {
  names = ["alice", "bob"]
  dbg(find_name(names, 1))
  dbg(try_find(names, 1))
  dbg(try_find(names, 5))
  dbg(find_name(names, 5))
  ()
}
```

```console
$ emela run main.emel
"bob"
Some("bob")
None
error: NotFound(id: 5)
```
