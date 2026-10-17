---
title: エフェクトとハンドラ
description: effect と操作、use と能力の値、with による供給、handler、R の推論
---

Emela の副作用は、`effect` で宣言した操作を、`use` で取り出した能力の値を通して呼ぶことでしか起こせません。操作の実装は `handler` が持ち、`with` で供給します。関数が使うエフェクトは、エラーの E と並んで型の一部（R）になります。

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

`greet` はどこにログを書くかを知りません。知っているのは「Logger を使う」ことだけで、それが型（R = `Logger`）に出ます。書き先を決めるのは、呼ぶ側の `with` です。

## effect と操作

```emela
effect Logger {
  fn info(msg: String) -> ()
}

effect Clock {
  suspend fn sleep(ms: Int) -> ()
  fn now() -> Instant
}
```

- 操作には、引数と戻り値の型を書きます。
- 操作には `fn` と `suspend fn` の2種類があります。`fn` の操作は、ハンドラが値を返すと呼び出し元がすぐ続きを実行します。`suspend fn` の操作は呼び出し元を中断させることがあり、続きをいつ実行するかはハンドラが決めます。詳しくは[中断する操作](/guide/suspend/)で扱います。
- 操作には `use` 節を書けません（E0137）。操作の実装が別のエフェクトを使うときは、ハンドラの依存として with の場所で満たします（下の「handler」）。

### 操作の fails

操作が失敗しうるときは、宣言に `fails` を書きます。書かなければ、その操作は失敗しません。

```emela
error NotFound(id: Int)

effect Users {
  fn find(id: Int) -> User fails NotFound
}
```

ハンドラは宣言された範囲を超えて失敗できません。そのため、ハンドラを差し替えても呼び出し側の E は変わりません。

## use

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

- `use X` は式で、エフェクト X の能力の値を返します。関数の中のどこにでも書けます。
- 操作は、能力の値を通して `log.info(...)` の形でしか呼べません。エフェクト名で直接呼ぶ形（`Logger.info(...)`）はありません。一度しか使わないなら `(use Logger).info(...)` と書けます。
- 能力の値の操作を呼ぶと、R にそのエフェクトが、E に操作の `fails` が載ります。
- `use X` を含む関数の R には X が載ります。`if` の分岐の中に書いても、関数全体の R に載ります。
- 能力の値の操作を呼ばずに `log.info` と書くと、関数の値になります。能力の値はその位置で評価され、関数の値の型には Logger が載ります（能力を捕まえたクロージャと同じ）。
- 呼び出し側には、副作用や中断を示す印（`await` や `!`）を付けません。
- 能力の値のエフェクトにない操作を呼ぶと E0401 です。

### 渡せない、入れられない、返せない

能力の値は、関数の引数に渡すことも、データ構造に入れることも、関数から返すこともできません。値の最上位の型だけを見ます。

```emela check=error
effect Logger {
  fn info(msg: String) -> ()
}

fn log_twice(log: Int) { () }

fn pass() { log_twice(use Logger) }      # E0408: a capability cannot be passed as an argument
fn store() { [use Logger] }              # E0409: a capability cannot be stored in a data structure
fn give() {
  log = use Logger
  log                                    # E0410: a capability cannot be returned from a function
}
```

能力の値の型は、ソースに書けません。特定のハンドラの能力を関数に使わせたいときは、その能力を捕まえたクロージャを渡します。

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

能力の値を捕まえたクロージャの型にも、そのエフェクトが載ります。クロージャを with の中で下の関数へ渡すのはかまいませんが、with の外へ持ち出すことはできません（[状態と資源](/guide/resources/)）。

## with

```emela
with ConsoleLogger { greet("alice") }

with SystemConsole, ConsoleLogger { greet("alice") }
```

- `with H { 本体 }` は、本体の中で H が実装するエフェクトを供給します。値は本体の値です。
- H にはハンドラか [layer](/guide/resources/) を書きます。[ラベル](/guide/labels/)の項目も書けます。
- 供給したエフェクトは、本体の R から消えます。
- カンマで並べたとき、同じエフェクトについては後ろが優先されます。上書きされた前のハンドラは初期化もしません。
- 同じ with に並べたハンドラの依存は、同じ with の別のエフェクトを供給するハンドラが満たしてかまいません。並び順は問いません（`with ConsoleLogger, SystemConsole` でも動きます）。

### どのハンドラを指すか

`use X` は、書いた位置から見て最も内側の with が供給するハンドラを指します。同じ関数に該当する with がなければ、呼び出し元から渡されたものを指します。外側で取り出した能力の値は、内側の with で同じエフェクトが上書きされても、外側のハンドラを指し続けます。

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

### 無名関数の中の use

無名関数の中の `use X` は、まず無名関数を囲む with（同じトップレベルの関数の中のもの）を見ます。なければ、無名関数を呼んだ側から渡されたものを指します。無名関数の R は無名関数の型に閉じ込められ、囲む関数の R には載らないためです。

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

### 関数を受け取る関数の中の with

エラーの escape と同じく、中身の分からない効果の集合（引数の関数型の見えない集合など）からは、with は何も消しません。

```emela check=error
import Std.Console.{Console, SystemConsole}

effect Logger {
  fn info(msg: String) -> ()
}

handler ConsoleLogger implements Logger {
  fn info(msg) { (use Console).print_line(msg) }
}

# R は f の効果の集合のまま。Logger は消えない
fn run(f: fn() -> ()) { with ConsoleLogger { f() } }

fn hello() -> () use Logger { (use Logger).info("hi") }

fn main() {
  with SystemConsole { run(hello) }    # E0402: effect `Logger` is not provided in `main`
}
```

型の上でも消したいときは、供給するエフェクトを関数型に書き出します（`fails Timeout | E` と同じ考え方）。

```emela check
import Std.Console.{Console, SystemConsole}

effect Logger {
  fn info(msg: String) -> ()
}

handler ConsoleLogger implements Logger {
  fn info(msg) { (use Console).print_line(msg) }
}

fn run[R](f: fn() -> () use { Logger, R }) -> () use { Console, R } {
  with ConsoleLogger { f() }    # Logger は消え、R と ConsoleLogger の依存が残る
}

fn hello() -> () use Logger { (use Logger).info("hi") }

fn main() {
  with SystemConsole { run(hello) }    # hi
}
```

## handler

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

- ハンドラは宣言で、1つのエフェクトのすべての操作を、それぞれちょうど1回実装します。足りなければ E0404、2回書けば E0405 です。
- 操作の引数と戻り値の型は、エフェクトの宣言から決まるので書きません（書くと E0134）。引数の数は宣言と同じでなければなりません（E0406）。
- 操作の本体の E は、操作の宣言の `fails` に含まれなければなりません。宣言にないエラーを起こすと E0318 です。
- 操作の本体で使うエフェクト（上の `ConsoleLogger` の Console）は、ハンドラの依存になります。依存は with の場所で満たします。`with ConsoleLogger { ... }` だけだと R に Console が残り、`main` では E0402 になります。
- フィールドを持つハンドラ、`init` と `release` は[状態と資源](/guide/resources/)で扱います。

## R の推論と use 節

関数が使うエフェクトの集合 R は、常に推論されます。戻り値の型を書いていても推論します。書いて固定したいときは use 節を使います。

```emela
fn greet(name: String) -> () use Logger { ... }
fn copy(...) -> () use { Db, Logger } { ... }
fn pure_part(x: Int) -> Int use {} { ... }
```

- use 節を書くと、R がちょうどその集合であることを強制します。本体が use 節にないエフェクトを使うと E0402（``effect `Logger` is not declared in `use` ``）です。
- 要素が1つなら `use Logger`、2つ以上なら `use { A, B }`、空なら `use {}` と書きます。
- 引数の関数を呼んだときの効果（見えない集合変数）は、use 節に書かなくても足されます。
- 引数の関数型での省略の意味は fails と同じです。`f: fn() -> ()` はどんな効果を持っていてもよく、`use {}` を書けば効果のない関数に限ります。

### main の R は空

`main` の R は、Async を除いて空でなければなりません。使うエフェクトはすべて `main` の中の with で供給します。

```emela check=error
effect Logger {
  fn info(msg: String) -> ()
}

fn main() {
  (use Logger).info("x")    # E0402: effect `Logger` is not provided in `main`
}
```

- Async は「後から再開される」ことを表す組み込みのエフェクトで、ランタイムが供給します（[中断する操作](/guide/suspend/)）。
- `main` に use 節を書いていても、空を求めます。const の値の R も空です。
- ふつうの `main` は `with Platform { ... }` で、同梱のハンドラをまとめて供給します（[状態と資源](/guide/resources/)）。

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

- 型引数の違うエフェクトは、別のエフェクトとして扱います。R の中で `Store[Int]` と `Store[String]` は区別されます。with の「後ろが優先」も、型引数まで同じものだけに効きます。
- `use Store[Int]` の型引数は省略できません。書かなければ E0423（``missing type arguments for effect `Store[S]` ``）、数が違えば E0304 です。`use Store[S]` には、囲む fn の型引数を書けます。
- 型引数を持つエフェクトのハンドラは、具体的な型を書きます（`implements Store[Int]`）。どの型でも実装する汎用のハンドラはありません。
- 型引数はふつうの型に限ります。エラーや効果の集合にはできません（E0424）。利用者のエフェクトの操作に型引数（`fn wrap[A](...)`）は書けません（E0426）。
- 同梱のエフェクト `State[S]` がこの形です（[状態と資源](/guide/resources/)）。

## テストではハンドラを差し替える

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
