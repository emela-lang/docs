---
title: タスクの失敗
description: 1つが失敗すると、残りは中断される
order: 3
---

並行に進めているタスクの1つが失敗すると、残りのタスクは中断され、全体がそのエラーで失敗します。失敗した後で残りの結果を待ち続けることはありません。

右の `fetch("posts", 100)` は 100 ミリ秒後に `Offline` で失敗します。このとき `fetch("user", 300)` はまだ待っている途中なので、そこで中断されます。`got user` は、その後 400 ミリ秒待っても出ません。

`Task.both` のエラーは、普通の関数のエラーと同じように `escape` で受け止められます。`fetch` の `Offline` は、`Task.both(...)` 全体のエラーとして型に載っています。

> **試してみよう**
> `fetch` の `if name == "posts"` を `if name == "nobody"` に変えて、どちらも成功したときの出力を見てください。

```emela check tour
import Std.Clock.{Clock}
import Std.Console.{Console}
import Std.Platform.{Platform}
import Std.Task.{Task}

error Offline(name: String)

fn fetch(name: String, ms: Int) -> String fails Offline {
  clock <- Clock
  console <- Console
  clock.sleep(ms)
  if name == "posts" { fail Offline(name:) }
  console.print_line("got #{name}")
  name
}

fn main() {
  console <- Console
  clock <- Clock
  with Platform {
    pair = Task.both(|| fetch("user", 300), || fetch("posts", 100)) escape {
      Offline(name:) -> ("?", "#{name} is offline")
    }
    console.print_line("#{pair}")
    clock.sleep(400)
    console.print_line("done")
  }
}
```

```console
$ emela run main.emel
("?", "posts is offline")
done
```
