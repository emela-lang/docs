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

## @test

- `@test` を付けられるのは、引数のない fn です（引数があれば E0226）。
- どのファイルにも書けます。実装と同じファイルに書けば、非公開の関数をそのままテストできます。
- テスト関数は通常のビルドでは取り除かれます。そのため、テスト関数はテスト関数の中からしか参照できません（E0227）。値としての参照も同じです。テスト関数どうしは参照できます。

```emela check=error
@test
fn sample() { assert 1 + 1 == 2 }

fn main() {
  sample()
  # error[E0227]: test function `sample` can only be used from test functions
}
```

## assert

`assert 式` は、式が False のとき defect になります。式の型は Bool で、assert 全体の型は `()` です。

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

- 失敗のメッセージは `assertion failed: <式の字面>` です。比較のときは、続けて両辺の値を dbg と同じ表示で出します（`left:` と `right:`）。
- 比較の assert は、両辺を左から1回ずつ評価します。
- assert はキーワードで、コンパイラが式の形を見ます。`assert_eq` のような関数を使い分ける必要はありません。
- assert はテスト関数の外でも使えます。通常のビルドでも取り除かれず、`main` の中で失敗すれば defect（終了コード 101）です。

:::caution[0.21 で入る予定]
仕様では、両辺の型が Show を満たさないときは値を出しません。Trait の検査は 0.21 で入るので、今は全部の型で値を出します。
:::

## ハンドラを差し替える

テストで使うハンドラは、普通のハンドラと同じように書きます。上の FakeUsers がそれです。同梱のエフェクトには、状態を State に置くテスト用のハンドラがあります。`State.run` で最初の状態を渡し、終わった後の状態を見て確かめます。

| ハンドラ | 状態 | 説明 |
|---|---|---|
| `TestConsole` | `State[List[String]]` | `print_line` の行を順に貯める。`print_error_line` は捨てる |
| `TestClock` | `State[Instant]` | 仮の時刻で動く。実際の時間は待たない |
| `TestFileSystem` | `State[TestFiles]` | ファイルとディレクトリを状態に置く |
| `TestHttp` | `State[TestServer]` | `respond` の関数が応答を返し、送った要求を `sent` に貯める |

使い方と細かい規則は [Platform](/std/platform/)、[FileSystem](/std/file-system/)、[Http](/std/http/) にあります。State そのものは [状態と資源](/guide/resources/) で扱います。

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

## テスト関数の制約

- テスト関数の R は、Async を除いて空でなければなりません。Async はテストランナーが供給するので、`sleep` や fiber は使えます。ほかのエフェクトは with で供給します。

```emela check=error
import Std.Console.{Console}

@test
fn prints() {
  (use Console).print_line("hi")
  # error[E0402]: effect `Console` is not provided in test function `prints`
}

fn main() { () }
```

- テスト関数の E は空でなくてかまいません。処理されなかったエラーは、そのテストの失敗として報告されます（上の `find_bob`）。失敗することを確かめるときは、escape で値に変えて assert します。
- defect もそのテストの失敗です。他のテストは続けて実行されます。
- 中断したまま resume されずに終わったテストは、`interrupted` の失敗として報告されます。

```emela check
effect Ask {
  suspend fn ask() -> Int
}

handler Silent implements Ask {
  suspend fn ask(resume) { () }
}

fn main() { () }

@test
fn never_answered() {
  with Silent {
    assert (use Ask).ask() == 1
  }
}

@test
fn after() { assert True }
```

```console
$ emela test main.emel
running 2 tests
test never_answered ... FAILED
test after ... ok

failures:

---- never_answered ----
interrupted

failures:
    never_answered

test result: FAILED. 1 passed; 1 failed; 0 filtered out
```

## emela test

```sh
emela test [パス] [フィルタ]
```

- パスはエントリのファイルかプロジェクトのディレクトリで、省くと `.` です。
- 検査を通ったプログラムのテスト関数を1つずつ実行し、結果を標準出力に出します。テストの中で出力したものも、その間に出ます。
- フィルタを渡すと、名前に部分一致するテストだけを実行します。大文字と小文字は区別します。外したテストの数は `filtered out` に出ます。
- 1つでも失敗すれば終了コード 1、なければ 0 です。テストが0個でも 0 です。
- 単独ファイルでは、エントリから import でたどれるモジュールのテストだけを実行します。
- 出力は `target/emela/test` に書くので、通常のビルドの出力を上書きしません。`--target c` でも実行できます。

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
