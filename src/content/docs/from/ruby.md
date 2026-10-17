---
title: Ruby から
description: nil、Data、case / in、ブロック、rescue と ensure、オープンクラス、Thread と RSpec を Emela の言葉に置き換える
---

Emela は静的に型を検査する言語ですが、型の多くは推論されるので、ブロックとメソッドチェーンで書く Ruby のコードとあまり長さは変わりません。違うのは、`nil` の代わりに `Option` を使うこと、オブジェクトとメソッドの代わりにデータと関数を分けること、例外の代わりに型に出るエラーを使うことです。文字列の補間 `"#{name}"` は Ruby と同じ形で書けます。

## 対応表

| Ruby | Emela |
|---|---|
| `nil` | `Option[T]` の `None` |
| `user&.name \|\| "guest"` | `Option.map` と `Option.or` |
| `Data.define(:x, :y)` / `Struct` | `type Point(x: Int, y: Int)` |
| `point.with(y: 5)` | `Point(y: 5, ..point)` |
| シンボルで種類を分けたハッシュ | `enum` とバリアント |
| `case` / `in` | 後置の `x match { ... }` |
| `xs.map { \|x\| ... }` | `xs \|> List.map(fn(x) { ... })` |
| `select` / `inject` / `any?` | `List.filter` / `List.fold` / `List.any` |
| `each` と `while` | `List` の関数、再帰 |
| `raise NotFound` | `fail NotFound(id:)` |
| `rescue NotFound` | `escape { NotFound(_) -> ... }` |
| `rescue => e`（全部を受ける） | ない。受けるエラーを並べる |
| `ensure` | ハンドラの `release` |
| `File.open(path) { \|f\| ... }` | `with` とハンドラの `init` / `release` |
| `str.squish`（レシーバ） | `str \|> squish` |
| オープンクラス、`method_missing` | ない。関数を足す |
| `module` / `require_relative` | ファイルがモジュール、`import` |
| `Thread.new` / `Fiber` | `Fiber.scope` と `Fiber.fork`、`Fiber.map` |
| RSpec の `allow(...).to receive` | ハンドラの差し替え |
| `"Hello, #{name}"` | `"Hello, #{name}"` |
| `p x` | `dbg(x)` |
| `do ... end` | `{ }` |

## nil と Option

Emela には `nil` がありません。ないかもしれない値は `Option[T]` で、型に出ます。`&.` と `||` のつなぎは、`Option` の関数をパイプでつないで書きます。

```ruby
User = Struct.new(:name, :nickname)

def display_name(user)
  user&.nickname || "guest"
end

p display_name(User.new("alice", "ally"))
p display_name(User.new("bob", nil))
p display_name(nil)
```

```emela check
type User(name: String, nickname: Option[String])

fn display_name(user: Option[User]) -> String {
  user
    |> Option.and_then(fn(u) { u.nickname })
    |> Option.or("guest")
}

fn main() {
  alice = User(name: "alice", nickname: Some("ally"))
  bob = User(name: "bob", nickname: None)
  dbg(display_name(Some(alice)))          # "ally"
  dbg(display_name(Some(bob)))            # "guest"
  dbg(display_name(None))                 # "guest"
}
```

- `String` の値は `None` になりません。`NoMethodError (undefined method for nil)` に当たる失敗は、コンパイルの時点で止まります。
- 真偽の判定に使えるのは `Bool` だけです。Ruby のように `nil` と `false` 以外を真とみなす規則はありません。`if name { ... }` は型が合わずに通りません。
- 中身を取り出すときは `match` で `Some(x)` と `None` に分けます。詳しくは [データ](/guide/data/) にあります。

## Struct、Data とクラス

Ruby 3.2 の `Data` に近いのが `type` です。フィールドは不変で、`==` は中身で比べます。一部だけ変えた値は、`with` の代わりに `..` で作ります。

```ruby
Point = Data.define(:x, :y)

p1 = Point.new(x: 1, y: 2)
q = p1.with(y: 5)
p q                          # => #<data Point x=1, y=5>
p p1 == Point.new(x: 1, y: 2)
p "(#{q.x}, #{q.y})"
```

```emela check
type Point(x: Int, y: Int)

fn main() {
  p = Point(x: 1, y: 2)
  q = Point(y: 5, ..p)
  dbg(q)                                  # Point(x: 1, y: 5)
  dbg(p == Point(x: 1, y: 2))             # True
  dbg("(#{q.x}, #{q.y})")                 # "(1, 5)"
}
```

- `type` にメソッドは書けません。振る舞いは同じモジュールのトップレベルの関数に置きます。
- 継承はありません。種類の違う値をまとめたいときは `enum` にします（次の節）。
- `Struct` のような可変のフィールドはありません。`attr_accessor` で書き換えていた状態は、新しい値を作って返すか、`State` のエフェクトで持ちます。

## case / in と match

`case` / `in` のパターンマッチは、後置の `match` になります。Ruby ではハッシュとシンボルで種類を分けることが多いのですが、Emela では種類を `enum` のバリアントとして宣言します。

```ruby
def describe(event)
  case event
  in {type: :click, x:, y:} if x < 0 || y < 0 then "outside"
  in {type: :click, x:, y:} then "click at #{x},#{y}"
  in {type: :key, code: "Escape"} then "close"
  in {type: :key, code:} then "key #{code}"
  in {type: :scroll} then "scroll"
  end
end

def first_two(xs)
  case xs
  in [] then "empty"
  in [x] then "one: #{x}"
  in [x, y, *] then "#{x} and #{y}"
  end
end
```

```emela check
enum Event {
  Click(x: Int, y: Int)
  Key(code: String)
  Scroll(delta: Int)
}

fn describe(event: Event) -> String {
  event match {
    Click(x:, y:) if x < 0 || y < 0 -> "outside"
    Click(x:, y:) -> "click at #{x},#{y}"
    Key(code: "Escape") -> "close"
    Key(code:) -> "key #{code}"
    Scroll(_) -> "scroll"
  }
}

fn first_two(xs: List[Int]) -> String {
  xs match {
    [] -> "empty"
    [x] -> "one: #{x}"
    [x, y, ..] -> "#{x} and #{y}"
  }
}

fn main() {
  dbg(describe(Click(x: 3, y: 4)))        # "click at 3,4"
  dbg(describe(Key(code: "Escape")))      # "close"
  dbg(first_two([1, 2, 3]))               # "1 and 2"
}
```

- `x:` で同じ名前の変数に束縛する書き方、ガードの `if`、配列の残りを無視する `*`（Emela では `..`）は、ほぼ同じ形です。
- 網羅していない `match` はコンパイルエラーです。Ruby の `NoMatchingPatternError` は実行時に起きますが、Emela では足りないパターンの例をコンパイラが示します。
- ハッシュのパターン（`{name:}`）に当たるのは、名前付きフィールドの構成子パターン（`User(name:, ..)`）です。列挙しないフィールドがあるときは `..` を書きます。
- 規則の全体は [パターンマッチ](/guide/pattern-matching/) にあります。

## ブロックとパイプ

`map { |x| ... }` のブロックは、無名関数 `fn(x) { ... }` を引数として渡す形になります。メソッドチェーンの `.` は `|>` に置き換わり、左の値が右の関数の第1引数に入ります。

```ruby
words = %w[apple kiwi banana fig]
long = words.select { |w| w.length > 3 }.map { |w| "#{w}!" }
total = (1..10).select(&:even?).inject(0) { |acc, n| acc + n }
words.any? { |w| w.start_with?("b") }
```

```emela check
fn main() {
  words = ["apple", "kiwi", "banana", "fig"]
  long = words
    |> List.filter(fn(w) { String.length(w) > 3 })
    |> List.map(fn(w) { "#{w}!" })
  dbg(long)                               # ["apple!", "kiwi!", "banana!"]
  total = List.range(1, 11)
    |> List.filter(fn(n) { n % 2 == 0 })
    |> List.fold(from: 0, f: fn(acc, n) { acc + n })
  dbg(total)                              # 30
  dbg(List.any(words, fn(w) { String.starts_with(w, "b") }))   # True
}
```

- `inject` は `List.fold`、`select` は `List.filter`、`find` は `List.find`（`Option` を返す）です。
- `&:even?` のような省略形、`_1` や `it` の暗黙の引数はありません。引数の名前を書きます。
- `List.range(1, 11)` は 1 以上 11 未満です。Ruby の `(1..10)` と同じ範囲になります。
- `yield` はありません。ブロックを受ける関数は、関数型の引数（`f: fn(Int) -> Int`）を取ります。[関数](/guide/functions/) を参照してください。
- `each` で副作用を起こしながら回すループは、`List.fold` で値を積むか、再帰で書きます。自分への末尾呼び出しはスタックを使いません。

## raise、rescue と fail、escape

Ruby の例外は、どのメソッドが何を投げるかが見えません。Emela では起こしうるエラーが関数の型（`fails`）に出て、`escape` で受けたものは型から消えます。

```ruby
class InsufficientFunds < StandardError; end
class AccountLocked < StandardError; end

Account = Data.define(:id, :balance, :locked)

def withdraw(account, amount)
  raise AccountLocked, "account #{account.id}" if account.locked
  raise InsufficientFunds if account.balance < amount
  account.with(balance: account.balance - amount)
end

def try_withdraw(account, amount)
  after = begin
    withdraw(account, amount)
  rescue InsufficientFunds
    account
  end
  "balance: #{after.balance}"
end
```

```emela check
error InsufficientFunds(balance: Int, amount: Int)
error AccountLocked(id: Int)

type Account(id: Int, balance: Int, locked: Bool)

# 推論される型: fn(Account, Int) -> Account fails AccountLocked | InsufficientFunds
fn withdraw(account: Account, amount: Int) {
  if account.locked {
    fail AccountLocked(id: account.id)
  } else if account.balance < amount {
    fail InsufficientFunds(balance: account.balance, amount:)
  } else {
    Account(balance: account.balance - amount, ..account)
  }
}

fn try_withdraw(account: Account, amount: Int) -> String fails AccountLocked {
  after = withdraw(account, amount) escape {
    InsufficientFunds(..) -> account
  }
  "balance: #{after.balance}"
}

fn main() {
  account = Account(id: 1, balance: 100, locked: False)
  dbg(try_withdraw(account, 30))          # "balance: 70"
  dbg(try_withdraw(account, 500))         # "balance: 100"
  try_withdraw(Account(locked: True, ..account), 10)
}
```

```console
"balance: 70"
"balance: 100"
error: AccountLocked(id: 1)
```

- エラーは `error` で宣言する値です。`StandardError` を継承する階層はなく、`rescue StandardError` のようにまとめて受ける書き方もありません。
- `try_withdraw` は `InsufficientFunds` だけを受けたので、型に残るのは `AccountLocked` です。受けなかったエラーは呼び出し元へ伝わります。
- `retry` はありません。もう一度呼ぶ処理を `escape` の腕に書きます。
- `raise "message"` のように文字列だけで投げる代わりに、`panic("message")` で defect を起こせます。defect は型に出ず、`escape` では受けられません。
- 詳しくは [エラー](/guide/errors/) にあります。

## ensure と release

`ensure` で必ず走らせていた後始末は、ハンドラの `release` に書きます。`with` の本体をどう抜けても、エラーでも defect でも、`release` は1回走ります。

```ruby
class Boom < StandardError; end

def with_log
  puts "open log"
  yield ->(line) { puts "log: #{line}" }
ensure
  puts "close log"
end

begin
  with_log do |log|
    log.call("start")
    raise Boom, "disk full"
  end
rescue Boom => e
  puts "rescued: #{e.message}"
end
```

```emela check
import Std.Console.{Console, SystemConsole}

error Boom(reason: String)

effect Log {
  fn write(line: String) -> ()
}

handler FileLog implements Log {
  init {
    (use Console).print_line("open log")
    FileLog
  }
  release { (use Console).print_line("close log") }
  fn write(line) { (use Console).print_line("log: #{line}") }
}

fn work() -> () fails Boom use Log {
  (use Log).write("start")
  fail Boom(reason: "disk full")
}

fn main() {
  with SystemConsole {
    with FileLog { work() } escape {
      Boom(reason:) -> (use Console).print_line("rescued: #{reason}")
    }
  }
}
```

```console
open log
log: start
close log
rescued: disk full
```

- ブロック付きの `File.open` が終わりでファイルを閉じるのと同じ形です。`init` が開く側、`release` が閉じる側に当たります。
- `release` の中では失敗できません。失敗しうる後始末は、`release` の中で `escape` します。
- `with` の中で取り出した能力（`use Log` の値）は、`with` の外へ持ち出せません。閉じたファイルを後から使う誤りが起きません。
- 詳しくは [リソース](/guide/resources/) にあります。

ファイルを1回読むだけなら、`Std.FileSystem` の操作で足ります。`Errno::ENOENT` に当たるのは `FileNotFound` です。

```ruby
def line_count(path)
  File.open(path) { |f| f.each_line.count { |l| l != "\n" } }
rescue Errno::ENOENT
  0
end
```

```emela check
import Std.FileSystem.{FileSystem, SystemFileSystem, FileNotFound}

fn line_count(path: String) {
  text = (use FileSystem).read_text(path) escape {
    FileNotFound(..) -> ""
  }
  text |> String.split("\n") |> List.filter(fn(l) { l != "" }) |> List.length
}

fn main() {
  with SystemFileSystem {
    dbg(line_count("missing.txt"))        # 0
  }
}
```

`line_count` の型には、受けなかった `FileAccessDenied` などのエラーと `use FileSystem` が残ります。戻り値の型を書くなら、それらも `fails` に並べます。

## レシーバ、オープンクラス、method_missing

Emela にメソッドはありません。`str.squish` のような呼び出しは、関数 `squish(str)` か、パイプの `str |> squish` で書きます。既存の型にメソッドを足すオープンクラスやモンキーパッチの代わりに、自分のモジュールに関数を足します。

```ruby
class String
  def squish
    split(" ").join(" ")
  end
end

p "  hello   ruby  world ".squish + "!"
```

```emela check
fn squish(s: String) -> String {
  s |> String.split(" ") |> List.filter(fn(w) { w != "" }) |> String.join(" ")
}

fn shout(s: String) -> String {
  "#{s}!"
}

fn main() {
  "  hello   ruby  world " |> squish |> shout |> dbg   # "hello ruby world!"
}
```

`.` はフィールドを読むだけなので、メソッドのつもりで書くとコンパイルエラーになります。

```emela check=error
fn twice(s: String) -> String {
  s.repeat(2)        # error[E0313]: type `String` has no fields
}
```

- `String` や `List` の関数は、`String.split` のようにモジュール名を付けて呼びます。import は要りません。
- `method_missing`、`define_method`、`send`、`respond_to?` はありません。呼べる関数はすべてコンパイルの時点で決まります。
- 同じ名前の関数を型ごとに使い分けるのは Trait の仕事です（0.21 で入る予定。[Trait](/guide/traits/)）。それまでは、型の違う値を `enum` にまとめて `match` で分けます。

## module と require

Ruby の `module` で名前空間を作り、`require_relative` で読み込んでいたものは、ファイルそのものがモジュールになります。`src/money.emel` は `Money` というモジュールで、`pub` を付けた宣言だけが外から見えます。

```ruby
# money.rb
module Money
  def self.format(cents)
    "$#{cents / 100}.#{(cents % 100).to_s.rjust(2, "0")}"
  end
end

# main.rb
require_relative "money"
puts Money.format(1250)
```

```emela
# src/money.emel
pub fn format(cents: Int) -> String {
  rest = cents % 100
  pad = if rest < 10 { "0" } else { "" }
  "$#{cents / 100}.#{pad}#{rest}"
}

# src/main.emel
import Money

fn main() {
  dbg(Money.format(1250))                 # "$12.50"
}
```

- `include` や `extend` で他のモジュールのメソッドを混ぜ込む仕組み（mixin）はありません。`import Money.{format}` で名前を取り込めば、修飾なしで呼べます。
- モジュールの循環参照はエラーになります。
- 詳しくは [モジュール](/guide/modules/) にあります。gem に当たる配布の単位は [Pome](/tools/pome/) です。

## Thread、Fiber と Emela の fiber

`Thread.new` で並行に走らせて `value` で待つ形は、`Fiber.map` や `Fiber.scope` で書きます。Emela の fiber は、子が必ずスコープの中で走り、スコープを抜ける前に終わります。

```ruby
def fetch(id)
  sleep 0.01
  "page #{id}"
end

threads = [1, 2, 3].map { |id| Thread.new { fetch(id) } }
p threads.map(&:value)
```

```emela check
import Std.Clock.{Clock, SystemClock}
import Std.Fiber.{Fiber}

fn fetch(id: Int) -> String use Clock {
  (use Clock).sleep(10)
  "page #{id}"
}

fn main() {
  with SystemClock {
    pages = Fiber.map([1, 2, 3], fn(id) { fetch(id) })
    dbg(pages)                            # ["page 1", "page 2", "page 3"]
  }
}
```

- fiber は1つのスレッドで協調的に切り替わります。GVL のある Ruby のスレッドと同じく、待ちは重ねられますが、CPU の計算は速くなりません。
- Ractor のような並列の実行はありません。
- Ruby の `Fiber` と違い、`resume` と `yield` を手で呼びません。`sleep` のような中断しうる操作で自動的に切り替わります。
- 子の1つが失敗すると兄弟は中断され、エラーはスコープの外へ伝わります。`Thread#join` で例外を拾い忘れることはありません。
- 詳しくは [並行性](/guide/concurrency/) にあります。

## RSpec とハンドラの差し替え

RSpec の `allow(...).to receive` や minitest の `stub` で外の依存を差し替えていたところは、エフェクトのハンドラを差し替えます。テストは `@test` を付けた関数で、検証は `assert` で書きます。

```ruby
RSpec.describe "greeting" do
  it "greets a known user" do
    allow(UserRepo).to receive(:find).with(1).and_return(User.new(1, "alice"))
    expect(greeting(1)).to eq("Hello, alice")
  end
end
```

```emela check
error NotFound(id: Int)

type User(id: Int, name: String)

effect Users {
  fn find(id: Int) -> User fails NotFound
}

fn greeting(id: Int) -> String use Users {
  user = (use Users).find(id) escape {
    NotFound(_) -> User(id:, name: "guest")
  }
  "Hello, #{user.name}"
}

handler FakeUsers implements Users {
  fn find(id) {
    if id == 1 { User(id: 1, name: "alice") } else { fail NotFound(id:) }
  }
}

@test
fn greets_known_user() {
  with FakeUsers {
    assert greeting(1) == "Hello, alice"
  }
}

@test
fn greets_unknown_user_as_guest() {
  with FakeUsers {
    assert greeting(2) == "Hello, guest"
  }
}
```

```console
$ emela test main.emel
running 2 tests
test greets_known_user ... ok
test greets_unknown_user_as_guest ... ok

test result: ok. 2 passed; 0 failed; 0 filtered out
```

- `greeting` が `Users` を使うことは型（`use Users`）に出ます。差し替え忘れはコンパイルエラーになり、本物のデータベースに触るテストが紛れ込みません。
- 本番では同じ `Users` を実装した別のハンドラを `with` に書きます。`greeting` は書き換えません。
- `describe` や `let` のような DSL はありません。テストは関数で、名前で絞り込めます（`emela test main.emel greets`）。
- 詳しくは [テスト](/guide/testing/) にあります。

## 気をつけるところ

- `do ... end` ではなく `{ }` でブロックを書きます。`end` はありません。
- 括弧は省略できません。`puts "hi"` ではなく `f(x)` と書きます。
- 名前の大文字と小文字に意味があります。変数と関数は `snake_case`、型と構成子は `PascalCase` です。`?` や `!` で終わる名前（`empty?`、`save!`）は書けません。`is_empty` のように名前で表します。
- シンボル（`:name`）はありません。決まった種類は `enum` のバリアントにします。
- `true` と `false` は `True` と `False` です。どちらも `Bool` の構成子です。
- 文字列は不変で、`<<` で書き足せません。`+` でもつなげません。補間 `"#{a}#{b}"` か `String.concat` を使います。
- `Integer` と `Float` を混ぜた計算はできません。`Float.from_int(n)` で変換します。Ruby の多倍長整数と違い、`Int` は 32bit で、64bit が要るなら `Int64` を使います。
- ハッシュに当たる `Map` と、`Set` は 0.21 で入る予定です。
- 添字アクセス（`xs[0]`）はありません。`List.get(xs, 0)` が `Option` を返します。
- グローバル変数（`$x`）、インスタンス変数（`@x`）はありません。状態は `State` のエフェクトで持ちます。
- `puts` はエフェクトの操作 `(use Console).print_line(...)` です。デバッグの出力は `dbg(x)` で足ります。
- Python から来た人向けの話題（型ヒントとの違い、`with` 文、asyncio）は [Python から](/from/python/) にあります。
