---
title: effect と handler
description: 操作を宣言し、ハンドラで実装し、with で選ぶ
order: 1
---

`effect` は、関数が外に頼む操作の一覧を宣言します。右の `Greeter` は `greet` という操作を1つ持ちます。宣言には引数と戻り値の型だけを書き、中身は書きません。

中身は `handler` が実装します。`handler 名前: エフェクト` と書き、そのエフェクトのすべての操作を実装します。`English` と `Pirate` は、同じ `greet` を別のやり方で実装しています。

操作を呼ぶには、`greeter <- Greeter` で `Greeter` に名前（エフェクトの別名）を付け、`greeter.greet(name)` と書きます。どのハンドラが使われるかは、呼ぶ側が `with ハンドラ { 本体 }` で決めます。`with` の本体の中では、`Greeter` の操作はそのハンドラが実行します。

`welcome` は `Greeter` を使うことだけを知っていて、どのハンドラかは知りません。`main` は同じ `welcome` を2つのハンドラで呼んでいます。

> **試してみよう**
> `handler` をもう1つ書いて、3つ目の `with` で `welcome` を呼んでください。

```emela check tour
effect Greeter {
  fn greet(name: String) -> String
}

handler English: Greeter {
  fn greet(name) { "Hello, #{name}!" }
}

handler Pirate: Greeter {
  fn greet(name) { "Ahoy, #{name}!" }
}

fn welcome(names: List[String]) -> List[String] {
  greeter <- Greeter
  List.map(names, |name| greeter.greet(name))
}

fn main() {
  names = ["alice", "bob"]
  with English {
    dbg(welcome(names))
  }
  with Pirate {
    dbg(welcome(names))
  }
  ()
}
```

```console
$ emela run main.emel
["Hello, alice!", "Hello, bob!"]
["Ahoy, alice!", "Ahoy, bob!"]
```
