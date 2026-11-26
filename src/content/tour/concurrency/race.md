---
title: race と timeout
description: 最初に終わったものを採る、時間を区切って待つ
order: 4
---

待ちを重ねるだけでなく、先に終わったほうを採ることもできます。

- `Task.race(fs)` は関数のリストを並行に実行し、最初に終わったものの結果を返す。残りは中断する
- `Task.timeout(ms, f)` は `f` を `ms` ミリ秒まで待つ。間に合えば `Some(結果)`、間に合わなければ `f` を中断して `None`

右の `race` では、100 ミリ秒の `mirror b` が先に終わります。300 ミリ秒の `mirror a` は中断されるので、`got mirror a` は出ません。

`timeout` は 150 ミリ秒で区切っています。500 ミリ秒かかる `slow` は間に合わずに `None`、50 ミリ秒の `quick` は間に合って `Some("quick")` です。待ち時間は `Clock` で測るので、`Clock` のハンドラを差し替えればテストで本当に待つ必要はありません。

時間切れを失敗として扱いたいときは、3章の `Option.or_fail` で `None` をエラーに変えます。

> **試してみよう**
> `Task.timeout(150, ...)` の `150` を `600` にして、`slow` が間に合うようにしてください。

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
    first = Task.race([|| fetch("mirror a", 300), || fetch("mirror b", 100)])
    console.print_line("race: #{first}")
    slow = Task.timeout(150, || fetch("slow", 500))
    console.print_line("timeout: #{slow}")
    quick = Task.timeout(150, || fetch("quick", 50))
    console.print_line("timeout: #{quick}")
  }
}
```

```console
$ emela run main.emel
got mirror b
race: mirror b
timeout: None
got quick
timeout: Some("quick")
```
