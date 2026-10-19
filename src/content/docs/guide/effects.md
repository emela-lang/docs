---
title: エフェクトとハンドラ
description: effect と操作、use と能力の値、with による供給、handler、R の推論
---

副作用は `effect` で宣言した操作を通してしか起こせません。操作を呼ぶ関数は `use` で能力の値を取り出し、操作の中身は `handler` が実装し、どのハンドラを使うかは呼ぶ側が `with` で決めます。関数が使うエフェクトは、エラーの E と並んで型の一部（R）になります。

```emela check
import Std.Console.{Console, SystemConsole}

effect Logger {
  fn info(msg: String) -> ()
}

handler ConsoleLogger implements Logger {
  fn info(msg) { (use Console).print_line("[info] #{msg}") }
}

fn greet(name: String) {
  log = use Logger
  log.info("hello #{name}")
}

fn main() {
  with SystemConsole, ConsoleLogger {
    greet("alice")    # [info] hello alice
  }
}
```

`greet` はログをどこに書くかを知りません。知っているのは Logger を使うことだけで、それが型（R = `Logger`）に出ます。書き先は、呼ぶ側の `with` が決めます。

## エフェクトを宣言する

```emela
effect Logger {
  fn info(msg: String) -> ()
}

effect Clock {
  suspend fn sleep(ms: Int) -> ()
  fn now() -> Instant
}
```

操作には引数と戻り値の型を書きます。操作には `fn` と `suspend fn` の2種類があります。`fn` の操作はハンドラが値を返せば呼び出し元がすぐ続きを実行し、`suspend fn` の操作は呼び出し元を中断させることがあります。後者は[中断する操作](/guide/suspend/)で扱います。

操作が失敗しうるときは、宣言に `fails` を書きます。書かなければ、その操作は失敗しません。

```emela
error NotFound(id: Int)

effect Users {
  fn find(id: Int) -> User fails NotFound
}
```

ハンドラは宣言された範囲を超えて失敗できないので、ハンドラを差し替えても呼び出し側の E は変わりません。

## use で能力を取り出す

`use X` は、エフェクト X の能力の値を返す式です。操作はこの値を通して `log.info(...)` の形で呼びます。

```emela check
import Std.Console.{Console, SystemConsole}

effect Logger {
  fn info(msg: String) -> ()
}

handler ConsoleLogger implements Logger {
  fn info(msg) { (use Console).print_line("[info] #{msg}") }
}

fn greet(names: List[String]) {
  log = use Logger
  log.info("start")

  # 呼ばずに書くと関数の値になる
  info = log.info
  List.map(names, info)

  # その場で取り出して呼ぶ
  (use Logger).info("done")
}

fn main() {
  with SystemConsole, ConsoleLogger {
    greet(["alice", "bob"])
  }
}
```

```console
$ emela run main.emel
[info] start
[info] alice
[info] bob
[info] done
```

- 一度しか使わないなら `(use Logger).info(...)` と書けます。`Logger.info(...)` のようにエフェクト名で直接呼ぶ形はありません。
- `log.info` と呼ばずに書くと関数の値になり、`List.map` などに渡せます。
- 呼び出し側には副作用や中断を示す印（`await` や `!`）を付けません。

能力の値そのものは関数の引数に渡すことも、データ構造に入れることも、関数から返すこともできません。特定のハンドラの能力を別の関数に使わせたいときは、その能力を捕まえたクロージャを渡します。

```emela check
import Std.Console.{Console, SystemConsole}

effect Db {
  fn query(sql: String) -> List[String]
  fn execute(rows: List[String]) -> ()
}

handler PrimaryDb implements Db {
  fn query(sql) { ["primary row"] }
  fn execute(rows) { (use Console).print_line("primary <- #{rows}") }
}

handler ReplicaDb implements Db {
  fn query(sql) { ["replica row"] }
  fn execute(rows) { (use Console).print_line("replica <- #{rows}") }
}

fn copy(read: fn() -> List[String] use { Db }, write: fn(List[String]) -> () use { Db }) {
  write(read())
}

fn main() {
  with SystemConsole, PrimaryDb {
    primary = use Db
    with ReplicaDb {
      replica = use Db
      copy(fn() { replica.query("select *") }, fn(rows) { primary.execute(rows) })
    }
  }
}
```

```console
$ emela run main.emel
primary <- ["replica row"]
```

レプリカから読んでプライマリに書いています。クロージャを with の中で下の関数へ渡すのはかまいませんが、with の外へ持ち出すことはできません（[状態と資源](/guide/resources/)）。

## with でハンドラを供給する

```emela
with ConsoleLogger { greet("alice") }

with SystemConsole, ConsoleLogger { greet("alice") }
```

`with H { 本体 }` は、本体の中で H が実装するエフェクトを供給し、本体の値をそのまま返します。供給したエフェクトは本体の R から消えます。H にはハンドラのほか、[layer](/guide/resources/) や[ラベル](/guide/labels/)の項目も書けます。

同じ with に並べたハンドラの依存は、同じ with の別のハンドラが満たしてかまいません。`ConsoleLogger` は Console を使いますが、同じ with の `SystemConsole` が供給するので動きます。並び順は問わず、`with ConsoleLogger, SystemConsole` でもかまいません。同じエフェクトのハンドラを2つ並べたときは後ろが優先され、前のものは初期化もされません。

### どのハンドラが使われるか

`use X` は、書いた位置から見て最も内側の with のハンドラを指します。同じ関数の中に該当する with がなければ、呼び出し元から渡されたものを指します。

```emela check
import Std.Console.{Console, SystemConsole}

effect Logger {
  fn info(msg: String) -> ()
}

handler Outer implements Logger {
  fn info(msg) { (use Console).print_line("outer: #{msg}") }
}

handler Inner implements Logger {
  fn info(msg) { (use Console).print_line("inner: #{msg}") }
}

fn main() {
  with SystemConsole, Outer {
    outer = use Logger
    with Inner {
      (use Logger).info("a")    # inner: a
      outer.info("b")           # outer: b
    }
  }
  with SystemConsole, Outer, Inner {
    (use Logger).info("c")      # inner: c（後ろが優先）
  }
}
```

外側で取り出した `outer` は、内側の with で Logger が上書きされても Outer を指したままです。

無名関数の中の `use X` は、まず無名関数を囲む with（同じトップレベルの関数の中のもの）を見ます。囲む with がなければ、無名関数を呼んだ側のハンドラを指します。

```emela check
import Std.Console.{Console, SystemConsole}

effect Logger {
  fn info(msg: String) -> ()
}

handler Outer implements Logger {
  fn info(msg) { (use Console).print_line("outer: #{msg}") }
}

handler Inner implements Logger {
  fn info(msg) { (use Console).print_line("inner: #{msg}") }
}

fn main() {
  say = fn(m) { (use Logger).info(m) }    # 囲む with がない
  with SystemConsole, Outer {
    near = fn(m) { (use Logger).info(m) } # Outer に囲まれている
    with Inner {
      say("a")     # inner: a（呼んだ場所の Logger）
      near("b")    # outer: b
    }
  }
}
```

関数を受け取る関数の中で with を書いたとき、引数の関数の効果が型の上でどう扱われるかは[型と効果の体系](/reference/type-system/)にあります。

## handler で操作を実装する

```emela check
import Std.Console.{Console, SystemConsole}

error NotFound(id: Int)

type User(id: Int, name: String)

effect Users {
  fn find(id: Int) -> User fails NotFound
  fn count() -> Int
}

handler SampleUsers implements Users {
  fn find(id) {
    id match {
      1 -> User(id: 1, name: "alice")
      2 -> User(id: 2, name: "bob")
      _ -> fail NotFound(id:)
    }
  }
  fn count() { 2 }
}

fn main() {
  with SystemConsole, SampleUsers {
    users = use Users
    (use Console).print_line("#{users.count()} users")
    (use Console).print_line(users.find(2).name)
  }
}
```

- ハンドラは1つのエフェクトのすべての操作をちょうど1回ずつ実装します。
- 操作の引数と戻り値の型はエフェクトの宣言から決まるので、ハンドラには書きません。
- 操作の本体で使うエフェクト（`ConsoleLogger` の Console など）はハンドラの依存になり、with の場所で満たします。`with ConsoleLogger { ... }` だけでは Console が R に残り、`main` ではエラーになります。

フィールドを持つハンドラと、`init`、`release` は[状態と資源](/guide/resources/)で扱います。

## use 節で R を書く

関数が使うエフェクトの集合 R は、戻り値の型を書いていても常に推論されます。決まった集合に固定したいときは use 節を書きます。

```emela
fn greet(name: String) -> () use Logger { ... }
fn copy(...) -> () use { Db, Logger } { ... }
fn pure_part(x: Int) -> Int use {} { ... }
```

要素が1つなら `use Logger`、2つ以上なら `use { A, B }`、空なら `use {}` と書きます。use 節を書くと、本体がそこにないエフェクトを使ったときにエラーになります。引数の関数型での省略の意味はエラーの `fails` と同じで、`f: fn() -> ()` はどんな効果の関数でも受け取り、`use {}` を書けば効果のない関数に限ります。

`main` の R は Async を除いて空でなければなりません。使うエフェクトはすべて `main` の中の with で供給します。

```emela check=error
effect Logger {
  fn info(msg: String) -> ()
}

fn main() {
  (use Logger).info("x")
}
```

```text
effect `Logger` is not provided in `main`
```

Async は「後から再開される」ことを表す組み込みのエフェクトで、ランタイムが供給します（[中断する操作](/guide/suspend/)）。ふつうの `main` は `with Platform { ... }` と書いて、同梱のハンドラをまとめて供給します（[状態と資源](/guide/resources/)）。

## エフェクトの型引数

エフェクトは型引数を持てます。

```emela check
effect Store[S] {
  fn load() -> S
}

handler IntStore implements Store[Int] {
  fn load() { 42 }
}

handler NameStore implements Store[String] {
  fn load() { "alice" }
}

fn read_both() -> (Int, String) use { Store[Int], Store[String] } {
  ((use Store[Int]).load(), (use Store[String]).load())
}

fn main() {
  with IntStore, NameStore {
    dbg(read_both())    # (42, "alice")
  }
}
```

`Store[Int]` と `Store[String]` は別のエフェクトとして扱うので、同じ with に並べても上書きし合いません。`use Store[Int]` の型引数は省けません。ハンドラは `implements Store[Int]` のように具体的な型について実装します。同梱の `State[S]` がこの形です（[状態と資源](/guide/resources/)）。

## テストでハンドラを差し替える

本物のハンドラの代わりにテスト用のハンドラを with に書けば、モックの仕組みなしにテストできます。

```emela check
import Std.Console.{Console, SystemConsole}

error NotFound(id: Int)

type User(id: Int, name: String)

effect Users {
  fn find(id: Int) -> User fails NotFound
}

handler SampleUsers implements Users {
  fn find(id) {
    id match {
      1 -> User(id: 1, name: "alice")
      _ -> fail NotFound(id:)
    }
  }
}

fn greeting(id: Int) {
  user = (use Users).find(id) escape { NotFound(_) -> User(id: 0, name: "guest") }
  "Hello, #{user.name}!"
}

fn main() {
  with SystemConsole, SampleUsers {
    (use Console).print_line(greeting(1))
  }
}

handler NoUsers implements Users {
  fn find(id) { fail NotFound(id:) }
}

@test
fn unknown_users_are_guests() {
  with NoUsers {
    assert greeting(1) == "Hello, guest!"
  }
}
```

```console
$ emela test main.emel
running 1 test
test unknown_users_are_guests ... ok

test result: ok. 1 passed; 0 failed; 0 filtered out
```

`greeting` は1文字も変えていません。状態を記録するテスト用のハンドラ（TestConsole など）と `emela test` の使い方は[テスト](/guide/testing/)で扱います。
