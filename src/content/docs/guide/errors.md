---
title: エラー
description: error の宣言、fail と escape、fails 節、defect
---

エラー処理に使うのは `fail` と `escape` の2つだけです。`fail` で起きたエラーは、何も書かなければ呼び出し元へ伝わっていき、`escape` で受けたところで普通の値に戻ります。関数がどのエラーを起こしうるかは型の一部（E）になり、コンパイラが推論します。

```emela check
error NotFound(id: Int)

type User(id: Int, name: String)

fn find_user(id: Int) -> User fails NotFound {
  if id == 1 { User(id: 1, name: "alice") } else { fail NotFound(id:) }
}

fn main() {
  user = find_user(2) escape {
    NotFound(_) -> User(id: 0, name: "guest")
  }
  dbg(user)    # User(id: 0, name: "guest")
}
```

`find_user` は見つからないとき `NotFound` で失敗します。呼ぶ側はそれを `escape` で受けて、ゲストのユーザーに置き換えています。

## エラーを宣言する

```emela check
error NotFound(id: Int)
error Unauthorized
error DbError(message: String)

fn main() {
  e = NotFound(id: 3)
  dbg(e)                                   # NotFound(id: 3)
  dbg([NotFound(id: 1), NotFound(id: 2)])  # [NotFound(id: 1), NotFound(id: 2)]
}
```

`error` は [type](/guide/data/) と同じく、同じ名前の型と構成子を定義します。`NotFound(id: 3)` は普通の値なので、変数に入れても、関数に渡しても、リストに入れてもかまいません。

エラーはタグ名（`NotFound`）で区別します。フィールドは中身の値で、`NotFound(id: 1)` と `NotFound(id: 2)` は同じエラーです。関数が起こしうるエラーは、このタグの集合 E として型に出ます。ただし集合になるのは E の中だけで、「NotFound か Unauthorized のどちらか」という値の型は作れません。

## fail で失敗する

`fail e` は、今の計算をエラー `e` で終わらせます。

```emela check
error NotFound(id: Int)

fn find_name(names: List[String], id: Int) {
  List.get(names, id) match {
    Some(name) -> name
    None       -> fail NotFound(id:)
  }
}

fn main() {
  dbg(find_name(["alice", "bob"], 1))    # "bob"
  dbg(find_name(["alice", "bob"], 5))
}
```

```console
$ emela run main.emel
"bob"
error: NotFound(id: 5)
$ echo $?
1
```

- `fail` の式の型は Never なので、match の片方の腕が `fail` でも、全体の型はもう片方の腕の型（ここでは String）になります。
- `find_name` には戻り値の型を書いていませんが、E は `NotFound` と推論されます。
- `main` まで届いたエラーは標準エラーに `error: <値>` を1行出して終了コード 1 で終わります。

## escape で受ける

`式 escape { 腕 }` は、式の評価中に起きたエラーを受けます。腕は [match](/guide/pattern-matching/) と同じ形で、パターンにはエラーの構成子を書きます。腕の書き方しだいで、元の値に戻す、一部だけ受ける、別のエラーに変える、Option に変える、の4通りに使えます。

```emela check
error NotFound(id: Int)
error DbError(message: String)
error Unavailable(reason: String)

fn load(id: Int) -> Int fails NotFound | DbError {
  if id < 0 { fail DbError(message: "down") } else if id > 10 { fail NotFound(id:) } else { id }
}

# 通常の値に戻す。E はなし
fn load_or_zero(id: Int) -> Int {
  load(id) escape {
    NotFound(_)   -> 0
    DbError(_)    -> 0
  }
}

# 一部だけ受ける。DbError は呼び出し元へ伝わる（E は DbError）
fn load_or_default(id: Int) {
  load(id) escape {
    NotFound(_) -> 0
  }
}

# 別のエラーに変える（E は NotFound | Unavailable）
fn load_or_unavailable(id: Int) {
  load(id) escape {
    DbError(message:) -> fail Unavailable(reason: message)
  }
}

# 値として扱う（E は DbError）
fn try_load(id: Int) {
  Some(load(id)) escape {
    NotFound(_) -> None
  }
}

fn main() {
  dbg(load_or_zero(20))           # 0
  dbg(try_load(20))               # None
  dbg(load_or_unavailable(-1))    # error: Unavailable(reason: "down")
}
```

腕で受けたタグは E から消え、受けなかったタグはそのまま伝わります。腕をすべてのエラーについて書く必要はありません。腕の中で `fail` したエラーは新しく E に加わります。

`_` や変数で「どのエラーでも」受ける書き方はありません。受けるエラーはいつも構成子の名前で書きます。

ガード付きの腕で一部の値だけ受けたときの E や、関数を受け取る関数の中の escape の扱いは、[型と効果の体系](/reference/type-system/)にあります。

## fails 節で E を書く

関数の宣言では戻り値の型の書き方で E の扱いが決まります。

```emela
fn greeting(id: Int) { ... }                          # E は推論する
fn count(xs: List[Int]) -> Int { ... }                # エラーなしを強制する
fn load(id: Int) -> User fails NotFound | DbError { ... }
```

戻り値の型を省くと、E も推論されます。`-> Int` だけ書くと「失敗しない」の意味になり、本体で受けていないエラーがあればコンパイルエラーです。`fails` を書くと E はその集合に決まり、その外のエラーは起こせません。複数のエラーは `|` で区切ります。

推論された E は普段ソースに出ず、[エディタ](/tools/editors/)の LSP が表示します。公開する関数には `fails` を書いておくと、変更が型の食い違いとして分かります。

### 関数を受け取るとき

引数の関数型では、`fails` を省くと「何で失敗してもよい」の意味になります。そのエラーは受け取った関数を呼んだ側に伝わります。

```emela check
error Boom

# f のエラーは twice の E に加わる。-> Int と書いてもエラーにならない
fn twice(f: fn() -> Int) -> Int { f() + f() }

fn main() {
  dbg(twice(fn() { 2 }))    # 4
  n = twice(fn() { fail Boom }) escape { Boom -> 0 }
  dbg(n)                    # 0
}
```

`List.map(xs, f)` が f のエラーをそのまま引き継げるのもこの規則のおかげで、失敗する版としない版を2つ用意する必要はありません。失敗しない関数だけを受け取りたいときは `f: fn() -> Int fails {}` と書きます。

## Option と行き来する

`None` を失敗に変えるには、普通の関数 `Option.or_fail` を使います。

```emela check
error NotFound(id: Int)

fn lookup(names: List[String], id: Int) -> String fails NotFound {
  List.get(names, id) |> Option.or_fail(NotFound(id:))
}

fn main() {
  dbg(lookup(["a", "b"], 1))    # "b"
}
```

`Option.or_fail` は Emela で書かれていて、特別な仕組みは使っていません。

```emela
pub fn or_fail[A, E](opt: Option[A], err: E) -> A fails E {
  opt match {
    Some(a) -> a
    None    -> fail err
  }
}
```

逆向きは上の `try_load` のように `Some(...) escape { X(_) -> None }` と書きます。

## defect

defect はプログラムの誤りや、回復できない異常を表します。`panic`、`assert` の失敗、整数のゼロ除算などで起き、型には出ません。escape でも受けられません。

```emela check
error NotFound(id: Int)

fn find(id: Int) -> Int fails NotFound { fail NotFound(id:) }

# 起きてはいけないエラーを defect に変える
fn must_find(id: Int) -> Int {
  find(id) escape {
    NotFound(id:) -> panic("user #{id} must exist")
  }
}

fn main() {
  dbg(must_find(3))
}
```

```console
$ emela run main.emel
defect: user 3 must exist
$ echo $?
101
```

- `panic(message)` と `todo()` は Prelude の関数で、型は Never です。`todo()` は書きかけの関数の本体に置いておけます。
- エラーを defect に変えるには、上のように escape の腕で `panic` を呼びます。
- 最上位に届いた defect は `defect: <message>` を出して終了コード 101 で終わるので、エラー（終了コード 1）と区別できます。

defect を観測できるのは、プログラムの最上位、テストランナー、[`Fiber.attempt`](/guide/concurrency/) の3か所だけです。途中の with のハンドラの [release](/guide/resources/) は、defect のときも実行されます。

```emela check
import Std.Console.{Console, SystemConsole}

effect Db {
  fn query(sql: String) -> Int
}

handler FakeDb implements Db {
  init {
    (use Console).print_line("open")
    FakeDb
  }
  release {
    (use Console).print_line("close")
  }
  fn query(sql) { 1 / 0 }
}

fn main() {
  with SystemConsole, FakeDb {
    (use Db).query("select 1")
  }
}
```

```console
$ emela run main.emel
open
close
defect: division by zero
```

defect を起こすものの一覧と、release の中で defect が起きたときの扱いは[実行時の意味](/reference/semantics/)にあります。

## Result 型と ? 演算子はない

Result 型、`?` 演算子、try / catch、mapError はありません。失敗を伝えるだけなら何も書かず、受けるときは `escape`、別のエラーに変えるときは escape の腕で `fail` します。Option との行き来は `Option.or_fail` と `Some(...) escape` で足ります。

副作用と組み合わせたエラーは、エフェクトの操作の `fails` に書きます（[エフェクトとハンドラ](/guide/effects/)）。
