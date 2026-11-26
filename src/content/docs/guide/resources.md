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

handler EnvConfig: Config {
  fn prefix() { "v1" }
}

handler MemoryStore(prefix: String): Store {
  init {
    config <- Config
    console <- Console
    prefix = config.prefix()
    console.print_line("open store #{prefix}")
    MemoryStore(prefix:)
  }

  release {
    console <- Console
    console.print_line("close store #{self.prefix}")
  }

  fn get(key) { "#{self.prefix}/#{key}" }
}

fn main() {
  console <- Console
  with SystemConsole, EnvConfig, MemoryStore {
    store <- Store
    console.print_line(store.get("alice"))
    console.print_line(store.get("bob"))
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

handler MemoryStore(prefix: String): Store {
  init {
    console <- Console
    console.print_line("open")
    MemoryStore(prefix: "v1")
  }
  release {
    console <- Console
    console.print_line("close")
  }
  fn get(key) { "#{self.prefix}/#{key}" }
}

fn main() {
  console <- Console
  with SystemConsole {
    r = with MemoryStore {
      console.print_line("body")
      if True { fail Boom }
      "unreachable"
    } escape {
      Boom -> "recovered"
    }
    console.print_line(r)
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

handler Fixed(n: Int): Counter {
  init { Fixed(n: 1) }
  fn next() { self.n }
}

fn make() { Fixed(n: 2) }
```

```text
handler `Fixed` can only be constructed in its own `init`
  = help: use `with Fixed { ... }`; `init` and `release` run there
```

init の中では、ハンドラの名前の代わりに `Self(...)` と書いても同じ値を作れます（フィールドのないハンドラなら `Self`）。

init は引数を取れます。`init(prefix: String) { MemoryStore(prefix:) }` と書き、with では `with MemoryStore(prefix: "v1") { ... }` のように渡します。引数は with に入る前、with の外で評価されます。設定をエフェクトから受け取るときは、最初の例の `Config` のように init で別名を付けて呼びます。

### 依存と初期化の順序

init、release、操作の本体で呼んだエフェクトが、そのハンドラの依存です。依存は with の外側のハンドラか、同じ with で先に初期化された名前のない項目のハンドラが満たします。`with H1, ..., Hn { 本体 }` はハンドラを依存の順に並べて init を順に実行し、本体を評価してから、逆の順に release を実行します。

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

handler EnvConfig: Config {
  init {
    console <- Console
    console.print_line("init config")
    EnvConfig
  }
  release {
    console <- Console
    console.print_line("release config")
  }
  fn url() { "db://down" }
}

handler LocalDb(url: String): Db {
  init {
    config <- Config
    url = config.url()
    if url == "db://down" { fail ConnectFailed(url:) }
    LocalDb(url:)
  }
  release {
    console <- Console
    console.print_line("disconnect")
  }
  fn query(sql) { sql }
}

fn main() {
  console <- Console
  with SystemConsole {
    with EnvConfig, LocalDb {
      console.print_line("body")
    } escape {
      ConnectFailed(url:) -> console.print_line("cannot connect to #{url}")
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

## ハンドラのメンバー

ファイルのように、1つのハンドラの下でいくつも開いては閉じる資源は、エフェクトのハンドラのメンバーで表します。`handler Open(path: String): ReadFile` は操作ではなく、「このエフェクトのハンドラはみな、ReadFile を実装する Open という内側のハンドラを持つ」という宣言です。

```emela check
import Std.Console.{Console, SystemConsole}

error FileMissing(path: String)

effect ReadFile {
  fn read() -> String
}

effect Files {
  handler Open(path: String): ReadFile fails FileMissing
}

handler MemoryFiles: Files {
  handler Open(path: String): ReadFile {
    init(path: String) {
      if path == "missing.txt" { fail FileMissing(path:) }
      console <- Console
      console.print_line("open #{path}")
      Self(path:)
    }
    release {
      console <- Console
      console.print_line("close #{self.path}")
    }
    fn read() { "contents of #{self.path}" }
  }
}

fn concat(a: use ReadFile, b: use ReadFile) -> String { "#{a.read()} + #{b.read()}" }

fn main() {
  with SystemConsole, MemoryFiles {
    console <- Console
    with a = Files.Open("a.txt"), b = Files.Open("b.txt") {
      console.print_line(concat(a, b))
    }
    with c = Files.Open("missing.txt") {
      console.print_line(c.read())
    } escape {
      FileMissing(path:) -> console.print_line("no #{path}")
    }
  }
}
```

```console
$ emela run main.emel
open a.txt
open b.txt
contents of a.txt + contents of b.txt
close b.txt
close a.txt
no missing.txt
```

- メンバーの引数は内側のハンドラの init の引数で、`fails` はその init の E です。
- with では `x = Files.Open(引数)` の形で開きます。最も内側で Files を供給するハンドラの Open の init が走り、x はその能力の値になります。with を抜けるときに release が走ります。能力の値 `fs: use Files` からは `fs.Open(引数)` で開けます。
- メンバーで開いたエフェクトは名前では供給されません。束縛した x を通してだけ使います。同じ with に `Files.Open` を2つ並べても、a と b はそれぞれのファイルを指します。
- 実装する側は、メンバーと同じ名前の内側のハンドラを書きます。括弧の中はそのフィールドで、init はメンバーと同じ名前と型の引数を取ります。内側のハンドラが使うエフェクト（上の Console）は外側のハンドラ（MemoryFiles）の依存になります。
- init の中でもメンバーを式として開けます（`first = Files.Open(path)`）。開いたハンドラは、開いた側のハンドラが release された後に、開いた順の逆に release されます。開いた能力は `use ReadFile` 型のフィールドに持てます。
- `suspend handler Open(...)` と宣言したメンバーは、開くときと閉じるときに中断できます（[中断する操作](/guide/suspend/)）。
- [ラベル](/guide/labels/)も元のエフェクトのメンバーを持ちます（`x = AuditFiles.Open(path)`）。

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

handler EnvConfig: Config {
  init {
    console <- Console
    console.print_line("init config")
    EnvConfig
  }
  release {
    console <- Console
    console.print_line("release config")
  }
  fn url() { "db://local" }
}

handler LocalDb(url: String): Db {
  init {
    config <- Config
    console <- Console
    url = config.url()
    console.print_line("connect #{url}")
    LocalDb(url:)
  }
  release {
    console <- Console
    console.print_line("disconnect #{self.url}")
  }
  fn query(sql) { "#{sql} @ #{self.url}" }
}

handler DbCache: Cache {
  init {
    console <- Console
    console.print_line("init cache")
    DbCache
  }
  release {
    console <- Console
    console.print_line("release cache")
  }
  fn get(key) {
    db <- Db
    db.query("get #{key}")
  }
}

layer AppLive {
  DbCache
  LocalDb
  EnvConfig
}

handler TestConfig: Config {
  fn url() { "db://test" }
}

fn main() {
  console <- Console
  cache <- Cache
  with SystemConsole, AppLive {
    console.print_line(cache.get("a"))
  }
  with SystemConsole, AppLive, TestConfig {
    console.print_line(cache.get("b"))
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
  LocalDb      # init で Config を使っている
}

fn main() {
  with SystemConsole, Storage { ... }    # Config が供給されていない
}
```

### Platform と Process

同梱のホスト用のハンドラは2つの layer にまとめてあります。

| layer | 中身 | 要るホストのエフェクト |
|---|---|---|
| `Platform`（`Std.Platform`） | SystemConsole、SystemClock、SystemRandom、SystemHttp | Async |
| `Process`（`Std.Process`） | Platform と SystemArgs、SystemStdin、SystemStdout、SystemStderr、SystemEnv、SystemFileSystem | Async、ProcessHost |

Process の中のハンドラは、ホストが OS のプロセスであること（ProcessHost）を求めます。`main` とテスト関数には ProcessHost が与えられるので、どちらも書けます。引数、標準入出力、環境変数、ファイルを使わないプログラムは `with Platform { ... }` と書きます。

```emela check
import Std.Platform.{Platform}
import Std.Console.{Console}

fn main() {
  console <- Console
  with Platform {
    console.print_line("hi")
  }
}
```

引数と標準出力を使うときは Process を書きます。Args はプログラム名を除いた引数を返し、Stdout と Stderr は改行を足さずに書く `print` を持ちます。人に読ませる行は Console、パイプやファイルに流すデータとプロンプトは Stdout と使い分けます。

```emela check
import Std.Console.{Console}
import Std.Process.{Process, Args, Stdout}

fn main() {
  args <- Args
  console <- Console
  with Process {
    names = args.list()
    out <- Stdout
    out.print("hello")
    List.map(names, |n| out.print(", #{n}"))
    out.print_line("")
    console.print_line("#{List.length(names)} names")
  }
}
```

```console
$ emela run main.emel -- alice bob
hello, alice, bob
2 names
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
  body: fn() -> A fails E uses { State[S], R },
) -> (A, S) fails E uses { R }
```

```emela check
import Std.State.{State}

fn count_words(words: List[String]) {
  st <- State[Int]
  List.map(words, |w| st.update(|n| n + 1))
  st.get()
}

fn main() {
  (result, final) = State.run(10, || count_words(["a", "b", "c"]))
  dbg(result) # 13
  _ = dbg(final) # 13
}
```

`State.run(initial, body)` は、初期値 initial の状態を供給して body を実行し、body の値と最後の状態の組を返します。body の R から `State[S]` が消えるので、外からは純粋に見えます。`count_words` を呼んでも、`main` の R には何も残りません。

状態の型 S は body の R の `State[...]` から決まるので、`State.run([], ...)` の `[]` の要素の型も推論されます。`update` の一息での実行や、中断をまたぐときの扱いは [State と Task](/std/state-task/) にあります。

### body が失敗したとき

body が失敗すると、状態を捨ててエラーだけが伝わります。失敗の時点の状態も欲しいときは、body の中で escape して値に変えます。

```emela check
import Std.State.{State}

error TooMany(n: Int)

fn push(x: Int) {
  st <- State[List[Int]]
  st.set(List.append(st.get(), [x]))
  if List.length(st.get()) > 2 { fail TooMany(n: x) }
}

fn main() {
  # 外で受けると、状態は残らない
  r1 = State.run([], || {
    push(1)
    push(2)
    push(3)
  }) escape {
    TooMany(n:) -> ((), [n])
  }
  dbg(r1) # ((), [3])

  # body の中で受けると、そこまでの状態が残る
  r2 = State.run([], || {
    push(1)
    push(2)
    push(3) escape { TooMany(_) -> () }
  })
  _ = dbg(r2) # ((), [1, 2, 3])
}
```

### 同じ型の状態を2つ持つ

`State[Int]` を2つ並べると区別できません。別の型で包みます。

```emela check
import Std.State.{State}

type Hits(n: Int)
type Misses(n: Int)

fn look(key: String) {
  hits <- State[Hits]
  misses <- State[Misses]
  if key == "a" {
    hits.update(|h| Hits(n: h.n + 1))
  } else {
    misses.update(|m| Misses(n: m.n + 1))
  }
}

fn main() {
  ((_, misses), hits) = State.run(Hits(n: 0), || {
    State.run(Misses(n: 0), || {
      List.map(["a", "b", "a"], look)
    })
  })
  dbg(hits) # Hits(n: 2)
  _ = dbg(misses) # Misses(n: 1)
}
```

[ラベル](/guide/labels/)（`effect Hits of State[Int]`）でも区別できます。

### State に依存するハンドラ

状態を使うハンドラは State に依存するハンドラとして書きます。同梱のテスト用ハンドラ（TestConsole、TestClock、TestStdout など）はこの形です。

```emela check
import Std.State.{State}

effect Logger {
  fn info(msg: String) -> ()
}

handler RecordingLogger: Logger {
  fn info(msg) {
    st <- State[List[String]]
    st.set(List.append(st.get(), [msg]))
  }
}

fn greet(name: String) {
  logger <- Logger
  logger.info("hello #{name}")
}

fn main() {
  (_, lines) = State.run([], || {
    with RecordingLogger {
      greet("alice")
      greet("bob")
    }
  })
  _ = dbg(lines) # ["hello alice", "hello bob"]
}
```

`State.run` が外側、`with RecordingLogger` が内側です。RecordingLogger の依存 `State[List[String]]` を、外の `State.run` が満たします。テストでの使い方は[テスト](/guide/testing/)で扱います。

## 能力を with の外へ持ち出さない

能力は、with の項目のハンドラが init を終えてから release されるまでの間だけあります。能力の値と、それを抱えた値（捕まえたクロージャや、能力を入れたデータ）は、その能力を作った with の外へ出せません。外へ出たクロージャを呼ぶと、release 済みのハンドラを使うことになるためです。

```emela check=error
import Std.Console.{Console, SystemConsole}

effect Logger {
  fn info(msg: String) -> ()
}

handler FileLogger(name: String): Logger {
  init { FileLogger(name: "app.log") }
  release { () }
  fn info(msg) {
    console <- Console
    console.print_line("#{self.name}: #{msg}")
  }
}

fn make_greeter() {
  with log = FileLogger {
    || log.info("hi") # log を抱えたまま with の外に出る
  }
}

fn main() {
  with SystemConsole {
    greet = make_greeter()
    greet()
  }
}
```

```text
error[E4405]: capability `log` leaves the `with` that made it
```

- 能力の値の操作を呼ぶと、R にはその能力そのもの（`log`）が載ります。`|| log.info("hi")` の型は `fn() -> () uses { log }` です。
- with の本体の値の型、本体から出るエラーの型、with の R のどれかにその with が作った能力が残ると、E4405 のエラーです。どの経路で外へ出ようとしても、能力は型と R に残るので、コンパイラが止めます。
- 能力の値そのものを返したり、データに入れて返したりしても同じです。with の中で引数に渡す、データに入れる、クロージャで捕まえるのはかまいません（[エフェクトとハンドラ](/guide/effects/)）。with の中で使い終わるクロージャ（`List.map(names, |n| log.info(n))`）も問題ありません。

別名はどのハンドラにも固定されないので、別名を使うクロージャは with の外へ出せます。そのクロージャのエフェクトは型の R に残り、呼んだ場所のハンドラが供給します。

```emela check
import Std.Console.{Console, SystemConsole}

effect Logger {
  fn info(msg: String) -> ()
}

handler FileLogger(name: String): Logger {
  init { FileLogger(name: "app.log") }
  release { () }
  fn info(msg) {
    console <- Console
    console.print_line("#{self.name}: #{msg}")
  }
}

handler PlainLogger: Logger {
  fn info(msg) {
    console <- Console
    console.print_line(msg)
  }
}

fn make_greeter() {
  log <- Logger
  with FileLogger {
    || log.info("hi") # 型は fn() -> () uses { Logger }
  }
}

fn main() {
  with SystemConsole, PlainLogger {
    greet = make_greeter()
    greet()
  }
}
```

```console
$ emela run main.emel
hi
```

`greet()` は main の PlainLogger を使います。FileLogger は with を抜けたときに release 済みで、使われません。Task.Group の能力、Task、Deferred、Semaphore、Queue の持ち出しも同じ規則で防ぎます（[並行処理](/guide/concurrency/)）。
