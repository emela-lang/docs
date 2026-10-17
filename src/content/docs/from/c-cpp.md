---
title: C / C++ から
description: struct と union、NULL と Option、malloc と RAII、エラーコードと例外、ループ、const とグローバル変数、テンプレート、ヘッダ、C ターゲットと Emela の対応
---

Emela の値はすべて不変で、ポインタも `NULL` も `malloc` / `free` もありません。メモリはランタイムが解放し、ファイルや接続のような資源はハンドラの `release` で閉じます。エラーコードを毎回調べる代わりに、失敗は型に出て自動で呼び出し元へ伝わります。C のコードを呼びたいときは、`--target c` で native の実行ファイルを作り、`@external(c, ...)` で C の関数を宣言します。

## 対応表

| C / C++ | Emela |
|---|---|
| `struct Point { double x, y; };` | `type Point(x: Float, y: Float)` |
| タグ付きの `union` / `std::variant` | `enum Shape { Circle(..), Rect(..) }` |
| `enum Color { RED, GREEN };` | `enum Color { Red, Green }` |
| `switch` | `x match { ... }`（網羅を検査する） |
| `int32_t` / `int64_t` / `double` / `bool` | `Int` / `Int64` / `Float` / `Bool` |
| `char *` / `std::string` | `String`（文字の型はない） |
| `NULL` / `nullptr` / `std::optional<T>` | `Option[T]` の `None` |
| `malloc` / `free`、`new` / `delete` | 書かない。ランタイムが解放する |
| デストラクタ（RAII）、`std::unique_ptr` | ハンドラの `init` と `release` |
| エラーコードの戻り値、`errno` | `-> T fails E` と `fail` |
| `throw` / `try` / `catch` | `fail` / `escape { ... }` |
| `abort()` / `assert` | `panic(..)` / テストの `assert` |
| `for` / `while` | 再帰、`List.map`、`List.fold` |
| `const int MAX = 3;` / `#define MAX 3` | `const MAX = 3` |
| グローバル変数 | `State` |
| テンプレート（`template <typename T>`） | 型引数（`fn f[A](x: A)`） |
| 関数ポインタ / ラムダ | 関数の値 / `fn(x) { ... }` |
| ヘッダと `#include` | ファイルがそのままモジュール。`import` |
| `static`（ファイルの外へ見せない） | 既定で非公開。見せるものに `pub` |
| `namespace` | モジュール |
| `printf("%d", n)` | `"#{n}"` と `(use Console).print_line(...)` |
| `clang-format` | `emela fmt` |

## struct と union と enum

```c
typedef struct { double x, y; } Point;

typedef enum { SHAPE_CIRCLE, SHAPE_RECT, SHAPE_EMPTY } ShapeKind;

typedef struct {
  ShapeKind kind;
  union {
    struct { Point center; double radius; } circle;
    struct { Point a, b; } rect;
  };
} Shape;

double area(Shape s) {
  switch (s.kind) {
  case SHAPE_CIRCLE: return 3.14 * s.circle.radius * s.circle.radius;
  case SHAPE_RECT:   return (s.rect.b.x - s.rect.a.x) * (s.rect.b.y - s.rect.a.y);
  case SHAPE_EMPTY:  return 0.0;
  }
  return 0.0;
}
```

```emela check
type Point(x: Float, y: Float)

enum Shape {
  Circle(center: Point, radius: Float)
  Rect(Point, Point)
  Empty
}

enum Color { Red, Green, Blue }

fn area(shape: Shape) -> Float {
  shape match {
    Circle(radius:, ..) -> 3.14 * radius * radius
    Rect(a, b) -> (b.x - a.x) * (b.y - a.y)
    Empty -> 0.0
  }
}

fn main() {
  origin = Point(x: 0.0, y: 0.0)
  dbg(area(Circle(center: origin, radius: 2.0)))    # 12.56
  dbg(area(Rect(origin, Point(x: 3.0, y: 4.0))))    # 12.0
  moved = Point(x: 1.0, ..origin)
  dbg(moved)                                        # Point(x: 1.0, y: 0.0)
  dbg(Green)                                        # Green
}
```

- タグと `union` を自分で組み合わせる代わりに、`enum` のバリアントに中身を持たせます。違うバリアントのフィールドを読み違えることは起きません。中身は `match` でしか取り出せないからです。
- `match` は網羅を検査します。バリアントを足して腕を書き忘れると、コンパイルが止まります。`switch` の `default` や `break` の書き忘れに当たる問題はありません。
- `enum` の値は整数ではありません。`Red + 1` や、整数からの変換はできません。
- フィールドは書き換えられません。一部だけ変えた値は `Point(x: 1.0, ..origin)` で新しく作ります。
- 詳しくは [データ型](/guide/data/) にあります。

## NULL と Option

```c
typedef struct { int id; const char *name; } User;

const User *find(const User *users, size_t n, int id) {
  for (size_t i = 0; i < n; i++) {
    if (users[i].id == id) return &users[i];
  }
  return NULL;
}

const char *name_of(const User *users, size_t n, int id) {
  const User *u = find(users, n, id);
  return u != NULL ? u->name : "(unknown)";
}
```

```emela check
type User(id: Int, name: String)

fn find(users: List[User], id: Int) -> Option[User] {
  users |> List.find(fn(u) { u.id == id })
}

fn name_of(users: List[User], id: Int) -> String {
  find(users, id) match {
    Some(user) -> user.name
    None -> "(unknown)"
  }
}

fn main() {
  users = [User(id: 1, name: "alice"), User(id: 2, name: "bob")]
  dbg(name_of(users, 2))                                   # "bob"
  dbg(name_of(users, 3))                                   # "(unknown)"
  dbg(List.get(users, 0) |> Option.map(fn(u) { u.name }))  # Some("alice")
}
```

- ポインタがないので、`NULL` もありません。ないかもしれない値は `Option[A]` で、`Some(x)` か `None` です。C++17 の `std::optional` に近いですが、中身を取り出すには `match` か `Option` の関数を通るので、確かめずに中を読むことはできません。
- 添字アクセス（`users[0]`）とポインタの演算はありません。`List.get(users, 0)` は `Option` を返すので、範囲外を読むことも起きません。
- 値を関数に渡すときにコピーか参照かを選ぶ必要はありません。値は不変なので、どちらでも同じ意味です。

## エラーコードと例外

C ではエラーを戻り値のコードや `errno` で返し、結果は出力引数に書きます。

```c
#include <errno.h>
#include <stdlib.h>

enum { OK = 0, ERR_PARSE = 1, ERR_RANGE = 2 };

int parse_port(const char *text, int *out) {
  char *end;
  errno = 0;
  long n = strtol(text, &end, 10);
  if (errno != 0 || end == text || *end != '\0') return ERR_PARSE;
  if (n < 0 || n > 65535) return ERR_RANGE;
  *out = (int)n;
  return OK;
}

int port_or_default(const char *text, int *out) {
  int rc = parse_port(text, out);
  if (rc == ERR_PARSE) {
    *out = 8080;
    return OK;
  }
  return rc;
}
```

C++ では例外を投げ、受けたいところで `catch` します。

```cpp
int port_or_default(const std::string& text) {
  try {
    return parse_port(text);  // ParseError か OutOfRange を投げる
  } catch (const ParseError&) {
    return 8080;
  }
}
```

```emela check
error OutOfRange(value: Int)

fn parse_port(text: String) -> Int fails ParseError | OutOfRange {
  n = Int.parse(text)
  if n < 0 || n > 65535 { fail OutOfRange(value: n) } else { n }
}

fn port_or_default(text: String) -> Int fails OutOfRange {
  parse_port(text) escape {
    ParseError(..) -> 8080
  }
}

fn main() {
  dbg(port_or_default("3000"))            # 3000
  dbg(port_or_default("abc"))             # 8080
  dbg(port_or_default("70000"))
}
```

```console
$ emela run main.emel
3000
8080
error: OutOfRange(value: 70000)
```

- `Int.parse(text)` の失敗は、何も書かなくても `parse_port` の呼び出し元へ伝わります。戻り値のコードを毎回調べる `if (rc != OK) return rc;` は要りません。
- どのエラーが起こりうるかは型の `fails` 節に出ます。C++ の例外と違い、受け忘れたエラーは型に残り続けます。
- `escape` で受けたタグは型から消え、受けなかった `OutOfRange` は伝わります。
- `main` まで届いたエラーは `error: ...` と出て、終了コード 1 で終わります。
- `panic(..)` は `abort()` に近い defect で、`escape` では受けられません。それでも、下の `release` は走ります。
- 詳しくは [エラー](/guide/errors/) にあります。

## malloc と RAII

`malloc` / `free` も `new` / `delete` も書きません。値は不変で、使われなくなった値はランタイムが解放します。解放のタイミングは仕様で決めておらず、プログラムからは観測できません。今の実装では、JS ターゲットはホストの GC に、C ターゲットは参照カウントに任せています。二重解放や解放後の使用は起きません。

ファイルや接続のように閉じる時点が大事な資源は、値のデストラクタではなく、ハンドラの `init` と `release` で扱います。

```cpp
class FileLog {
 public:
  explicit FileLog(const char *path) : path_(path), fp_(std::fopen(path, "a")) {
    if (fp_ == nullptr) throw std::runtime_error("cannot open");
  }
  ~FileLog() { std::fclose(fp_); }
  FileLog(const FileLog&) = delete;
  FileLog& operator=(const FileLog&) = delete;

  void write(const std::string& line) { std::fprintf(fp_, "%s\n", line.c_str()); }

 private:
  std::string path_;
  std::FILE *fp_;
};

std::string run() {
  FileLog log("app.log");
  log.write("start");
  throw std::runtime_error("boom");  // ~FileLog が走る
}
```

ここでは、ファイルに書く代わりに Console へ出します。

```emela check
import Std.Console.{Console, SystemConsole}

effect Log {
  fn write(line: String) -> ()
}

handler FileLog(path: String) implements Log {
  init {
    (use Console).print_line("open app.log")
    FileLog(path: "app.log")
  }
  release { (use Console).print_line("close #{self.path}") }
  fn write(line) { (use Console).print_line("#{self.path}: #{line}") }
}

error Boom

fn main() {
  with SystemConsole {
    result = with FileLog {
      (use Log).write("start")
      if True { fail Boom }
      "done"
    } escape {
      Boom -> "failed"
    }
    (use Console).print_line(result)
  }
}
```

```console
$ emela run main.emel
open app.log
app.log: start
close app.log
failed
```

- `init` は `with` に入るときに1回、`release` は `with` を抜けるときに1回走ります。本体が値で終わっても、エラーや defect で抜けても、fiber が中断されても同じです。
- ハンドラの値は `with` の中でしか使えません。コピーやムーブを禁じるコードを書かなくても、閉じた資源を後から使うことは起きません。
- 資源を使う関数の型には `use Log` が出ます。テストでは別のハンドラを `with` で供給できます。
- 詳しくは [状態と資源](/guide/resources/) にあります。

## for と while

```c
int sum_to(int n) {
  int acc = 0;
  for (int i = 1; i <= n; i++) acc += i;
  return acc;
}
```

```emela check
fn sum_to(n: Int, acc: Int) -> Int {
  if n == 0 { acc } else { sum_to(n - 1, acc + n) }
}

fn main() {
  dbg(sum_to(50000, 0))                                     # 1250025000
  xs = [3, 1, 4, 1, 5]
  dbg(xs |> List.map(fn(x) { x * 2 }))                      # [6, 2, 8, 2, 10]
  dbg(xs |> List.fold(from: 0, f: fn(acc, x) { acc + x }))  # 14
  dbg(List.range(0, 4))                                     # [0, 1, 2, 3]
}
```

- `for` も `while` もありません。繰り返しは再帰か、`List.map`、`List.filter`、`List.fold` などの関数で書きます。
- 自分自身への末尾呼び出しはスタックを消費しないと、どのターゲットでも保証します。`sum_to(50000, 0)` も、C の `for` と同じく定数のスタックで回ります。
- `i++` や `acc += i` はありません。変数は不変で、同じ名前で束縛し直すと新しい値の束縛になります。
- 詳しくは [制御の流れ](/guide/control-flow/) にあります。

## const とグローバル変数

```c
#define MAX_RETRY 3

static int next = 0;

int next_id(void) {
  next++;
  return next;
}
```

```emela check
import Std.State.{State}

const MAX_RETRY = 3

fn next_id() -> Int use State[Int] {
  st = use State[Int]
  st.update(fn(n) { n + 1 })
  st.get()
}

fn main() {
  (ids, last) = State.run(0, fn() {
    [next_id(), next_id(), next_id()]
  })
  dbg(ids)                    # [1, 2, 3]
  dbg(last)                   # 3
  dbg(MAX_RETRY)              # 3
}
```

- 値は全部不変なので、`const` を付けて回る必要はありません。Emela の `const` は、モジュールの最上位に置く名前付きの定数です。右辺は純粋な式で、最初に参照したときに1回だけ評価します。プリプロセッサのマクロはありません。
- 書き換えられるグローバル変数はありません。呼ぶたびに変わる状態は `State[S]` のエフェクトに置き、`State.run` の枠の中でだけ読み書きします。
- 状態を使う関数の型には `use State[Int]` が出ます。どの関数がグローバルな状態に触るかが、型を見れば分かります。
- `State.run` を抜けた外からは純粋に見えるので、テストごとに初期値を変えられます。

## テンプレートと関数ポインタ

```cpp
template <typename A, typename B>
struct Pair { A first; B second; };

template <typename A, typename B>
Pair<B, A> swap(const Pair<A, B>& p) { return {p.second, p.first}; }

template <typename A>
A apply_twice(A (*f)(A), A x) { return f(f(x)); }

std::function<int(int)> add(int n) {
  return [n](int x) { return x + n; };
}
```

```emela check
type Pair[A, B](first: A, second: B)

fn swap[A, B](p: Pair[A, B]) -> Pair[B, A] {
  Pair(first: p.second, second: p.first)
}

fn apply_twice[A](f: fn(A) -> A, x: A) -> A {
  f(f(x))
}

fn add(n: Int) -> fn(Int) -> Int {
  fn(x) { x + n }
}

fn double(x: Int) -> Int { x * 2 }

fn main() {
  dbg(swap(Pair(first: 1, second: "one")))   # Pair(first: "one", second: 1)
  dbg(apply_twice(double, 5))                # 20
  add10 = add(10)
  dbg(apply_twice(add10, 1))                 # 21
  dbg([1, 2, 3] |> List.map(add(100)))       # [101, 102, 103]
}
```

- 型引数は `[A, B]` で宣言します。呼ぶ側で型を書くことはなく、引数から推論します。
- テンプレートと違い、本体は宣言のところで1回だけ検査します。使う型ごとに展開してから型エラーが出る、ということはありません。特殊化、型でない引数（`template <int N>`）、型引数に型構成子を渡すこともできません。
- 関数の名前はそのまま値として渡せます。無名関数 `fn(x) { x + n }` は外の束縛を取り込み、キャプチャの指定（`[n]` や `[&]`）は要りません。値は不変なので、取り込んだ値が後で変わることもありません。
- 型引数に「`<` で比べられる型」のような制約を付ける Trait は、0.21 で入る予定です（[Trait](/guide/traits/)）。
- 詳しくは [ジェネリクス](/guide/generics/) と [束縛と関数](/guide/functions/) にあります。

## ヘッダと #include

```c
// geometry.h
#ifndef GEOMETRY_H
#define GEOMETRY_H
typedef struct { double x, y; } Point;
double distance_squared(Point a, Point b);
#endif

// geometry.c
#include "geometry.h"
static double square(double x) { return x * x; }
double distance_squared(Point a, Point b) {
  return square(a.x - b.x) + square(a.y - b.y);
}
```

Emela にヘッダはありません。1つのファイルが1つのモジュールで、`pub` を付けた宣言だけがほかのモジュールから見えます。

```emela check
# geometry.emel（モジュール Geometry）
pub type Point(x: Float, y: Float)

pub fn distance_squared(a: Point, b: Point) -> Float {
  square(a.x - b.x) + square(a.y - b.y)
}

fn square(x: Float) -> Float { x * x }
```

```emela
# main.emel
import Geometry.{Point}

fn main() {
  a = Point(x: 0.0, y: 0.0)
  b = Point(x: 3.0, y: 4.0)
  dbg(Geometry.distance_squared(a, b))     # 25.0
}
```

- モジュール名はファイルのパスから決まります。`geometry.emel` は `Geometry`、`src/http/client.emel` は `Http.Client` です。
- 宣言を2か所に書くことも、インクルードガードもありません。`import` はテキストの貼り込みではなく、名前をスコープに入れるだけです。
- `pub` のない `square` は、C の `static` 関数と同じくモジュールの外から呼べません（E0214）。
- 公開する関数には型を書きます。宣言の順番は問わず、前方宣言も要りません。
- 詳しくは [モジュールと公開範囲](/guide/modules/) にあります。

## C ターゲットと C の関数

`--target c` を付けると、出力した C と C のランタイムを `cc` でコンパイルして、native の実行ファイル（`target/emela/c/main`）を作ります。C の関数は `@external(c, ...)` で宣言して呼びます。

```text
proc/
├── Pome.toml
└── src/
    ├── host.c
    └── main.emel
```

```toml
# Pome.toml
[pome]
name = "github.com/acme/proc"
version = "0.1.0"
emela = "0.20.1"

[build]
target = "c"
```

```c
// src/host.c
#include <stdint.h>
#include <unistd.h>

// pid_t は対応表にない型なので、int32_t に直す
int32_t host_pid(void) {
  return (int32_t)getpid();
}
```

```emela check
# src/main.emel
import Std.Console.{Console, SystemConsole}

@external(c, "./host.c", "host_pid")
fn host_pid() -> Int

@external(c, "abs")
fn abs(n: Int) -> Int use {}

effect Process {
  fn pid() -> Int
}

handler SystemProcess implements Process {
  fn pid() { host_pid() }
}

fn main() {
  with SystemConsole, SystemProcess {
    pid = (use Process).pid()
    (use Console).print_line("pid > 0: #{pid > 0}")
    (use Console).print_line("abs: #{abs(-42)}")
  }
}
```

```console
$ emela run
pid > 0: True
abs: 42
```

- `(c, "名前")` はリンクのときに解決する関数（libc など）を、`(c, "ファイル", "名前")` は自分で書いた `.c` を指します。`.c` は出力と一緒にコンパイルしてリンクします。
- C の型は Emela の型から決まります（`Int` は `int32_t`、`Float` は `double`、`String` は NUL 終端の UTF-8）。コンパイラはヘッダを読みません。表にない型は、C の側に小さな関数を書いて直します。
- 副作用のある外部関数（`use` を省いたもの）は、ハンドラの中でしか呼べません。`use {}` を書いたものは純粋とみなし、どこからでも呼べます。
- C の関数の失敗は値で返し、ハンドラの中で `fail` に変えます。`errno` を自動で失敗に写すことはしません。
- `@external type` の値は `void *` で、Emela は解放しません。解放する C の関数は、ハンドラの `release` から呼びます。

C ターゲットは Tier 2 で、main にあり次のリリースで入ります。純粋な部分、エラーとエフェクト、`suspend fn`、fiber、`Console`、`Clock`、`Random`、`Env`、`FileSystem`、テストは動きます。次はまだです。

| 使えないもの | 出る診断 |
|---|---|
| `String.length`、`String.chars` など、書記素クラスタの表が要る関数 | `` `String.length` needs the Unicode grapheme cluster tables, which target `c` does not support yet `` |
| `String.split(s, "")` を ASCII でない文字列に使う | 実行時の defect |
| `Http`（`SystemHttp` に C の実装がない） | E0412（`has no @external for target c`） |
| コールバックを受け取る外部関数 | E0427 |

対応表の全体と非同期のホスト関数（`emela.h`）の書き方は [外部関数](/guide/external/) に、ほかの制限は [実装の状況](/start/status/) にあります。

## 気をつけるところ

- `Int` は32ビットの符号付き整数です。あふれは2の補数で巻き戻ることを仕様で決めていて、未定義動作にはなりません。整数のゼロ除算は defect です。
- 暗黙の型変換はありません。`Int` と `Float` を混ぜた式は書けず、`Float.round` や `Int64.from_int` で明示します。
- 文字の型（`char`）はありません。1文字は長さ1の `String` です。`String.length` はバイト数ではなく見た目の文字数を返し、バイト数は `String.byte_size` です。
- 文字列は `+` でつなげません。補間 `"#{a}#{b}"` を使います。
- メソッドとクラス、継承はありません。対象を第1引数に取る関数を書き、`|>` でつなぎます。
- `+` や `*` を自分の型に定義し直すことはできません。`==` と `<` の意味は Trait の Eq と Ord で決まります（0.21 で入る予定）。
- プリプロセッサはありません。ターゲットごとに変えたいところは、ターゲットごとの `@external` か、別のハンドラで書き分けます。
- `@external` は逃げ道です。ホストへ出るふつうの道は std のエフェクト（Console、Clock、FileSystem など。[Platform](/std/platform/)）が受け持ちます。依存として使われる Pome は `@external` を持てません。
- 依存の取得は Git のリポジトリから取る仕様です（[Pome](/tools/pome/)）。CLI での依存の取得はまだ実装されていません。
