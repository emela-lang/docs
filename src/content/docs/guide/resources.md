---
title: 状態と資源
description: フィールドを持つハンドラ、init と release、layer、State エフェクト、能力の持ち出し
---

接続やファイルのような資源は、フィールドを持つハンドラで扱います。`init` が with に入るときに資源を開き、`release` が with を抜けるときに必ず閉じます。値は不変なので、書き換える状態は State エフェクトに置きます。

```emela check
import Std.Console.{Console, SystemConsole}

effect Config {
  fn prefix() -> String
}

effect Store {
  fn get(key: String) -> String
}

handler EnvConfig implements Config {
  fn prefix() { "v1" }
}

handler MemoryStore(prefix: String) implements Store {
  init {
    prefix = (use Config).prefix()
    (use Console).print_line("open store #{prefix}")
    MemoryStore(prefix:)
  }

  release {
    (use Console).print_line("close store #{self.prefix}")
  }

  fn get(key) { "#{self.prefix}/#{key}" }
}

fn main() {
  with SystemConsole, EnvConfig, MemoryStore {
    store = use Store
    (use Console).print_line(store.get("alice"))
    (use Console).print_line(store.get("bob"))
  }
}
```

```console
$ emela run main.emel
open store v1
v1/alice
v1/bob
close store v1
```

## init と release

状態を持つハンドラは名前の後ろにフィールドを宣言します（`handler MemoryStore(prefix: String)`）。フィールドは操作や release の中で `self.prefix` のように参照します。フィールドは不変なので、呼ぶたびに変わる状態は後で説明する State に置きます。

`init` は with に入るときに1回実行され、ハンドラの値を返します。フィールドのあるハンドラには必ず書きます。`release` は with を抜けるときに1回実行され、本体が値で終わっても、エラー、defect、中断で終わっても必ず走ります。フィールドのないハンドラにも `init` と `release` を書けます。

次の例では本体が `Boom` で失敗しますが、release が先に走ってから escape がエラーを受けます。

```emela check
import Std.Console.{Console, SystemConsole}

error Boom

effect Store {
  fn get(key: String) -> String
}

handler MemoryStore(prefix: String) implements Store {
  init {
    (use Console).print_line("open")
    MemoryStore(prefix: "v1")
  }
  release {
    (use Console).print_line("close")
  }
  fn get(key) { "#{self.prefix}/#{key}" }
}

fn main() {
  with SystemConsole {
    r = with MemoryStore {
      (use Console).print_line("body")
      if True { fail Boom }
      "unreachable"
    } escape {
      Boom -> "recovered"
    }
    (use Console).print_line(r)
  }
}
```

```console
$ emela run main.emel
open
body
close
recovered
```

### ハンドラの値を作れる場所

ハンドラの値（`MemoryStore(prefix: ...)`）を作れるのは、そのハンドラの init の中だけです。外で作れると、init と release を飛ばせてしまいます。

```emela check=error
effect Counter {
  fn next() -> Int
}

handler Fixed(n: Int) implements Counter {
  init { Fixed(n: 1) }
  fn next() { self.n }
}

fn make() { Fixed(n: 2) }
```

```text
handler `Fixed` can only be constructed in its own `init`
  = help: use `with Fixed { ... }`; `init` and `release` run there
```

ハンドラは引数を取りません。設定を外から渡すときは、最初の例の `Config` のようなエフェクトを init で use します。

### 依存と初期化の順序

init、release、操作の本体で `use` したエフェクトが、そのハンドラの依存です。依存は with の外側のハンドラか、同じ with で先に初期化されたハンドラが満たします。`with H1, ..., Hn { 本体 }` はハンドラを依存の順に並べて init を順に実行し、本体を評価してから、逆の順に release を実行します。

途中の init が失敗すると、初期化の済んだハンドラだけを逆順に release し、本体は評価しません。with はその init のエラーで終わるので、escape で受けられます。

```emela check
import Std.Console.{Console, SystemConsole}

error ConnectFailed(url: String)

effect Config {
  fn url() -> String
}

effect Db {
  fn query(sql: String) -> String
}

handler EnvConfig implements Config {
  init {
    (use Console).print_line("init config")
    EnvConfig
  }
  release { (use Console).print_line("release config") }
  fn url() { "db://down" }
}

handler LocalDb(url: String) implements Db {
  init {
    url = (use Config).url()
    if url == "db://down" { fail ConnectFailed(url:) }
    LocalDb(url:)
  }
  release { (use Console).print_line("disconnect") }
  fn query(sql) { sql }
}

fn main() {
  with SystemConsole {
    with EnvConfig, LocalDb {
      (use Console).print_line("body")
    } escape {
      ConnectFailed(url:) -> (use Console).print_line("cannot connect to #{url}")
    }
  }
}
```

```console
$ emela run main.emel
init config
release config
cannot connect to db://down
```

### release は失敗できない

release はエラーで終われません。失敗しうる後始末は release の中で escape して受けるか、`panic` で defect にします。

## layer

layer はハンドラの束に名前を付ける宣言です。

```emela check
import Std.Console.{Console, SystemConsole}

effect Config {
  fn url() -> String
}

effect Db {
  fn query(sql: String) -> String
}

effect Cache {
  fn get(key: String) -> String
}

handler EnvConfig implements Config {
  init {
    (use Console).print_line("init config")
    EnvConfig
  }
  release { (use Console).print_line("release config") }
  fn url() { "db://local" }
}

handler LocalDb(url: String) implements Db {
  init {
    url = (use Config).url()
    (use Console).print_line("connect #{url}")
    LocalDb(url:)
  }
  release { (use Console).print_line("disconnect #{self.url}") }
  fn query(sql) { "#{sql} @ #{self.url}" }
}

handler DbCache implements Cache {
  init {
    (use Console).print_line("init cache")
    DbCache
  }
  release { (use Console).print_line("release cache") }
  fn get(key) { (use Db).query("get #{key}") }
}

layer AppLive {
  DbCache
  LocalDb
  EnvConfig
}

handler TestConfig implements Config {
  fn url() { "db://test" }
}

fn main() {
  with SystemConsole, AppLive {
    (use Console).print_line((use Cache).get("a"))
  }
  with SystemConsole, AppLive, TestConfig {
    (use Console).print_line((use Cache).get("b"))
  }
}
```

```console
$ emela run main.emel
init config
connect db://local
init cache
get a @ db://local
release cache
disconnect db://local
release config
connect db://test
init cache
get b @ db://test
release cache
disconnect db://test
```

layer の中にはハンドラか、別の layer を並べます。並び順は意味を持たず、初期化の順序はコンパイラが依存から決めます。上の例では `DbCache` を先に書いていますが、操作が Db を使うので LocalDb の後に初期化されます。

with に書いた layer は中のハンドラに展開してから並べられます。一部だけ差し替えるときは、`with AppLive, TestConfig { ... }` のように後ろに並べます。上書きされた EnvConfig は初期化もされないので、2回目の実行では `init config` が出ていません。

layer の中で満たされない依存はエラーにならず、with の R に残ります。そのため、一部の依存を外から与える layer も書けます。main とテストでは R が空でなければならないので、そこで供給を忘れるとエラーになります。

```emela
layer Storage {
  DbCache
  LocalDb      # init で Config を use している
}

fn main() {
  with SystemConsole, Storage { ... }    # Config が供給されていない
}
```

### Platform

同梱のホスト用のハンドラ（SystemConsole、SystemClock、SystemRandom、SystemEnv、SystemFileSystem、SystemHttp）は、`Std.Platform` の layer `Platform` にまとめてあります。`main` はふつう `with Platform { ... }` と書きます。

```emela check
import Std.Platform.{Platform}
import Std.Console.{Console}

fn main() {
  with Platform {
    (use Console).print_line("hi")
  }
}
```

一部を差し替えるときは `with Platform, MyClock { ... }` と後ろに並べます。Http を使わないプログラムなら、Http の注釈のないターゲットでも `with Platform` のままビルドできます（[外部関数](/guide/external/)）。個々のハンドラは[標準ライブラリ](/std/platform/)を見てください。

## State

可変な状態は同梱のエフェクト `State[S]`（`Std.State`）で表します。状態の置き場所は `State.run` の枠で、値そのものは不変のままです。

```emela
pub effect State[S] {
  fn get() -> S
  fn set(value: S) -> ()
  fn update(f: fn(S) -> S) -> ()
}

pub fn run[S, A, E, R](
  initial: S,
  body: fn() -> A fails E use { State[S], R },
) -> (A, S) fails E use R
```

```emela check
import Std.State.{State}

fn count_words(words: List[String]) {
  st = use State[Int]
  List.map(words, fn(w) { st.update(fn(n) { n + 1 }) })
  st.get()
}

fn main() {
  (result, final) = State.run(10, fn() { count_words(["a", "b", "c"]) })
  dbg(result)    # 13
  dbg(final)     # 13
}
```

`State.run(initial, body)` は、初期値 initial の状態を供給して body を実行し、body の値と最後の状態の組を返します。body の R から `State[S]` が消えるので、外からは純粋に見えます。`count_words` を呼んでも、`main` の R には何も残りません。

状態の型 S は body の R の `State[...]` から決まるので、`State.run([], ...)` の `[]` の要素の型も推論されます。`update` の一息での実行や、中断をまたぐときの扱いは [State・Fiber・Deferred](/std/state-fiber/) にあります。

### body が失敗したとき

body が失敗すると、状態を捨ててエラーだけが伝わります。失敗の時点の状態も欲しいときは、body の中で escape して値に変えます。

```emela check
import Std.State.{State}

error TooMany(n: Int)

fn push(x: Int) {
  st = use State[List[Int]]
  st.set(List.append(st.get(), [x]))
  if List.length(st.get()) > 2 { fail TooMany(n: x) }
}

fn main() {
  # 外で受けると、状態は残らない
  r1 = State.run([], fn() {
    push(1)
    push(2)
    push(3)
  }) escape {
    TooMany(n:) -> ((), [n])
  }
  dbg(r1)    # ((), [3])

  # body の中で受けると、そこまでの状態が残る
  r2 = State.run([], fn() {
    push(1)
    push(2)
    push(3) escape { TooMany(_) -> () }
  })
  dbg(r2)    # ((), [1, 2, 3])
}
```

### 同じ型の状態を2つ持つ

`State[Int]` を2つ並べると区別できません。別の型で包みます。

```emela check
import Std.State.{State}

type Hits(n: Int)
type Misses(n: Int)

fn look(key: String) {
  if key == "a" {
    (use State[Hits]).update(fn(h) { Hits(n: h.n + 1) })
  } else {
    (use State[Misses]).update(fn(m) { Misses(n: m.n + 1) })
  }
}

fn main() {
  ((_, misses), hits) = State.run(Hits(n: 0), fn() {
    State.run(Misses(n: 0), fn() {
      List.map(["a", "b", "a"], look)
    })
  })
  dbg(hits)      # Hits(n: 2)
  dbg(misses)    # Misses(n: 1)
}
```

[ラベル](/guide/labels/)（`effect Hits of State[Int]`）でも区別できます。

### State に依存するハンドラ

状態を使うハンドラは State に依存するハンドラとして書きます。同梱のテスト用ハンドラ（TestConsole、TestClock、TestFileSystem、TestHttp）はこの形です。

```emela check
import Std.State.{State}

effect Logger {
  fn info(msg: String) -> ()
}

handler RecordingLogger implements Logger {
  fn info(msg) {
    st = use State[List[String]]
    st.set(List.append(st.get(), [msg]))
  }
}

fn greet(name: String) {
  (use Logger).info("hello #{name}")
}

fn main() {
  (_, lines) = State.run([], fn() {
    with RecordingLogger {
      greet("alice")
      greet("bob")
    }
  })
  dbg(lines)    # ["hello alice", "hello bob"]
}
```

`State.run` が外側、`with RecordingLogger` が内側です。RecordingLogger の依存 `State[List[String]]` を、外の `State.run` が満たします。テストでの使い方は[テスト](/guide/testing/)で扱います。

## 能力を with の外へ持ち出さない

能力の値と、それを捕まえたクロージャは、供給元の with の外へ出せません。外へ出たクロージャを呼ぶと、release 済みのハンドラを使うことになるためです。

```emela check
import Std.Console.{Console, SystemConsole}

effect Logger {
  fn info(msg: String) -> ()
}

handler FileLogger(name: String) implements Logger {
  init { FileLogger(name: "app.log") }
  release { () }
  fn info(msg) { (use Console).print_line("#{self.name}: #{msg}") }
}

handler QuietLogger implements Logger {
  fn info(msg) { () }
}

fn make_greeter() {
  with FileLogger {
    log = use Logger
    fn() { log.info("hi") }    # log を抱えたまま with の外に出る
  }
}

fn main() {
  with SystemConsole, QuietLogger {
    greet = make_greeter()
    greet()
  }
}
```

```console
$ emela run main.emel
defect: handler FileLogger was used after release
```

:::caution[0.22 で静的に検査する予定]
仕様では、上の `make_greeter` はコンパイルの時点でエラーになります。コンパイラが、値がどの能力を抱えているかを型とともに追跡し（capture set）、with の本体の値がその with の供給した能力を抱えていれば止めます。capture set は推論され、ソースには書きません。

0.20 と 0.21 では、この検査を実行時に行います。release 済みのハンドラの操作を呼ぶと `handler <名前> was used after release` の defect になります。この検査が掛かるのは、フィールド、init、release のどれかを持つハンドラだけです。状態を持たないハンドラは、with の外へ持ち出しても動きます。
:::

能力の値そのものを返す、引数に渡す、データに入れるのは、今もコンパイル時に止まります（[エフェクトとハンドラ](/guide/effects/)）。with の中で使い終わるクロージャ（`List.map(names, fn(n) { log.info(n) })`）は問題ありません。Scope の能力、fiber のハンドル、Deferred の持ち出しも同じ考え方で防ぎます（[並行処理](/guide/concurrency/)）。
