---
title: エラー
description: error の宣言、fail と escape、fails 節、defect
---

Emela のエラー処理の道具は `fail` と `escape` の2つだけです。失敗は何も書かなければ呼び出し元へ伝わり、`escape` で受けると通常の値に戻ります。関数が起こしうるエラーは型の一部（E）になり、コンパイラが推論します。

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

## error の宣言

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

- `error` は、[type](/guide/data/) と同じく、同じ名前の型と構成子を定義します。`NotFound(id: 3)` は型 `NotFound` の普通の値で、変数に入れても、関数に渡しても、リストに入れてもかまいません。
- エラーはタグ名（`NotFound`）で識別します。フィールドは値で、識別には関わりません。`NotFound(id: 1)` と `NotFound(id: 2)` は同じエラーです。
- 関数が起こしうるエラーは、タグの集合 E として型に現れます。集合なので、順序と重複は意味を持ちません。E は言語の中で union が現れる唯一の場所です。
- 値として扱えるのは1つのエラーの型だけです。「NotFound か Unauthorized のどちらか」という値の型は作れません。

```emela check=error
error NotFound(id: Int)
error Unauthorized

fn pick(c: Bool) {
  if c { NotFound(id: 1) } else { Unauthorized }    # E0301
}
```

```text
error[E0301]: type mismatch: expected `NotFound`, found `Unauthorized`
```

## fail

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

- `e` の型はエラーの型でなければなりません（`fail 3` は E0319）。
- `fail e` の型は Never です。`if` や `match` の一方の分岐が `fail` でも、全体の型はもう一方の分岐の型になります。
- `e` の型のタグが、囲む関数の E に加わります。上の `find_name` の E は `NotFound` と推論されます。
- `main` まで届いたエラーは、標準エラーに `error: <値>` を1行出し、終了コード 1 で終わります。表示は `dbg` と同じです。関数型のフィールドを持つエラーは、名前だけを出します（`error: Retry`）。

型引数を、値の型（`err: E`）とエラーの集合（`fails E`）の両方に使うと、その型引数は「1つのエラーの型」として推論されます。

```emela check
error NotFound(id: Int)

fn raise[E](err: E) -> Int fails E { fail err }

fn main() {
  n = raise(NotFound(id: 7)) escape { NotFound(id:) -> id }
  dbg(n)    # 7
}
```

エラーでない型を渡すと、`fail` と同じくエラーになります。

## escape

`式 escape { 腕 }` は、式の評価中に起きたエラーを受けます。腕の形は [match](/guide/pattern-matching/) と同じですが、パターンにはエラーの構成子しか書けません。使い方は4つあります。

```emela check
error NotFound(id: Int)
error DbError(message: String)
error Unavailable(reason: String)

fn load(id: Int) -> Int fails NotFound | DbError {
  if id < 0 { fail DbError(message: "down") } else if id > 10 { fail NotFound(id:) } else { id }
}

# 復帰: 通常の値に戻す
fn load_or_zero(id: Int) -> Int {
  load(id) escape {
    NotFound(_)   -> 0
    DbError(_)    -> 0
  }
}

# 一部だけ受ける: DbError は呼び出し元へ伝わる
fn load_or_default(id: Int) {
  load(id) escape {
    NotFound(_) -> 0
  }
}

# 別のエラーに変える
fn load_or_unavailable(id: Int) {
  load(id) escape {
    DbError(message:) -> fail Unavailable(reason: message)
  }
}

# 値として扱う
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

推論される E はそれぞれ次のとおりです。

| 関数 | E |
|---|---|
| `load_or_zero` | なし（`-> Int` で強制） |
| `load_or_default` | `DbError` |
| `load_or_unavailable` | `NotFound \| Unavailable` |
| `try_load` | `DbError` |

規則:

- 腕のパターンはエラーの構成子でなければなりません。`_` や変数は書けません（E0320）。すべてのエラーをまとめて受ける書き方はありません。
- 腕の網羅は求めません。受けなかったタグはそのまま伝わります。
- 腕で受けたタグは E から消えます。腕の中で起きたエラー（`fail Unavailable(...)`）は E に加わります。
- 腕の結果は、元の式と同じ型か、Never（`fail` や `panic`）でなければなりません。元の式の型が Never のときは、腕の共通の型が全体の型になります。
- 元の式から起きないエラーを受ける腕は、警告 W0302 になります。

```emela check
error NotFound(id: Int)
error Timeout

fn find(id: Int) -> Int fails NotFound { fail NotFound(id:) }

fn main() {
  x = find(1) escape {
    NotFound(_) -> 0
    Timeout     -> 0    # warning[W0302]: error `Timeout` is never raised here
  }
  dbg(x)
}
```

### タグが消える条件

タグが E から消えるのは、ガードのない腕を合わせて、そのエラーの値をすべて受けるときだけです。`NotFound(_)` の1本でも、`Flag(on: True)` と `Flag(on: False)` の2本でもかまいません。

一部の値しか受けない腕（`NotFound(id: 1)` やガード付きの腕）だけなら、タグは E に残ります。腕に合わなかった値は、エラーのまま呼び出し元へ伝わります。

```emela check
error NotFound(id: Int)

fn find(id: Int) -> Int fails NotFound { fail NotFound(id:) }

# ガード付きの腕だけなので、NotFound は E に残る
fn get(id: Int) -> Int fails NotFound {
  find(id) escape {
    NotFound(id:) if id < 10 -> 0
  }
}

fn main() {
  dbg(get(3))     # 0
  dbg(get(30))    # error: NotFound(id: 30)
}
```

`-> Int` と書くと、残った `NotFound` で E0318（`unhandled error`）になります。

### 関数を受け取る関数の中の escape

E の中に、中身の分からない集合変数があるとき、escape はその変数から何も消しません。中身の分からない集合変数とは、集合の型引数 `E`、[引数の関数型](/guide/functions/)の見えない集合変数、1つのエラーの型の型引数、汎化する定義の集合変数です。腕は実行時にそのタグを受けますが、型の上では変数が残ります。

```emela check=error
error Timeout(ms: Int)

# f の E は見えない集合変数。escape しても型の上では Timeout が残りうる
fn retry[A](f: fn() -> A) -> A {
  f() escape { Timeout(_) -> f() }
}

fn once() -> Int {
  retry(fn() { fail Timeout(ms: 1) })    # E0318: unhandled error `Timeout`
}
```

型の上でも消したいときは、受けたいタグを関数型に書き出します。書き出したタグは集合変数の外にあるので、escape で消えます。

```emela check
error Timeout(ms: Int)

fn retry[A, E](f: fn() -> A fails Timeout | E) -> A fails Timeout | E {
  f() escape { Timeout(_) -> f() }    # escape の E は E、2回目の f() で Timeout | E
}

fn main() {
  dbg(retry(fn() { 1 }))    # 1
}
```

呼ぶ側では集合が決まるので、日常のコードの escape はいつも正確です。差が出るのは、関数を受け取る汎用の関数の中だけです。

## fails 節

関数の宣言では、戻り値の書き方がエラーの扱いを決めます。

| 書き方 | 意味 |
|---|---|
| 戻り値の型を省略 | E を推論する。エラーはそのまま伝わる |
| `-> T` | エラーなしを強制する。本体に処理していないエラーがあれば E0318 |
| `-> T fails NotFound` | E をこの集合と宣言する。本体はこの集合の外のエラーを起こせない |

```emela
fn greeting(id: Int) { ... }                          # E は推論
fn count(xs: List[Int]) -> Int { ... }                # エラーなし
fn load(id: Int) -> User fails NotFound | DbError { ... }
```

- 複数のエラーは `|` で区切って並べます。エラーのタグと、エラーの集合を表す型引数を混ぜられます（`fails Timeout | E`）。
- `Timeout | E` を引数の関数型に書くと、渡された関数のエラーのうち Timeout 以外が E になります。Timeout を起こさない関数を渡してもかまいません。
- 推論された E は普段ソースに現れず、[エディタ](/tools/editors/)の LSP が表示します。公開する関数には書いておくと、変更が型の食い違いとして分かります。

### 引数の関数型での省略

引数の位置に書く関数型では、`fails` を省いた意味が変わります。`f: fn() -> Int` は「何で失敗してもよく、そのエラーは f を呼んだ側に伝わる」です。失敗しない関数に限るときは `fails {}` と書きます。

```emela check
error Boom

# f のエラーは twice の E に加わる。-> Int でもエラーにならない
fn twice(f: fn() -> Int) -> Int { f() + f() }

fn main() {
  dbg(twice(fn() { 2 }))    # 4
  n = twice(fn() { fail Boom }) escape { Boom -> 0 }
  dbg(n)                    # 0
}
```

```emela check=error
error Boom

fn pure_only(f: fn() -> Int fails {}) -> Int { f() }

fn main() {
  dbg(pure_only(fn() { fail Boom }))
  # error[E0321]: error set mismatch: expected `fails {}`, found `fails Boom`
}
```

- 戻り値の型を書いた関数の E は、書いた fails 節に、引数の関数のエラー（見えない集合変数）を足したものです。見えない集合変数は書けないので、`-> T` でも引数の関数のエラーは伝わります。
- この規則のおかげで、`List.map(xs, f)` は f のエラーをそのまま引き継ぎます。失敗する版としない版を2つ用意する必要はありません。
- 引数の関数が受け取る関数（`f: fn(fn() -> A) -> B` の内側）の見えない集合変数は、本体から見ると中身が分からないので、そこへ失敗する関数を渡すとエラーになります。

## Option から失敗へ

`None` を失敗に変えるのは、普通の関数 `Option.or_fail` です。

```emela check
error NotFound(id: Int)

fn lookup(names: List[String], id: Int) -> String fails NotFound {
  List.get(names, id) |> Option.or_fail(NotFound(id:))
}

fn main() {
  dbg(lookup(["a", "b"], 1))    # "b"
}
```

`Option.or_fail` は Emela で書かれた関数で、型引数 `E` を値（`err: E`）と `fails E` の両方に使っています。

```emela
pub fn or_fail[A, E](opt: Option[A], err: E) -> A fails E {
  opt match {
    Some(a) -> a
    None    -> fail err
  }
}
```

逆に、失敗を Option に変えるときは、上の `try_load` のように `Some(...) escape { X(_) -> None }` と書きます。

## defect

defect は、プログラムの誤りや回復できない異常を表します。型には現れず、escape では受けられません。

| 発生源 | 例 | メッセージの例 |
|---|---|---|
| `panic(message)` | 到達しないはずの分岐 | message そのもの。`todo()` は `not yet implemented` |
| `assert` の失敗 | [テスト](/guide/testing/)での検証 | `assertion failed: ...` |
| 整数のゼロ除算 | `1 / 0` | `division by zero` |
| 外部関数が投げた例外 | JS の throw | `TypeError: bad` |
| Float から Int への変換の失敗 | `Float.floor(NaN)` | `cannot convert NaN to Int` |
| 負のシフト量 | `Int.shift_left(1, -1)` | `negative shift amount: -1` |
| match の腕に合わない値 | 網羅の検査をすり抜けたとき | `unreachable: no match arm matched` |

メッセージの文面は仕様の一部ではなく、改善のために変わることがあります。

```emela check
error NotFound(id: Int)

fn find(id: Int) -> Int fails NotFound { fail NotFound(id:) }

# 期待されるエラーを defect に変える
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
- 期待されるエラーを defect に変えるには、escape の腕で `panic` を呼びます。逆向きの変換は境界でしかできません。
- defect を観測できるのは境界だけです。境界とは、プログラムの最上位、テストランナー、[`Fiber.attempt`](/guide/concurrency/) を指します。
- defect が起きても、途中の with のハンドラの [release](/guide/resources/) は実行されます。
- `emela run` は、最上位に達した defect を標準エラーに `defect: <message>` と1行出し、終了コード 101 で終わります。エラー（終了コード 1）とは終了コードで見分けられます。

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

## 持たないもの

Result 型、`?` 演算子、try / catch、mapError はありません。

- 失敗を伝えるのに印は要りません。書かなければ伝わります（Rust の `?` を毎回書くのと逆）。
- 受けるのは `escape`、変えるのは escape の腕の `fail`、Option との行き来は `Option.or_fail` と `Some(...) escape`。この3つで足ります。
- 副作用と組み合わせたエラーは、エフェクトの操作の `fails` に書きます。[エフェクトとハンドラ](/guide/effects/)に続きます。
