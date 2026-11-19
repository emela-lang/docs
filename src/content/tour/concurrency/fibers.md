---
title: 待ちを重ねる
description: Fiber.both と Fiber.map で、いくつもの処理を並行に進める
order: 2
---

`Std.Fiber` の関数を使うと、いくつもの処理を並行に進められます。並行に進む1つ1つを fiber と呼びます。

- `Fiber.both(f, g)` は2つの関数を並行に実行し、結果を組で返す
- `Fiber.map(xs, f)` は各要素に `f` を並行に適用し、結果を元の順で返す
- `Fiber.all(fs)` は関数のリストを並行に実行し、結果を元の順で返す

右の `Fiber.both` は 300 ミリ秒と 100 ミリ秒の待ちを重ねるので、全体は約 300 ミリ秒で終わります。終わった順に `got ...` が出ますが、結果の組は渡した順です。`Fiber.map` も同じで、出力は短い順、結果のリストは元の順に並びます。

`fetch` は fiber のことを何も知りません。並行に動かすかどうかは呼ぶ側が決めます。

fiber は1つのスレッドの上で交代で動きます。交代が起きるのは `sleep` のような待つ操作のところだけなので、待たずに計算するだけの処理を fiber に分けても速くはなりません。

> **試してみよう**
> `Fiber.both(...)` を使わずに `fetch("user", 300)` と `fetch("posts", 100)` を順に呼んで、出力の順と待つ時間を比べてください。

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
    (user, posts) = Fiber.both(|| fetch("user", 300), || fetch("posts", 100))
    console.print_line("both: #{user}, #{posts}")
    names = Fiber.map([300, 100, 200], |ms| fetch("#{ms}ms", ms))
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
