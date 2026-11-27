---
title: 待ちを重ねる
description: Task.both と Task.map で、いくつもの処理を並行に進める
order: 2
---

`Std.Task` の関数を使うと、いくつもの処理を並行に進められます。並行に進む1つ1つをタスクと呼びます。

- `Task.both(f, g)` は2つの関数を並行に実行し、結果を組で返す
- `Task.map(xs, f)` は各要素に `f` を並行に適用し、結果を元の順で返す
- `Task.all(fs)` は関数のリストを並行に実行し、結果を元の順で返す

右の `Task.both` は 300 ミリ秒と 100 ミリ秒の待ちを重ねるので、全体は約 300 ミリ秒で終わります。終わった順に `got ...` が出ますが、結果の組は渡した順です。`Task.map` も同じで、出力は短い順、結果のリストは元の順に並びます。

`fetch` はタスクのことを何も知りません。並行に動かすかどうかは呼ぶ側が決めます。

タスクは1つのスレッドの上で交代で動きます。交代が起きるのは `sleep` のような待つ操作のところだけなので、待たずに計算するだけの処理をタスクに分けても速くはなりません。

> **試してみよう**
> `Task.both(...)` を使わずに `fetch("user", 300)` と `fetch("posts", 100)` を順に呼んで、出力の順と待つ時間を比べてください。

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
    (user, posts) = Task.both(|| fetch("user", 300), || fetch("posts", 100))
    console.print_line("both: #{user}, #{posts}")
    names = Task.map([300, 100, 200], |ms| fetch("#{ms}ms", ms))
    console.print_line("map: #{names}")
  }
}
```

```console
$ emela run main.emel
got posts
got user
both: user, posts
got 100ms
got 200ms
got 300ms
map: ["300ms", "100ms", "200ms"]
```
