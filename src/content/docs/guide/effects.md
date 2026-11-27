---
title: エフェクトとハンドラ
description: effect と操作、エフェクトの別名と能力の値、with による供給、handler、R の推論
---

副作用は `effect` で宣言した操作を通してしか起こせません。操作を呼ぶ関数は `x <- X` でエフェクトに名前を付け、操作の中身は `handler` が実装し、どのハンドラを使うかは呼ぶ側が `with` で決めます。関数が使うエフェクトは、エラーの E と並んで型の一部（R）になります。

```emela check
import Std.Console.{Console, SystemConsole}

effect Logger {
  fn info(msg: String) -> ()
}

handler ConsoleLogger: Logger {
  fn info(msg) {
    console <- Console
    console.print_line("[info] #{msg}")
  }
}

fn greet(name: String) {
  log <- Logger
  log.info("hello #{name}")
}

fn main() {
  with SystemConsole, ConsoleLogger {
    greet("alice") # [info] hello alice
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

## エフェクトの別名

`x <- X` は、エフェクト X の別名 x をブロックの残りで使えるようにする文です。操作は `x.op(...)` の形で呼びます。

```emela check
import Std.Console.{Console, SystemConsole}

effect Logger {
  fn info(msg: String) -> ()
}

handler ConsoleLogger: Logger {
  fn info(msg) {
    console <- Console
    console.print_line("[info] #{msg}")
  }
}

fn greet(names: List[String]) {
  log <- Logger
  log.info("start")

  # 呼ばずに書くと関数の値になる
  info = log.info
  List.map(names, info)

  log.info("done")
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

- 別名は値ではありません。`log.info(...)` が、呼んだ時点で X を名前で供給している最も内側のハンドラの操作を呼び、R に X を載せます。
- 別名を書けるのは `x.op(...)` と `x.op` の受け手だけです。引数に渡したり変数に入れたりするとエラー（E4404）です。
- `log.info` と呼ばずに書くと関数の値になり、`List.map` などに渡せます。X は、その関数の値を呼ぶたびに決まります。
- `Logger.info(...)` のようにエフェクト名で直接呼ぶ形はありません。
- 呼び出し側には副作用や中断を示す印（`await` や `!`）を付けません。

:::caution[`use X` は非推奨]
0.28 までは `log = use Logger` や `(use Logger).info(...)` と、式の `use X` で能力の値を取り出していました。0.29 では式の `use X` は非推奨の警告（W4401）になり、0.30 でエラーになります。`log <- Logger` に書き換えてください。型の `use X`（下の能力の型）はそのまま使えます。
:::

### 能力の値

特定のハンドラを別の関数に使わせたいときは、with の項目に名前を付けて `x = H` と書きます。x はその項目のハンドラの能力の値で、ほかの値と同じく関数の引数に渡すことも、データ構造に入れることも、関数から返すこともできます。能力の値の型は `use Db` と書きます。

```emela check
import Std.Console.{Console, SystemConsole}

effect Db {
  fn query(sql: String) -> List[String]
  fn execute(rows: List[String]) -> ()
}

handler PrimaryDb: Db {
  fn query(sql) { ["primary row"] }
  fn execute(rows) {
    console <- Console
    console.print_line("primary <- #{rows}")
  }
}

handler ReplicaDb: Db {
  fn query(sql) { ["replica row"] }
  fn execute(rows) {
    console <- Console
    console.print_line("replica <- #{rows}")
  }
}

fn copy(from: use Db, to: use Db) {
  to.execute(from.query("select *"))
}

fn main() {
  with SystemConsole, primary = PrimaryDb, replica = ReplicaDb {
    copy(replica, primary)
  }
}
```

```console
$ emela run main.emel
primary <- ["replica row"]
```

レプリカから読んでプライマリに書いています。

- `use Db` は型で、型を書ける場所ならどこにでも書けます。ハンドラのフィールドの型にもできます。
- 能力の値に呼べるのは、そのエフェクトの操作だけです。中身を調べる操作はなく、`==` も使えません。
- 能力の値の操作を呼ぶと、R にはエフェクトではなくその能力そのもの（`primary`）が載ります。能力の値は、それを作った with の外へ持ち出せません。持ち出すとエラー（E4405）です（[状態と資源](/guide/resources/#能力を-with-の外へ持ち出さない)）。

## with でハンドラを供給する

```emela
with ConsoleLogger { greet("alice") }

with SystemConsole, ConsoleLogger { greet("alice") }
```

`with H { 本体 }` は、本体の中で H が実装するエフェクトを供給し、本体の値をそのまま返します。供給したエフェクトは本体の R から消えます。H にはハンドラのほか、[layer](/guide/resources/) や[ラベル](/guide/labels/)の項目も書けます。

同じ with に並べたハンドラの依存は、同じ with の別のハンドラが満たしてかまいません。`ConsoleLogger` は Console を使いますが、同じ with の `SystemConsole` が供給するので動きます。並び順は問わず、`with ConsoleLogger, SystemConsole` でもかまいません。同じエフェクトのハンドラを2つ並べたときは後ろが優先され、前のものは初期化もされません。

項目は `x = H` の形でも書けます。本体の中で x はその項目のハンドラの能力の値になり、同じ with のほかの項目が同じエフェクトを供給していても、x はこの項目のハンドラを指します。名前を付けた項目は、エフェクトを名前では供給しません。本体が名前で使うエフェクト（別名や、本体が呼ぶ関数の R）は、外側の with か呼び出し元が供給します。同じ with のほかのハンドラの依存も満たしません。

### どのハンドラが使われるか

別名の操作は、呼んだ時点でそのエフェクトを名前で供給している最も内側の with のハンドラに届きます。同じ関数の中に該当する with がなければ、呼び出し元から渡されたものに届きます。名前を付けた項目の能力の値は、内側の with で同じエフェクトが上書きされても、その項目のハンドラを指したままです。

```emela check
import Std.Console.{Console, SystemConsole}

effect Logger {
  fn info(msg: String) -> ()
}

handler Outer: Logger {
  fn info(msg) {
    console <- Console
    console.print_line("outer: #{msg}")
  }
}

handler Inner: Logger {
  fn info(msg) {
    console <- Console
    console.print_line("inner: #{msg}")
  }
}

fn main() {
  log <- Logger
  with SystemConsole, outer = Outer {
    with Inner {
      log.info("a") # inner: a
      outer.info("b") # outer: b
    }
  }
  with SystemConsole, Outer, Inner {
    log.info("c") # inner: c（後ろが優先）
  }
}
```

無名関数と局所の fn の中の呼び出しは、その関数を呼んだ側が供給します。関数を作った場所を囲む with は使いません。無名関数が使うエフェクトは、その型の R に残り、呼ぶ場所で供給されます。

```emela check
import Std.Console.{Console, SystemConsole}

effect Logger {
  fn info(msg: String) -> ()
}

handler Outer: Logger {
  fn info(msg) {
    console <- Console
    console.print_line("outer: #{msg}")
  }
}

handler Inner: Logger {
  fn info(msg) {
    console <- Console
    console.print_line("inner: #{msg}")
  }
}

fn main() {
  log <- Logger
  with SystemConsole, Outer {
    say = |m| log.info(m) # Outer に囲まれているが、Outer は使わない
    with Inner {
      say("a") # inner: a（呼んだ場所の Logger）
    }
    say("b") # outer: b
  }
}
```

決まったハンドラを無名関数に使わせたいときは、名前を付けた項目の能力の値を無名関数で捕まえます。能力の値は、捕まえた先でもそのハンドラを指します。

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

handler SampleUsers: Users {
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
  console <- Console
  with SystemConsole, users = SampleUsers {
    console.print_line("#{users.count()} users")
    console.print_line(users.find(2).name)
  }
}
```

- ハンドラは `handler 名前: エフェクト` と書き、そのエフェクトのすべての操作をちょうど1回ずつ実装します。
- 操作の引数と戻り値の型はエフェクトの宣言から決まるので、ハンドラには書きません。
- 操作の本体で使うエフェクト（`ConsoleLogger` の Console など）はハンドラの依存になり、with の場所で満たします。`with ConsoleLogger { ... }` だけでは Console が R に残り、`main` ではエラーになります。

フィールドを持つハンドラと、`init`、`release`、ハンドラのメンバーは[状態と資源](/guide/resources/)で扱います。

### 1つのハンドラで複数のエフェクトを実装する

`handler H: A + B` と書くと、1つのハンドラで複数のエフェクトを実装できます。すべての操作が同じ `self` を共有し、init と release は1回ずつ走ります。

```emela check
import Std.Console.{Console, SystemConsole}

effect Query {
  fn query(sql: String) -> List[String]
}

effect Execute {
  fn execute(sql: String) -> ()
}

handler MemoryDb: Query + Execute {
  fn query(sql) { ["row 1", "row 2"] }
  fn execute(sql) {
    console <- Console
    console.print_line("execute: #{sql}")
  }
}

fn count_rows(db: use Query) -> Int { List.length(db.query("select *")) }

fn archive(db: use Query + Execute) {
  n = count_rows(db)
  db.execute("delete #{n} rows")
}

fn main() {
  with SystemConsole, db = MemoryDb {
    archive(db)
  }
}
```

```console
$ emela run main.emel
execute: delete 2 rows
```

- 複数のエフェクトの能力の値の型は `use Query + Execute` と書きます。`with db = MemoryDb` の db がこの型です。
- `use Query + Execute` の値は、エフェクトの少ない `use Query` の引数に渡せます。渡した先では Query の操作しか呼べず、Execute を取り戻す方法はありません。逆に、持っていないエフェクトを求める引数に渡すとエラー（E4403）です。
- 同じ名前の操作を持つ2つのエフェクトは並べられません（E4012）。
- [ラベル](/guide/labels/)の `L by H` では、H が実装するエフェクトのうち L の元のエフェクトが使われます。

## uses 節で R を書く

関数が使うエフェクトの集合 R は、戻り値の型を書いていても常に推論されます。決まった集合に固定したいときは uses 節を書きます。

```emela
fn greet(name: String) -> () uses { Logger } { ... }
fn copy(...) -> () uses { Db, Logger } { ... }
fn pure_part(x: Int) -> Int uses {} { ... }
```

要素の数によらず波括弧で `uses { Logger }`、`uses { A, B }`、空なら `uses {}` と書きます。uses 節を書くと、本体がそこにないエフェクトを使ったときにエラーになります。引数の関数型での省略の意味はエラーの `fails` と同じで、`f: fn() -> ()` はどんな効果の関数でも受け取り、`uses {}` を書けば効果のない関数に限ります。

`main` の R は、ホストのエフェクト（Async と ProcessHost）を除いて空でなければなりません。使うエフェクトはすべて `main` の中の with で供給します。

```emela check=error
effect Logger {
  fn info(msg: String) -> ()
}

fn main() {
  log <- Logger
  log.info("x")
}
```

```text
effect `Logger` is not provided in `main`
```

ホストのエフェクトは、ハンドラを書けず、別名も能力の値も作れない、ホストだけが供給するエフェクトです。Async は「後から再開される」こと（[中断する操作](/guide/suspend/)）、ProcessHost はホストが OS のプロセスであること（引数、標準入出力、環境変数、ファイルシステムを持つ）を表します。どちらも `main` とテスト関数には最初から与えられます。ふつうの `main` は `with Platform { ... }` か `with Process { ... }` と書いて、同梱のハンドラをまとめて供給します（[状態と資源](/guide/resources/#platform-と-process)）。

## エフェクトの型引数

エフェクトは型引数を持てます。

```emela check
effect Store[S] {
  fn load() -> S
}

handler IntStore: Store[Int] {
  fn load() { 42 }
}

handler NameStore: Store[String] {
  fn load() { "alice" }
}

fn read_both() -> (Int, String) uses { Store[Int], Store[String] } {
  ints <- Store[Int]
  names <- Store[String]
  (ints.load(), names.load())
}

fn main() {
  with IntStore, NameStore {
    _ = dbg(read_both()) # (42, "alice")
  }
}
```

`Store[Int]` と `Store[String]` は別のエフェクトとして扱うので、同じ with に並べても上書きし合いません。型引数は省けません。別名でも `ints <- Store[Int]` と書き、uses 節や型の `use Store[Int]` でも書きます（省くと E4008）。ハンドラは `handler IntStore: Store[Int]` のように具体的な型について実装します。同梱の `State[S]` がこの形です（[状態と資源](/guide/resources/)）。

### 型引数を持つハンドラ

ハンドラも名前の後ろに型引数を宣言できます。1つの定義で、どの型の Store も実装できます。

```emela check
effect Store[S] {
  fn load() -> S
}

handler Fixed[S](value: S): Store[S] {
  init(value: S) { Fixed(value:) }
  fn load() { self.value }
}

fn read_both() -> (Int, String) uses { Store[Int], Store[String] } {
  ints <- Store[Int]
  names <- Store[String]
  (ints.load(), names.load())
}

fn main() {
  with Fixed(value: 42), Fixed[String](value: "alice") {
    _ = dbg(read_both()) # (42, "alice")
  }
}
```

- 型引数は with の項目ごとに1回決まります。init の引数から推論するか、`Fixed[String](...)` のように名前の後ろに書きます。決まらないとエラー（E4107）です。
- 同じ with に同じハンドラを並べるとき、型引数が決まっていないと、どちらがどちらを上書きするか決められずに E4107 になります。上の例では1つ目は引数から Int に決まり、2つ目は型引数を書いています。
- ハンドラの型引数は、コロンの後のエフェクト、フィールドの型、init の引数の型のどれかに現れなければなりません（E4013）。

## テストでハンドラを差し替える

本物のハンドラの代わりにテスト用のハンドラを with に書けば、モックの仕組みなしにテストできます。

```emela check
import Std.Console.{Console, SystemConsole}

error NotFound(id: Int)

type User(id: Int, name: String)

effect Users {
  fn find(id: Int) -> User fails NotFound
}

handler SampleUsers: Users {
  fn find(id) {
    id match {
      1 -> User(id: 1, name: "alice")
      _ -> fail NotFound(id:)
    }
  }
}

fn greeting(id: Int) {
  users <- Users
  user = users.find(id) escape { NotFound(_) -> User(id: 0, name: "guest") }
  "Hello, #{user.name}!"
}

fn main() {
  console <- Console
  with SystemConsole, SampleUsers {
    console.print_line(greeting(1))
  }
}

handler NoUsers: Users {
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
