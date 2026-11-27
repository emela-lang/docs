---
title: エフェクトの別名と uses
description: 関数が使うエフェクトは型の一部になる
order: 2
---

関数がどのエフェクトを使うかは、その関数の型の一部です。エラーの `fails` と並んで、`uses { Greeter }` と書きます。

- `uses` を省くと、本体から推論される。`welcome_all` は `welcome` を呼ぶので、`Greeter` を使うと推論される
- `uses { Greeter }` と書くと、その集合に決まる。ほかのエフェクトは使えない
- `uses {}` と書くと、どのエフェクトも使わない関数になる。`shout` は文字列を変えるだけで、外には何も頼まない

`main` が使えるエフェクトは、`main` の中の `with` で渡したものだけです。どこかで `Greeter` を使うのに `with` で渡し忘れると、コンパイルエラーになります。実行してから気付くことはありません。

`greeter <- Greeter` は値を作らず、`Greeter` に `greeter` という別名を付けるだけの文です。`greeter.greet(name)` を呼んだ時点で、いちばん内側の `Greeter` のハンドラが働き、関数の R に `Greeter` が載ります。

> **試してみよう**
> `shout` の本体を `greeter <- Greeter` と `greeter.greet(text)` の2行に変えてみてください。もう1つ、`main` の `with English` を外して `dbg(...)` だけにしたときのエラーも見てください。

```emela check tour
effect Greeter {
  fn greet(name: String) -> String
}

handler English: Greeter {
  fn greet(name) { "Hello, #{name}!" }
}

fn welcome(name: String) -> String uses { Greeter } {
  greeter <- Greeter
  greeter.greet(name)
}

fn welcome_all(names: List[String]) {
  List.map(names, welcome)
}

fn shout(text: String) -> String uses {} {
  String.to_ascii_uppercase(text)
}

fn main() {
  with English {
    dbg(welcome_all(["alice", "bob"]) |> List.map(shout))
  }
  ()
}
```

```console
$ emela run main.emel
["HELLO, ALICE!", "HELLO, BOB!"]
```
