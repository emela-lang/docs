---
title: テスト
description: "@test と assert、ハンドラの差し替え、テスト用のハンドラ、テスト関数の制約、emela test"
---

テストは `@test` を付けた関数で、検証は `assert` で書きます。外の世界にはエフェクトを通して触れるので、ハンドラを差し替えるだけでテストになります。モックのための仕組みはありません。

```emela check
import Std.Console.{Console, SystemConsole, TestConsole}
import Std.State.{State}

type User(id: Int, name: String)

error NotFound(id: Int)

effect Users {
  fn find(id: Int) -> User fails NotFound
}

fn greet(id: Int) -> String fails NotFound use { Users, Console } {
  user = (use Users).find(id)
  (use Console).print_line("Hello, #{user.name}!")
  user.name
}

handler FakeUsers implements Users {
  fn find(id) {
    if id == 1 { User(id:, name: "alice") } else { fail NotFound(id:) }
  }
}

fn main() {
  with SystemConsole, FakeUsers {
    greet(1)
    ()
  }
}

@test
fn greet_returns_the_name() {
  (name, lines) = State.run([], fn() {
    with TestConsole, FakeUsers { greet(1) }
  })
  assert name == "alice"
  assert lines == ["Hello, alice!"]
}

@test
fn greet_fails_for_unknown_id() {
  with SystemConsole, FakeUsers {
    result = Some(greet(999)) escape { NotFound(_) -> None }
    assert result == None
  }
}
```

```console
$ emela test main.emel
running 2 tests
test greet_returns_the_name ... ok
test greet_fails_for_unknown_id ... ok

test result: ok. 2 passed; 0 failed; 0 filtered out
```

`greet` はテストのことを知りません。本番では with に本物のハンドラを、テストでは FakeUsers と TestConsole を書きます。

## @test と assert

`@test` は引数のない fn に付けます。どのファイルにも書けます。実装と同じファイルに書けば、非公開の関数をそのままテストできます。テスト関数は通常のビルドでは取り除かれるので、呼べるのはほかのテスト関数の中からだけです。

`assert 式` は、式が False のとき defect になります。

```emela check
error NotFound(id: Int)

fn find(id: Int) -> String fails NotFound {
  if id == 1 { "alice" } else { fail NotFound(id:) }
}

fn add(a: Int, b: Int) -> Int { a + b + 1 }

fn main() { () }

@test
fn add_works() {
  assert add(1, 2) == 3
}

@test
fn find_alice() {
  assert find(1) == "alice"
}

@test
fn find_bob() {
  assert find(2) == "bob"
}

@test
fn not_empty() {
  xs = [1, 2]
  assert List.is_empty(xs)
}

@test
fn crashes() {
  panic("boom")
}
```

```console
$ emela test main.emel
running 5 tests
test add_works ... FAILED
test find_alice ... ok
test find_bob ... FAILED
test not_empty ... FAILED
test crashes ... FAILED

failures:

---- add_works ----
defect: assertion failed: add(1, 2) == 3
  left: 4
 right: 3

---- find_bob ----
error: NotFound(id: 2)

---- not_empty ----
defect: assertion failed: List.is_empty(xs)

---- crashes ----
defect: boom

failures:
    add_works
    find_bob
    not_empty
    crashes

test result: FAILED. 1 passed; 4 failed; 0 filtered out
$ echo $?
1
```

失敗のメッセージは `assertion failed: <式の字面>` で、比較のときは続けて両辺の値（`left:` と `right:`）を出します。assert はキーワードで、コンパイラが式の形を見ます。`assert_eq` のような関数を使い分ける必要はありません。テスト関数の外でも使え、`main` の中で失敗すれば defect（終了コード 101）です。

テスト関数の中で処理されなかったエラー（上の `find_bob`）と defect（上の `crashes`）は、そのテストの失敗として報告され、ほかのテストは続けて実行されます。失敗することを確かめるときは、最初の例の `greet_fails_for_unknown_id` のように escape で値に変えて assert します。

## ハンドラを差し替える

テストで使うハンドラは普通のハンドラと同じように書きます。上の FakeUsers がそれです。同梱のエフェクトには、状態を State に置くテスト用のハンドラがあります。`State.run` で最初の状態を渡し、終わった後の状態を見て確かめます。

| ハンドラ | 状態 | 説明 |
|---|---|---|
| `TestConsole` | `State[List[String]]` | `print_line` の行を順に貯める。`print_error_line` は捨てる |
| `TestClock` | `State[Instant]` | 仮の時刻で動く。実際の時間は待たない |
| `TestFileSystem` | `State[TestFiles]` | ファイルとディレクトリを状態に置く |
| `TestHttp` | `State[TestServer]` | `respond` の関数が応答を返し、送った要求を `sent` に貯める |

使い方は [Platform](/std/platform/)、[FileSystem](/std/file-system/)、[Http](/std/http/) にあります。State そのものは [状態と資源](/guide/resources/) で扱います。

TestClock の `sleep` は、どの fiber も先に進めなくなったとき、一番早く起きる予定の時刻まで時刻を進めます。fiber を使うコードも、実際の時計と同じ順で、待たずにテストできます。

```emela check
import Std.Clock.{Clock, TestClock}
import Std.Fiber.{Fiber}
import Std.Instant.{Instant}
import Std.State.{State}

fn slow() -> Int use { Clock } {
  (use Clock).sleep(5000)
  1
}

@test
fn gives_up_after_100ms() {
  start = Instant.from_unix_milliseconds(0)
  (result, end) = State.run(start, fn() {
    with TestClock { Fiber.timeout(100, fn() { slow() }) }
  })
  assert result == None
  assert Instant.to_unix_milliseconds(end) == 100
}

fn main() { () }
```

複数の State を重ねるときは `State.run` を入れ子にします。`with Platform, TestClock { ... }` のように、layer の後ろに書いたハンドラで一部だけを置き換えることもできます。

テスト関数の中で使うエフェクトは、Async を除いてすべて with で供給します。Async はテストランナーが供給するので、`sleep` や fiber はそのまま使えます。

```emela check=error
import Std.Console.{Console}

@test
fn prints() {
  (use Console).print_line("hi")
}

fn main() { () }
```

```text
error: effect `Console` is not provided in test function `prints`
```

## emela test

```sh
emela test [パス] [フィルタ]
```

パスはエントリのファイルかプロジェクトのディレクトリで、省くと `.` です。フィルタを渡すと、名前に部分一致するテストだけを実行します。1つでも失敗すれば終了コード 1、なければ 0 です（テストが0個でも 0 です）。

テストの名前は、エントリのモジュールのものは関数名だけ、ほかのモジュールのものはモジュール名を前に付けます。`src/main.emel` と `src/text/slug.emel` のプロジェクトでは次のようになります。

```console
$ emela test
running 2 tests
test main_slug ... ok
test Text.Slug.joins_words ... ok

test result: ok. 2 passed; 0 failed; 0 filtered out
$ emela test . Slug
running 1 test
test Text.Slug.joins_words ... ok

test result: ok. 1 passed; 0 failed; 1 filtered out
```

ほかのオプションは [CLI](/tools/cli/) にあります。
