---
title: fiber の失敗
description: 1つが失敗すると、残りは中断される
order: 3
---

並行に進めている fiber の1つが失敗すると、残りの fiber は中断され、全体がそのエラーで失敗します。失敗した後で残りの結果を待ち続けることはありません。

右の `fetch("posts", 100)` は 100 ミリ秒後に `Offline` で失敗します。このとき `fetch("user", 300)` はまだ待っている途中なので、そこで中断されます。`got user` は、その後 400 ミリ秒待っても出ません。

`Fiber.both` のエラーは、普通の関数のエラーと同じように `escape` で受け止められます。`fetch` の `Offline` は、`Fiber.both(...)` 全体のエラーとして型に載っています。

> **試してみよう**
> `fetch` の `if name == "posts"` を `if name == "nobody"` に変えて、どちらも成功したときの出力を見てください。

```emela check tour
import Std.Clock.{Clock}
import Std.Console.{Console}
import Std.Fiber.{Fiber}
import Std.Platform.{Platform}

error Offline(name: String)

fn fetch(name: String, ms: Int) -> String fails Offline {
  (use Clock).sleep(ms)
  if name == "posts" { fail Offline(name:) }
  (use Console).print_line("got #{name}")
  name
}

fn main() {
  with Platform {
    console = use Console
    pair = Fiber.both(|| fetch("user", 300), || fetch("posts", 100)) escape {
      Offline(name:) -> ("?", "#{name} is offline")
    }
    console.print_line("#{pair}")
    (use Clock).sleep(400)
    console.print_line("done")
  }
}
```

```console
$ emela run main.emel
("?", "posts is offline")
done
```
