---
title: scope と fork
description: スコープの中で fiber を起動し、終わりを待つ
order: 5
---

前のページまでの関数は、どれも `Fiber.scope` と `Fiber.fork` を使って Emela で書かれた普通の関数です。込み入った形のときは、この2つを直接使います。

- `Fiber.scope(|| 本体)` は fiber を起動できる範囲（スコープ）を作り、本体を実行する
- `Fiber.fork(|| 式)` はスコープの中で子の fiber を起動し、そのハンドルを返す
- `Fiber.join(ハンドル)` は子が終わるのを待ち、その結果を返す

`fork` した子は、親が次に待つ操作を呼んだときに動き始めます。右のプログラムで `forked` が最初に出るのはそのためです。

本体が値を返した時点でまだ動いている子は中断され、スコープは子がすべて止まってから戻ります。1000 ミリ秒待つ `ads` は誰も `join` しないので、`got ads` は出ないまま中断されます。fiber がスコープより長く生き残ることはありません。

これで5章は終わりです。最後の章では、ここまでで触れなかった言語の部分と、次に読むものを紹介します。

> **試してみよう**
> 本体の最後に `Fiber.join` を使って `ads` も待つように書き換えてください。

```emela check tour
import Std.Clock.{Clock}
import Std.Console.{Console}
import Std.Fiber.{Fiber}
import Std.Platform.{Platform}

fn fetch(name: String, ms: Int) -> String {
  (use Clock).sleep(ms)
  (use Console).print_line("got #{name}")
  name
}

fn main() {
  with Platform {
    console = use Console
    result = Fiber.scope(|| {
      user = Fiber.fork(|| fetch("user", 200))
      posts = Fiber.fork(|| fetch("posts", 100))
      Fiber.fork(|| fetch("ads", 1000))
      console.print_line("forked")
      "#{Fiber.join(user)} and #{Fiber.join(posts)}"
    })
    console.print_line(result)
  }
}
```

```console
$ emela run main.emel
forked
got posts
got user
user and posts
```
