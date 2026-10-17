---
title: Go から
description: error の返り値、interface、goroutine と errgroup、context のキャンセル、for ループと Emela の対応
---

Go で毎回書いていた `if err != nil { return err }` は、Emela では書きません。失敗は自動で呼び出し元へ伝わり、どのエラーが起こりうるかは関数の型に出ます。goroutine と errgroup と context で組み立てていた並行処理は、`Fiber.scope` が1つで受け持ちます。

## 対応表

| Go | Emela |
|---|---|
| `type User struct { ID int; Name string }` | `type User(id: Int, name: String)` |
| `func (u User) Greet() string` | `fn greet(u: User) -> String` と `u \|> greet` |
| `(T, error)` を返す | `-> T fails E` |
| `if err != nil { return err }` | 何も書かない（自動で伝わる） |
| `return User{}, &NotFoundError{ID: id}` | `fail NotFound(id:)` |
| `errors.As(err, &nf)` / `errors.Is` | `escape { NotFound(..) -> ... }` |
| `fmt.Errorf("...: %w", err)` | `escape { A(..) -> fail B(..) }` |
| `panic` / `recover` | `panic(..)` / `Fiber.attempt` |
| `nil` | `Option[A]` の `None` |
| `interface` で依存を渡す | `effect` / `handler` / `with` |
| `defer conn.Close()` | ハンドラの `release` |
| `go f()` | `Fiber.fork(fn() { f() })`（`Fiber.scope` の中だけ） |
| `sync.WaitGroup` / `errgroup.Group` | `Fiber.scope`、`Fiber.all`、`Fiber.map` |
| `ctx` の受け渡しとキャンセル | 引数は要らない。スコープの終わりと `Fiber.interrupt` |
| `context.WithTimeout` | `Fiber.timeout` |
| `select` で最初の1つ | `Fiber.race` |
| チャネル | 一度だけの受け渡しは `Deferred`。キューは予定 |
| `for i := 0; i < n; i++` / `for range` | `List.range` と `List.map`、`List.fold`、再帰 |
| `x := 1` / `x = 2` | `x = 1` / 同じ名前での束縛し直し |
| `fmt.Sprintf("%s", name)` | `"#{name}"` |
| `fmt.Println` | `(use Console).print_line(...)` |
| `gofmt` | `emela fmt` |

## 構造体とメソッド

```go
type User struct {
	ID   int
	Name string
}

func (u User) Greet() string {
	return "Hello, " + u.Name
}

u := User{ID: 1, Name: "alice"}
fmt.Println(u.Greet())
```

```emela check
type User(id: Int, name: String)

fn greet(user: User) -> String {
  "Hello, #{user.name}"
}

fn main() {
  user = User(id: 1, name: "alice")
  user |> greet |> dbg
}
```

- メソッドはありません。対象を第1引数に取る関数を書き、`|>` でつなぎます。
- フィールドは構築のときに全部書きます。ゼロ値はありません。
- 公開するものには `pub` を付けます（大文字始まりで公開、という規則ではありません）。型名は常に大文字始まり、関数とフィールドは `snake_case` です。

## error の返り値

```go
type NotFoundError struct{ ID int }

func (e *NotFoundError) Error() string {
	return fmt.Sprintf("user %d not found", e.ID)
}

func find(id int) (User, error) {
	if id == 1 {
		return User{ID: 1, Name: "alice"}, nil
	}
	return User{}, &NotFoundError{ID: id}
}

func greeting(id int) (string, error) {
	u, err := find(id)
	if err != nil {
		return "", err
	}
	return "Hello, " + u.Name, nil
}

func greetingOrGuest(id int) (string, error) {
	msg, err := greeting(id)
	var nf *NotFoundError
	if errors.As(err, &nf) {
		return "Hello, guest", nil
	}
	return msg, err
}
```

```emela check
error NotFound(id: Int)

type User(id: Int, name: String)

fn find(id: Int) -> User fails NotFound {
  if id == 1 { User(id: 1, name: "alice") } else { fail NotFound(id:) }
}

fn greeting(id: Int) -> String fails NotFound {
  user = find(id)
  "Hello, #{user.name}"
}

# 推論される型: fn(Int) -> String。もう失敗しない
fn greeting_or_guest(id: Int) {
  greeting(id) escape {
    NotFound(_) -> "Hello, guest"
  }
}

fn main() {
  dbg(greeting_or_guest(2))               # "Hello, guest"
}
```

- `error` インターフェースのような共通の型はありません。エラーは1つずつ `error` で宣言し、関数の E はタグの集合になります。
- `escape` で受けたタグは型から消え、受けなかったタグは伝わり続けます。どれを受け忘れているかはコンパイラが知っています。
- `main` まで届いたエラーは `error: NotFound(id: 2)` のように出て、終了コード 1 で終わります。
- `panic` は defect で、`escape` では受けられません。`recover` に当たるのは `Fiber.attempt` です。

## interface と依存

interface を構造体のフィールドに入れて渡していた依存は、エフェクトとして宣言します。

```go
type Clock interface {
	Now() int64
}

type Greeter struct{ clock Clock }

func (g Greeter) Greet(name string) string {
	return fmt.Sprintf("[%d] Hello, %s", g.clock.Now(), name)
}
```

```emela check
effect Stamp {
  fn now() -> Int
}

handler FixedStamp implements Stamp {
  fn now() { 0 }
}

fn greet(name: String) -> String use Stamp {
  "[#{(use Stamp).now()}] Hello, #{name}"
}

fn main() {
  with FixedStamp { dbg(greet("alice")) }
}
```

- `greet` の型に `use Stamp` が出ます。実装は呼ぶ側が `with` で選び、テストでは別のハンドラを供給します。
- Go の interface は暗黙に満たされますが、ハンドラは `implements` で明示します。

## defer と release

```go
func run() error {
	conn, err := open()
	if err != nil {
		return err
	}
	defer conn.Close()
	return conn.Query("select 1")
}
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
    (use Console).print_line((use Db).query("select 1"))
  }
}
```

`release` は、`with` の本体が正常に終わっても、エラーや defect で抜けても、fiber が中断されても1回走ります。

## goroutine と errgroup

```go
g, ctx := errgroup.WithContext(ctx)
var a, b string
g.Go(func() error {
	var err error
	a, err = fetch(ctx, 1)
	return err
})
g.Go(func() error {
	var err error
	b, err = fetch(ctx, 2)
	return err
})
if err := g.Wait(); err != nil {
	return err
}
```

```emela check
import Std.Clock.{Clock, SystemClock}
import Std.Fiber.{Fiber}

error NotFound(id: Int)

fn fetch(id: Int) -> String fails NotFound use Clock {
  (use Clock).sleep(10)
  if id < 0 { fail NotFound(id:) } else { "user #{id}" }
}

fn main() {
  with SystemClock {
    pair = Fiber.scope(fn() {
      a = Fiber.fork(fn() { fetch(1) })
      b = Fiber.fork(fn() { fetch(2) })
      (Fiber.join(a), Fiber.join(b))
    })
    dbg(pair)                             # ("user 1", "user 2")

    names = Fiber.map([3, 4, 5], fn(id) { fetch(id) })
    dbg(names)

    failed = Fiber.all([fn() { fetch(6) }, fn() { fetch(-1) }]) escape {
      NotFound(id:) -> ["not found: #{id}"]
    }
    dbg(failed)                           # ["not found: -1"]
  }
}
```

- `errgroup.WithContext` と同じく、子が1つ失敗すると兄弟は中断され、最初のエラーがスコープの外へ伝わります。
- `go` で投げっぱなしにする goroutine はありません。fiber はスコープの中で起動し、スコープを抜ける前に必ず終わります。漏れた goroutine は起きません。
- fiber は1つのスレッドの上で協調的に切り替わります。`GOMAXPROCS` のような並列はありません。待ちを重ねるときだけ速くなります。

## context のキャンセル

Go では `ctx` を引数で回し、各所で `ctx.Done()` を見ます。Emela では引数は要りません。中断は fiber が次に中断しうる呼び出し（`sleep` や `Http.send` など）に達したときに効き、途中の `release` を走らせながら巻き戻ります。

```go
ctx, cancel := context.WithCancel(context.Background())
go func() {
	for i := 1; ; i++ {
		select {
		case <-ctx.Done():
			return
		case <-time.After(30 * time.Millisecond):
			fmt.Println("tick", i)
		}
	}
}()
time.Sleep(100 * time.Millisecond)
cancel()
```

```emela check
import Std.Console.{Console, SystemConsole}
import Std.Clock.{Clock, SystemClock}
import Std.Fiber.{Fiber}

fn worker(n: Int) -> () use { Clock, Console } {
  (use Clock).sleep(30)
  (use Console).print_line("tick #{n}")
  worker(n + 1)
}

fn main() {
  with SystemConsole, SystemClock {
    Fiber.scope(fn() {
      w = Fiber.fork(fn() { worker(1) })
      (use Clock).sleep(100)
      Fiber.interrupt(w)
    })
    late = Fiber.timeout(50, fn() { worker(100) })
    (use Console).print_line("timeout: #{late}")
  }
}
```

```console
tick 1
tick 2
tick 3
tick 100
timeout: None
```

- `context.WithTimeout` に当たるのは `Fiber.timeout` です。間に合わなければ処理を中断して `None` を返します。
- スコープの本体が値を返した時点で残っている子も中断されます。
- `worker` は自分への末尾呼び出しなので、何回回してもスタックは増えません。

## for ループ

```go
total := 0
for _, x := range []int{1, 2, 3, 4} {
	if x%2 == 0 {
		total += x
	}
}
```

```emela check
fn main() {
  total = [1, 2, 3, 4]
    |> List.filter(fn(x) { x % 2 == 0 })
    |> List.fold(from: 0, f: fn(acc, x) { acc + x })
  dbg(total)                              # 6
  dbg(List.range(0, 5) |> List.map(fn(i) { i * i }))
}
```

## 気をつけるところ

- 変数は不変で、`:=` と `=` の区別もありません。`x = x + 1` は新しい束縛です。
- `nil` はありません。ないかもしれない値は `Option` で表します。
- 添字アクセス（`xs[0]`）はありません。`List.get(xs, 0)` が `Option` を返します。
- 文字列は `+` でつなげません。補間 `"#{a}#{b}"` を使います。
- 能力の値（`use Stamp` の値）は、引数に渡す、構造体に入れる、返すのどれもできません。
- チャネルと `Semaphore`、`Queue` はまだありません。同時に走る数を絞る道具は後の版で入ります。
- 依存の取得は Go のモジュールと同じく Git のリポジトリから取り、Minimal Version Selection で版を選ぶ仕様です（[Pome](/tools/pome/)）。CLI での依存の取得はまだ実装されていません。
