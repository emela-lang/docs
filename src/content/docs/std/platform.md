---
title: Process と Platform
description: ホストのハンドラを束ねる Platform と Process、Console と標準入出力、引数と終了コード、Clock、Instant と Duration、Random、Env
---

ホストに触れる機能は、どれもエフェクトとそのハンドラの組で提供されます。エフェクトは操作を宣言し、`System` で始まるハンドラがホストを使ってそれを実装します。`main` では、ハンドラを束ねた layer の `Platform` か `Process` を `with` で供給します。

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
    (use Console).print_line("took 200ms or more: #{Duration.to_milliseconds(elapsed) >= 200}")
  }
}
```

```console no-check
$ emela run main.emel
started at 2026-10-17T05:30:33.049Z
took 200ms or more: True
```

エフェクトとハンドラの仕組みは [エフェクト](/guide/effects/) に、layer の規則は [リソース](/guide/resources/) にあります。各モジュールの型と関数は API リファレンスの [Std.Platform](/std/api/std-platform/)、[Std.Process](/std/api/std-process/)、[Std.Console](/std/api/std-console/)、[Std.Clock](/std/api/std-clock/)、[Std.Instant](/std/api/std-instant/)、[Std.Duration](/std/api/std-duration/)、[Std.Random](/std/api/std-random/)、[Std.Env](/std/api/std-env/) にあります。

## Platform と Process

| layer | 中身 | 必要なもの | 書ける場所 |
|---|---|---|---|
| `Platform`（`Std.Platform`） | `SystemConsole`、`SystemClock`、`SystemRandom`、`SystemHttp` | Async | `main`、テスト、export する関数、ページ |
| `Process`（`Std.Process`） | Platform と、`SystemArgs`、`SystemStdin`、`SystemStdout`、`SystemStderr`、`SystemEnv`、`SystemFileSystem` | Async と ProcessHost | `main`、テスト、HTTP サービスの関数 |

Platform は、どのホストにもあるものだけを束ねます。引数、標準入出力、環境変数、ファイルはプロセスが要るので Process に入っています。`main` は、これらを使わなければ `with Platform { ... }`、使うなら `with Process { ... }` と書きます。ProcessHost はホストのエフェクトで、`main`、テスト、`Http.serve` に供給されます（[エフェクト](/guide/effects/)）。

一部を差し替えるときは、差し替えるハンドラを後ろに並べます。後に書いたハンドラが、同じエフェクトのハンドラを置き換えます。

```emela check
import Std.Platform.{Platform}
import Std.Console.{Console}
import Std.Clock.{Clock, TestClock}
import Std.Instant
import Std.State.{State}

fn main() {
  start = Instant.from_unix_milliseconds(1000)
  (_, end) = State.run(start, || {
    with Platform, TestClock {
      (use Clock).sleep(500)
      (use Console).print_line("woke at #{Instant.to_unix_milliseconds((use Clock).now())}")
    }
  })
  _ = dbg(Instant.to_unix_milliseconds(end))
}
```

```console
$ emela run main.emel
woke at 1500
1500
```

## 出力と入力

出力には2つの道があります。

- `Std.Console` の `Console` は、行を書くエフェクトです。`print_line` は標準出力に、`print_error_line` は標準エラーに、改行を付けて書きます。どのホストにもあるので Platform に入っています。
- `Std.Process` の `Stdout` と `Stderr` は、プロセスの標準出力と標準エラーそのものです。`print` は改行を付けずに、`print_line` は改行を付けて書きます。

どれも失敗せず、中断もしません。入力を読むのは `Stdin` で、プログラムの引数は `Args` が返します。`main` が `ExitCode` を返すと、プロセスはその終了コードで終わります。

```emela check
import Std.Process.{Process, Args, Stdin, Stdout, Stderr, InvalidInput, StdinFailure}
import Std.Process.{ExitCode, EXIT_SUCCESS, EXIT_FAILURE}

## 標準入力の行に番号を付けて書き、読んだ行の数を返す。
fn number_lines(n: Int) -> Int uses { Stdin, Stdout } {
  line = (use Stdin).read_line() escape {
    InvalidInput     -> None
    StdinFailure(..) -> None
  }
  line match {
    None -> n
    Some(text) -> {
      (use Stdout).print_line("#{n + 1}: #{text}")
      number_lines(n + 1)
    }
  }
}

fn main() -> ExitCode {
  with Process {
    args = (use Args).list()
    count = number_lines(0)
    (use Stderr).print_line("#{count} lines, arguments #{args}")
    if count == 0 { EXIT_FAILURE } else { EXIT_SUCCESS }
  }
}
```

```console
$ printf 'apple\nbanana\n' | emela run main.emel -- -v
1: apple
2: banana
2 lines, arguments ["-v"]
```

- `Args.list()` はプログラムの名前を含まない引数の並びで、`Args.get(i)` は `i` 番目（0 から）を Option で返します。
- `Stdin.read_line()` は行末（`\n` か `\r\n`）を除いた次の行を返し、入力の終わりで `None` を返します。`read_text()` は残りを全部返します。UTF-8 でない入力は `InvalidInput` です。
- 終了コードは `Process.exit_code(n)` で作ります。`n` は 0 から 255 で、範囲の外は defect です。`main` が `()` を返せば 0、エラーか defect で終われば 0 以外になります（[エラー](/guide/errors/)）。

### テスト用のハンドラ

`TestConsole`、`TestStdout`、`TestStderr`、`TestStdin` は、ホストの代わりに State を読み書きします。`State.run` は本体の値と最後の状態の組を返すので、書かれたものを確かめられます。

```emela check
import Std.Console.{Console, TestConsole}
import Std.Process.{Stdout, TestStdout, StdoutText}
import Std.State.{State}

fn greet(names: List[String]) {
  console = use Console
  List.each(names, |name| console.print_line("Hello, #{name}!"))
  console.print_error_line("done")
}

fn progress(steps: Int) -> () uses { Stdout } {
  List.each(List.range(0, steps), |_| (use Stdout).print("."))
  (use Stdout).print_line("ok")
}

@test
fn greets_everyone() {
  (_, lines) = State.run([], || with TestConsole { greet(["alice", "bob"]) })
  assert lines == ["Hello, alice!", "Hello, bob!"]
}

@test
fn prints_a_dot_per_step() {
  (_, out) = State.run(StdoutText(text: ""), || with TestStdout { progress(3) })
  assert out.text == "...ok\n"
}
```

`TestConsole` は `print_line` の行を `State[List[String]]` に足し、`print_error_line` の行は捨てます。`TestStdin` は `State[StdinLines]` の行を先頭から返します。

## Clock

`Std.Clock` の `Clock` は、待つこと（`sleep`）と、現在の時点（`now`）を表します。`sleep` は `suspend fn` で、呼んだ fiber だけを止めます。中断の仕組みは [中断と再開](/guide/suspend/) にあります。

`SystemClock` はホストのタイマーを待ち、待っている fiber が中断されるとタイマーを消します。`TestClock` は `State[Instant]` に置いた仮の時刻で動きます。

- `now` は状態の時刻を返します。
- `sleep(ms)` を呼んだ fiber は止まります。どの fiber も先に進めず、ホストの処理も残っていなくなると、一番早く起きる予定の時刻まで状態の時刻を進めて、その fiber を起こします。同じ時刻なら `sleep` を呼んだ順です。
- 実際の時間は待たないので、`Fiber.timeout` や `Fiber.race` を実際の時計と同じ順でテストできます。

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
  ((_, lines), end) = State.run(start, || {
    State.run([], || {
      with TestClock, TestConsole {
        Fiber.both(
          || {
            (use Clock).sleep(200)
            stamp("slow")
          },
          || {
            (use Clock).sleep(100)
            stamp("fast")
          },
        )
      }
    })
  })
  assert lines == ["fast at 100", "slow at 200"]
  assert Instant.to_unix_milliseconds(end) == 200
}

@test
fn times_out_without_waiting() {
  start = Instant.from_unix_milliseconds(0)
  (result, _) = State.run(start, || {
    with TestClock { Fiber.timeout(100, || (use Clock).sleep(1000)) }
  })
  assert result == None
}
```

## Instant と Duration

`Std.Instant` はある時点を、`Std.Duration` は時間の長さを表す値の型です。どちらも中身はミリ秒の Int64 で、opaque なのでモジュールの関数で作り、取り出します。Eq と Ord を持つので `==` や `<` で比べられ、早い方、短い方が小さくなります。

Instant は Unix エポック（1970-01-01T00:00:00Z）からのミリ秒で、閏秒は数えません。Duration は負の長さも表します。現在の時点は Clock の `now` が返します。`Instant.from_unix_milliseconds` は、テストで時刻を決めるときと、自分で Clock のハンドラを書くときに使います。

```emela check
import Std.Instant
import Std.Duration

fn main() {
  start = Instant.from_unix_milliseconds(0)
  later = Instant.add(start, Duration.minutes(90))
  dbg(Instant.to_string(later)) # "1970-01-01T01:30:00.000Z"
  dbg(Duration.to_string(Instant.since(start, later))) # "-5400000ms"
  dbg(Duration.to_seconds(Duration.milliseconds(-1500))) # -1
  _ = dbg(Duration.seconds(1) > Duration.milliseconds(999)) # True
}
```

整数のリテラルは、文脈が Int64 を求めれば Int64 になるので、`Duration.seconds(5)` と書けます。Int の変数を渡すときは `Int64.from_int` で変えます。Clock の `sleep` だけは Int のミリ秒を取ります。

## Random

`Std.Random` の `Random` は乱数源です。`int()` は Int の全域で、`float()` は 0 以上 1 未満で一様な値を返します。`SystemRandom` はホストの暗号論的に安全な乱数源を使います。範囲を決めた値は、操作の上にふつうの関数で作ります。

テスト用のハンドラは同梱していないので、決まった値を返すハンドラを自分で書きます。

```emela check
import Std.Random.{Random}

## 1 から 6 の目。
fn roll() -> Int uses { Random } {
  Float.floor((use Random).float() * 6.0) + 1
}

handler FixedRandom: Random {
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

`Std.Env` の `Env` は環境変数を読みます。操作は `get(name)` だけで、設定されていなければ `None`、空の値（`NAME=`）は `Some("")` です。`SystemEnv` は Process に入っています。テスト用のハンドラは Random と同じく自分で書きます。

```emela check
import Std.Env.{Env}

fn port() -> Int uses { Env } {
  text = (use Env).get("PORT") |> Option.or("8080")
  Int.parse(text) escape { ParseError(..) -> 8080 }
}

handler FakeEnv: Env {
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

FileSystem と Http は [FileSystem と Path](/std/file-system/) と [Http](/std/http/) にあります。
