---
title: Python から
description: 動的型、例外、クラス、for、with 文と asyncio を Emela の言葉に置き換える
---

Emela は静的に型を検査する言語ですが、型の多くは推論されるので、書く量は Python の型ヒント付きのコードとあまり変わりません。違うのは、例外の代わりに型に出るエラーを使うこと、クラスの代わりにデータと関数を分けること、`print` やファイルのような副作用をエフェクトを通して呼ぶことです。

## 対応表

| Python | Emela |
|---|---|
| `@dataclass(frozen=True) class User` | `type User(id: Int, name: String)` |
| `replace(user, name="bob")` | `User(name: "bob", ..user)` |
| クラスの継承で分けた種類 | `enum` とバリアント |
| `match` / `case`（3.10） | 後置の `x match { ... }` |
| `None` / `Optional[T]` | `Option[T]` の `None` |
| `raise NotFound(id)` | `fail NotFound(id:)` |
| `try` / `except NotFound` | `escape { NotFound(_) -> ... }` |
| `except Exception` | ない。受けるエラーを並べる |
| `assert` | `assert`（失敗は defect） |
| メソッド `user.greet()` | `user \|> greet` |
| `for x in xs` / 内包表記 | `List.map`、`List.filter`、`List.fold` |
| `while` | 再帰 |
| `x += 1` | `x = x + 1`（束縛し直し）、`State` |
| `with open_db() as db:` | `with FakeDb { db = use Db ... }` |
| `mock.patch` | ハンドラの差し替え |
| `async def` と `await` | 印なしの関数 |
| `asyncio.gather` | `Fiber.both` / `Fiber.all` / `Fiber.map` |
| `asyncio.TaskGroup` | `Fiber.scope` |
| `asyncio.wait_for` | `Fiber.timeout` |
| `f"Hello, {name}"` | `"Hello, #{name}"` |
| `print(x)` | `(use Console).print_line(...)`、デバッグなら `dbg(x)` |
| インデント | `{ }` |

## 型と推論

Python の関数は型ヒントを書かなくても動きますが、Emela ではトップレベルの関数の引数に型を書きます。戻り値の型、ブロックの中の変数、無名関数の引数は推論されます。

```python
def total(xs: list[int]) -> int:
    return sum(xs)

doubled = [x * 2 for x in [1, 2, 3]]
```

```emela check
fn total(xs: List[Int]) {
  List.fold(xs, from: 0, f: fn(acc, x) { acc + x })
}

fn main() {
  doubled = [1, 2, 3] |> List.map(fn(x) { x * 2 })
  dbg(total(doubled))                     # 12
}
```

- 型が合わなければ、実行の前にコンパイラが止めます。`"a" + 1` のような式は通りません。
- 文字列は `+` でつなげません。補間 `"#{a}#{b}"` を使います。
- `Int` と `Float` を混ぜた計算はできません。`Float.from_int(n)` で変換します。

## クラスとデータ

データ（`type` と `enum`）と、それを扱う関数を分けて書きます。メソッドはなく、関数を `|>` でつなぎます。

```python
@dataclass(frozen=True)
class Circle:
    radius: float

@dataclass(frozen=True)
class Rect:
    width: float
    height: float

Shape = Circle | Rect

def area(shape: Shape) -> float:
    match shape:
        case Circle(radius=r):
            return 3.14159 * r * r
        case Rect(width=w, height=h):
            return w * h
```

```emela check
enum Shape {
  Circle(radius: Float)
  Rect(width: Float, height: Float)
}

fn area(shape: Shape) -> Float {
  shape match {
    Circle(radius: r) -> 3.14159 * r * r
    Rect(width: w, height: h) -> w * h
  }
}

fn main() {
  [Circle(1.0), Rect(width: 2.0, height: 3.0)]
    |> List.map(area)
    |> dbg
}
```

- `match` は全部の場合を網羅していなければエラーになります。種類を足したときに、直すべき場所をコンパイラが教えてくれます。
- フィールドは不変です。一部だけ変えた値は `User(name: "bob", ..user)` で新しく作ります。

## 例外とエラー

Python の例外は、どの関数が何を投げるかが型に出ません。Emela では起こしうるエラーが関数の型（`fails`）に出て、受けたものは型から消えます。

```python
class NotFound(Exception):
    def __init__(self, id: int):
        super().__init__(f"user {id} not found")
        self.id = id

def find(id: int) -> User:
    if id == 1:
        return User(1, "alice")
    raise NotFound(id)

try:
    user = find(2)
except NotFound:
    user = User(0, "guest")
```

```emela check
error NotFound(id: Int)

type User(id: Int, name: String)

# 推論される型: fn(Int) -> User fails NotFound
fn find(id: Int) {
  if id == 1 { User(id: 1, name: "alice") } else { fail NotFound(id:) }
}

fn main() {
  user = find(2) escape {
    NotFound(_) -> User(id: 0, name: "guest")
  }
  dbg(user)
}
```

- `escape` の腕にはエラーの構成子だけを書けます。`except Exception` のように全部を受ける書き方はありません。
- `ValueError` で入力の誤りを知らせていたものは、`Int.parse` のように `ParseError` で失敗する関数になります。
- 受けなかったエラーが `main` まで届くと `error: NotFound(id: 2)` と出て終わります。
- `panic("...")`、ゼロ除算、`assert` の失敗は defect です。型に出ず、`escape` では受けられません。

```emela check
fn port(text: String) -> Int {
  Int.parse(text) escape {
    ParseError(_) -> 8080
  }
}

fn main() {
  dbg(port("3000"))                       # 3000
  dbg(port("abc"))                        # 8080
}
```

## for と while

`for` も `while` もありません。リストの関数か、再帰で書きます。自分への末尾呼び出しはスタックを使わないので、深い繰り返しでも落ちません。

```python
evens = [x for x in range(1, 11) if x % 2 == 0]

n, steps = 27, 0
while n != 1:
    n = n // 2 if n % 2 == 0 else 3 * n + 1
    steps += 1
```

```emela check
fn collatz(n: Int, steps: Int) -> Int {
  if n == 1 {
    steps
  } else if n % 2 == 0 {
    collatz(n / 2, steps + 1)
  } else {
    collatz(3 * n + 1, steps + 1)
  }
}

fn main() {
  evens = List.range(1, 11) |> List.filter(fn(x) { x % 2 == 0 })
  dbg(evens)                              # [2, 4, 6, 8, 10]
  dbg(collatz(27, 0))                     # 111
}
```

## with 文とハンドラ

コンテキストマネージャの `__enter__` と `__exit__` に当たるのが、ハンドラの `init` と `release` です。`with` の本体をどう抜けても `release` が1回走ります。

```python
@contextmanager
def open_db():
    print("open")
    try:
        yield FakeDb()
    finally:
        print("close")

with open_db() as db:
    print(db.query("select 1"))
```

```emela check
import Std.Console.{Console, SystemConsole}

effect Db {
  fn query(sql: String) -> String
}

handler FakeDb implements Db {
  init {
    (use Console).print_line("open")
    FakeDb
  }
  release { (use Console).print_line("close") }
  fn query(sql) { "rows for #{sql}" }
}

fn main() {
  with SystemConsole, FakeDb {
    db = use Db
    (use Console).print_line(db.query("select 1"))
  }
}
```

```console
open
rows for select 1
close
```

- `with` に書くのは値でなくハンドラの名前です。中では `use Db` でその能力を取り出します。
- `db` は `with` の外へ持ち出せません。

## print と副作用

`print` やファイルの読み書きは、エフェクトの操作として呼びます。関数がどのエフェクトを使うかは型に出て、テストでは `mock.patch` の代わりにハンドラを差し替えます。

```emela check
import Std.Console.{Console, SystemConsole, TestConsole}
import Std.State.{State}

fn greet(name: String) -> () use Console {
  (use Console).print_line("Hello, #{name}!")
}

fn main() {
  with SystemConsole { greet("alice") }
}

@test
fn greets() {
  (_, lines) = State.run([], fn() { with TestConsole { greet("alice") } })
  assert lines == ["Hello, alice!"]
}
```

デバッグの出力は `dbg(x)` で足ります。`dbg` は値を標準エラーに出して、その値を返します。

## asyncio

`async def` を付けた関数は `await` でしか呼べませんが、Emela では中断しうる操作も普通の呼び出しです。`asyncio.TaskGroup` のように、子は必ずスコープの中で走り、スコープを抜ける前に終わります。

```python
async def fetch_user(id: int) -> str:
    await asyncio.sleep(0.01 * id)
    return f"user {id}"

async def main():
    a, b = await asyncio.gather(fetch_user(1), fetch_user(2))
    async with asyncio.TaskGroup() as tg:
        t1 = tg.create_task(fetch_user(3))
        t2 = tg.create_task(fetch_user(4))
    try:
        await asyncio.wait_for(fetch_user(8), timeout=0.02)
    except TimeoutError:
        print("timeout")

asyncio.run(main())
```

```emela check
import Std.Clock.{Clock, SystemClock}
import Std.Fiber.{Fiber}

fn fetch_user(id: Int) -> String use Clock {
  (use Clock).sleep(10 * id)
  "user #{id}"
}

fn main() {
  with SystemClock {
    dbg(Fiber.both(fn() { fetch_user(1) }, fn() { fetch_user(2) }))
    pair = Fiber.scope(fn() {
      t1 = Fiber.fork(fn() { fetch_user(3) })
      t2 = Fiber.fork(fn() { fetch_user(4) })
      (Fiber.join(t1), Fiber.join(t2))
    })
    dbg(pair)
    dbg(Fiber.timeout(20, fn() { fetch_user(8) }))   # None
  }
}
```

- `TaskGroup` と同じく、子が失敗すると兄弟は取り消され、エラーはスコープの外へ伝わります。
- `Fiber.timeout` は例外でなく `None` を返します。
- fiber は1つのスレッドで協調的に切り替わります。asyncio と同じく、CPU の計算は速くなりません。

## 気をつけるところ

- インデントではなく `{ }` でブロックを書きます。文は改行で終わります。
- 名前の大文字と小文字に意味があります。変数と関数は `snake_case`、型と構成子は `PascalCase` です。
- `True`、`False`、`None` は構成子で、`None` は `Option` のものだけです。
- 添字アクセス（`xs[0]`）はありません。`List.get(xs, 0)` が `Option` を返します。
- 辞書（`dict`）と集合（`set`）に当たる `Map` と `Set` は 0.21 で入る予定です。
- グローバルな可変の変数はありません。状態は `State` のエフェクトで持ちます。
- ダックタイピングはありません。型の違う値を同じ関数で扱いたいときは `enum` にまとめます（Trait は 0.21）。
