---
title: Task.Group
description: with の項目でタスクを始め、終わりを待つ
order: 5
---

前のページまでの関数は、どれも `Task.Group` を使って Emela で書かれた普通の関数です。込み入った形のときは、これを直接使います。

- `with tasks = Task.Group { 本体 }` はタスクを始められる範囲（グループ）を作り、本体を実行する。`tasks` はタスクを始める能力
- `tasks.start(|| 式)` はグループの中でタスクを始め、`Task[A]` を返す
- `task.join()` はタスクが終わるのを待ち、その結果を返す

`start` したタスクは、始めた側が次に待つ操作を呼んだときに動き始めます。右のプログラムで `started` が最初に出るのはそのためです。

本体が値を返した時点でまだ動いているタスクは中断され、with はタスクがすべて止まってから値を返します。1000 ミリ秒待つ `ads` は誰も `join` しないので、`got ads` は出ないまま中断されます。タスクがそれを始めた with より長く生き残ることはありません。

これで5章は終わりです。最後の章では、ここまでで触れなかった言語の部分と、次に読むものを紹介します。

> **試してみよう**
> `tasks.start(|| fetch("ads", 1000))` の結果を `ads` に束縛し、本体の最後で `ads.join()` を呼んで `ads` も待つように書き換えてください。

```emela check tour
import Std.Clock.{Clock}
import Std.Console.{Console}
import Std.Platform.{Platform}
import Std.Task.{Task}

fn fetch(name: String, ms: Int) -> String {
  clock <- Clock
  console <- Console
  clock.sleep(ms)
  console.print_line("got #{name}")
  name
}

fn main() {
  console <- Console
  with Platform {
    result = with tasks = Task.Group {
      user = tasks.start(|| fetch("user", 200))
      posts = tasks.start(|| fetch("posts", 100))
      tasks.start(|| fetch("ads", 1000))
      console.print_line("started")
      "#{user.join()} and #{posts.join()}"
    }
    console.print_line(result)
  }
}
```

```console
$ emela run main.emel
started
got posts
got user
user and posts
```
