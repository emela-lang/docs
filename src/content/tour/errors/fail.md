---
title: error と fail
description: エラーを宣言し、fail で計算を止める
order: 1
---

`error` はエラーを宣言します。書き方は `type` と同じで、同じ名前の型と構成子ができます。`NotFound(id: 3)` は普通の値なので、`dbg` で表示することも、変数に入れることもできます。

`fail e` は、今の計算をエラー `e` で終わらせます。`find_name` はリストに `id` 番目の名前がないとき、`NotFound` で失敗します。`fail` はどんな型の場所にも置けるので、片方の腕が `fail` でも `match` 全体の型は `String` のままです。

失敗した計算は、呼び出し元へそのまま伝わっていきます。途中で受け止める書き方は後のページで見ます。誰も受け止めずに `main` まで届くと、プログラムは `error: エラーの値` を出して止まります。右のプログラムで最後の `dbg` が実行されないのはそのためです。

`derive Show` があると、止まったときにエラーのフィールドまで表示されます。

> **試してみよう**
> `derive Show` の行を消して、最後に出る行がどう変わるか見てください。

```emela check tour
error NotFound(id: Int)
  derive Show

fn find_name(names: List[String], id: Int) {
  List.get(names, id) match {
    Some(name) -> name
    None       -> fail NotFound(id:)
  }
}

fn main() {
  names = ["alice", "bob"]
  dbg(NotFound(id: 3))
  dbg(find_name(names, 1))
  dbg(find_name(names, 5))
  dbg("unreachable")
  ()
}
```

```console
$ emela run main.emel
NotFound(id: 3)
"bob"
error: NotFound(id: 5)
```
