---
title: Console・Clock・Random・Env
description: platform のエフェクト Console、Clock、Random、Env と、そのハンドラ、Instant と Duration、Platform
---

Console、Clock、Random、Env は、ホストの標準出力、時計、乱数源、環境変数をエフェクトとして表します。どれも操作を宣言したエフェクトと、ホストを使う `System*` のハンドラを同じモジュールに持ち、`Std.Platform` の `Platform` でまとめて供給できます。

```emela check
import Std.Platform.{Platform}
import Std.Console.{Console}
import Std.Clock.{Clock}
import Std.Instant
import Std.Duration

fn main() {
  with Platform {
    clock = use Clock
    start = clock.now()
    clock.sleep(200)
    elapsed = clock.now() |> Instant.since(start)
    (use Console).print_line("started at #{Instant.to_string(start)}")
    (use Console).print_line("took #{Duration.to_milliseconds(elapsed) >= 200}")
  }
}
```

```console
$ emela run main.emel
started at 2026-10-17T05:30:33.049Z
took True
```

エフェクトとハンドラの仕組みは [エフェクト](/guide/effects/) にあります。

## Console

`Std.Console` は、標準出力と標準エラーに1行ずつ書きます。

```emela
pub effect Console {
  fn print_line(text: String) -> ()
  fn print_error_line(text: String) -> ()
}
```

| 操作 | 説明 |
|---|---|
| `print_line(text: String) -> ()` | 標準出力に、改行を付けて書く |
| `print_error_line(text: String) -> ()` | 標準エラーに、改行を付けて書く |

どちらも失敗しません。改行なしで書く操作と、入力を読む操作はまだありません。

| ハンドラ | 依存 | 説明 |
|---|---|---|
| `SystemConsole` | なし | ホストの標準出力と標準エラー（JS の `console.log` と `console.error`、C の `stdout` と `stderr`）。状態を持たない |
| `TestConsole` | `State[List[String]]` | `print_line` の行を、書いた順に状態の末尾へ足す。`print_error_line` の行は捨てる |

TestConsole は状態を State に置くので、`State.run` の中で使います。`State.run` は本体の値と最後の状態の組を返すので、書かれた行を確かめられます。

```emela check
import Std.Console.{Console, TestConsole}
import Std.State.{State}

fn greet(names: List[String]) {
  console = use Console
  List.map(names, fn(name) { console.print_line("Hello, #{name}!") })
  console.print_error_line("done")
}

@test
fn greets_everyone() {
  (_, lines) = State.run([], fn() {
    with TestConsole { greet(["alice", "bob"]) }
  })
  assert lines == ["Hello, alice!", "Hello, bob!"]
}
```

## Clock

`Std.Clock` は、待つことと、現在の時点を返すことを表します。`sleep` は `suspend fn` で、呼んだ側を中断します。

```emela
pub effect Clock {
  suspend fn sleep(ms: Int) -> ()
  fn now() -> Instant
}
```

| 操作 | 説明 |
|---|---|
| `sleep(ms: Int) -> ()` | `ms` ミリ秒待つ。負の `ms` は 0 と同じ |
| `now() -> Instant` | 現在の時点 |

| ハンドラ | 依存 | 説明 |
|---|---|---|
| `SystemClock` | `Async` | `sleep` はホストのタイマー（JS の `setTimeout`、C ではランタイムのイベントループ）を待つ。待っている fiber が中断されるとタイマーを消す。`now` は Unix エポックからのミリ秒（JS の `Date.now()`） |
| `TestClock` | `Async`、`State[Instant]` | 状態に置いた仮の時刻で動く |

`main` やテスト関数では Async が供給されているので、そのまま `sleep` を呼べます。SystemClock も TestClock も Async に依存するので、外部関数のコールバックの中のような Immediate を求める場所では使えません。中断の仕組みは [中断と再開](/guide/suspend/) にあります。

### TestClock の仮の時刻

TestClock は状態の `Instant` を現在の時刻として使い、`now` はその時刻を返します。最初の時刻は `State.run` に渡します。

`sleep(ms)` を呼んだ fiber は止まります。どの fiber も先に進めず、ホストの処理も残っていなくなると、一番早く起きる予定の時刻まで状態の時刻を進めて、その fiber を起こします。同じ時刻なら `sleep` を呼んだ順です。fiber が1本なら、時刻が `ms` だけ進んですぐ続くのと同じで、実際の時間は待ちません。

複数の fiber が時刻の順に起きるので、`Fiber.timeout` や `Fiber.race` を実際の時計と同じ順でテストできます。

```emela check
import Std.Clock.{Clock, TestClock}
import Std.Console.{Console, TestConsole}
import Std.Fiber
import Std.Instant
import Std.State.{State}

fn stamp(label: String) {
  at = Instant.to_unix_milliseconds((use Clock).now())
  (use Console).print_line("#{label} at #{at}")
}

@test
fn wakes_in_time_order() {
  start = Instant.from_unix_milliseconds(0)
  ((_, lines), end) = State.run(start, fn() {
    State.run([], fn() {
      with TestClock, TestConsole {
        Fiber.both(fn() {
          (use Clock).sleep(200)
          stamp("slow")
        }, fn() {
          (use Clock).sleep(100)
          stamp("fast")
        })
      }
    })
  })
  assert lines == ["fast at 100", "slow at 200"]
  assert Instant.to_unix_milliseconds(end) == 200
}

@test
fn times_out_without_waiting() {
  start = Instant.from_unix_milliseconds(0)
  (result, _) = State.run(start, fn() {
    with TestClock {
      Fiber.timeout(100, fn() { (use Clock).sleep(1000) })
    }
  })
  assert result == None
}
```

## Instant と Duration

`Std.Instant` はある時点を、`Std.Duration` は時間の長さを表す値の型です。どちらも中身がミリ秒の Int64 の opaque な型で、構成子やフィールドには触れず、モジュールの関数で作って取り出します。

Instant は Unix エポック（1970-01-01T00:00:00Z）からのミリ秒で、閏秒は数えません。Duration は負の長さも表します。単位の変換と足し算のあふれは Int64 の規則で巻き戻ります。現在の時点は `Std.Instant` からは取れず、Clock の `now` が返します。

### Std.Instant

| 関数 | シグネチャ | 説明 |
|---|---|---|
| `from_unix_milliseconds` | `from_unix_milliseconds(ms: Int64) -> Instant` | Unix エポックから `ms` ミリ秒の時点。負ならエポックより前 |
| `to_unix_milliseconds` | `to_unix_milliseconds(t: Instant) -> Int64` | Unix エポックからのミリ秒 |
| `add` | `add(t: Instant, d: Duration) -> Instant` | `d` だけ後。`d` が負なら前 |
| `subtract` | `subtract(t: Instant, d: Duration) -> Instant` | `d` だけ前 |
| `since` | `since(t: Instant, earlier: Instant) -> Duration` | `earlier` から `t` までの長さ。`earlier` の方が後なら負 |
| `compare` | `compare(t: Instant, other: Instant) -> Ordering` | 早い方が小さい |
| `to_string` | `to_string(t: Instant) -> String` | UTC の ISO 8601（`2026-10-12T03:04:05.678Z`）。JS の `Date.prototype.toISOString` と同じ形で、0〜9999 年の外は符号と6桁（`+010000`） |

`from_unix_milliseconds` は、テストで時刻を固定するときと、自分で Clock のハンドラを書くときに使います。`now |> Instant.since(start)` のようにパイプで読めます。

### Std.Duration

| 関数 | シグネチャ | 説明 |
|---|---|---|
| `milliseconds` | `milliseconds(n: Int64) -> Duration` | `n` ミリ秒 |
| `seconds` | `seconds(n: Int64) -> Duration` | `n` 秒 |
| `minutes` | `minutes(n: Int64) -> Duration` | `n` 分 |
| `hours` | `hours(n: Int64) -> Duration` | `n` 時間 |
| `to_milliseconds` | `to_milliseconds(d: Duration) -> Int64` | ミリ秒の数 |
| `to_seconds` | `to_seconds(d: Duration) -> Int64` | 秒の数。端数は 0 の方向へ切り捨てる |
| `add` | `add(d: Duration, other: Duration) -> Duration` | 和 |
| `subtract` | `subtract(d: Duration, other: Duration) -> Duration` | 差。負になりうる |
| `compare` | `compare(d: Duration, other: Duration) -> Ordering` | 短い方が小さい |
| `to_string` | `to_string(d: Duration) -> String` | ミリ秒に `ms` を付けた形（`1500ms`） |

```emela check
import Std.Instant
import Std.Duration

fn main() {
  start = Instant.from_unix_milliseconds(0)
  later = Instant.add(start, Duration.minutes(90))
  dbg(Instant.to_string(later))                                     # "1970-01-01T01:30:00.000Z"
  dbg(Duration.to_string(Instant.since(start, later)))              # "-5400000ms"
  dbg(Duration.to_seconds(Duration.milliseconds(-1500)))            # -1
  dbg(Duration.compare(Duration.seconds(1), Duration.milliseconds(999))) # Greater
}
```

整数のリテラルは、文脈が Int64 を求めれば Int64 になるので、`Duration.seconds(5)` のように書けます。Int の変数を渡すときは `Int64.from_int` で変えます。Clock の `sleep` だけは Int のミリ秒を取ります。

## Random

`Std.Random` は乱数源を表します。

```emela
pub effect Random {
  fn int() -> Int
  fn float() -> Float
}
```

| 操作 | 説明 |
|---|---|
| `int() -> Int` | Int の全域で一様な値 |
| `float() -> Float` | 0 以上 1 未満で一様な値 |

| ハンドラ | 依存 | 説明 |
|---|---|---|
| `SystemRandom` | なし | ホストの暗号論的に安全な乱数源（JS の `crypto.getRandomValues`、C の `arc4random_buf` か `getrandom`）。状態を持たない |

どちらの操作も失敗しません。範囲を指定した値は操作の上に書くふつうの関数で作ります。種を渡せる擬似乱数は純粋な値と関数として別に用意する予定で、0.20 の std にはありません。

テスト用のハンドラは同梱していません。決まった値を返すハンドラを自分で書きます。

```emela check
import Std.Random.{Random}

## 1 から 6 の目。
fn roll() -> Int use Random {
  Float.floor((use Random).float() * 6.0) + 1
}

handler FixedRandom implements Random {
  fn int() { 4 }
  fn float() { 0.5 }
}

@test
fn rolls_with_a_fixed_source() {
  with FixedRandom {
    assert roll() == 4
  }
}
```

## Env

`Std.Env` は環境変数を読みます。

```emela
pub effect Env {
  fn get(name: String) -> Option[String]
}
```

| 操作 | 説明 |
|---|---|
| `get(name: String) -> Option[String]` | 環境変数の値。設定されていなければ `None`、空の値（`NAME=`）は `Some("")` |

| ハンドラ | 依存 | 説明 |
|---|---|---|
| `SystemEnv` | なし | ホストの環境変数（JS の `process.env`、C の `getenv`）。状態を持たない |

`get` は失敗しません。全部の変数を返す操作はまだありません。テスト用のハンドラは Random と同じく自分で書きます。

```emela check
import Std.Env.{Env}

fn port() -> Int use Env {
  text = (use Env).get("PORT") |> Option.or("8080")
  Int.parse(text) escape { ParseError(..) -> 8080 }
}

handler FakeEnv implements Env {
  fn get(name) {
    name match {
      "PORT" -> Some("3000")
      _      -> None
    }
  }
}

@test
fn reads_the_port() {
  with FakeEnv {
    assert port() == 3000
  }
}
```

## Platform

`Std.Platform` の `Platform` は、System のハンドラを全部束ねた layer です。

```emela
pub layer Platform {
  SystemConsole
  SystemClock
  SystemRandom
  SystemEnv
  SystemFileSystem
  SystemHttp
}
```

SystemClock、SystemFileSystem、SystemHttp が Async に依存するので、Platform も Async に依存します。`main` では Async が供給されているので、そのまま `with Platform { ... }` と書けます。

一部を差し替えるときは、差し替えるハンドラを後ろに並べます。後に書いたハンドラが同じエフェクトのハンドラを置き換えます。

```emela check
import Std.Platform.{Platform}
import Std.Console.{Console}
import Std.Clock.{Clock, TestClock}
import Std.Instant
import Std.State.{State}

fn main() {
  start = Instant.from_unix_milliseconds(1000)
  (_, end) = State.run(start, fn() {
    with Platform, TestClock {
      (use Clock).sleep(500)
      (use Console).print_line("woke at #{Instant.to_unix_milliseconds((use Clock).now())}")
    }
  })
  dbg(Instant.to_unix_milliseconds(end))
}
```

```console
$ emela run main.emel
woke at 1500
1500
```

FileSystem と Http のハンドラは [FileSystem と Path](/std/file-system/) と [Http](/std/http/) にあります。layer の規則は [リソース](/guide/resources/) を見てください。
