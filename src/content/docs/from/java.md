---
title: Java から
description: record、sealed interface、switch のパターン、Optional、検査例外、DI、try-with-resources、Stream、StructuredTaskScope と Emela の対応
---

Java 21 の record と sealed interface、パターン付きの `switch` は、Emela の `type`、`enum`、`match` にほぼそのまま移せます。検査例外は `fails` 節に近いものの、ラムダを通り抜け、推論もされる点が違います。DI コンテナとモックの役目はエフェクトとハンドラが受け持ち、`AutoCloseable` の後始末はハンドラの `release` に書きます。

## 対応表

| Java | Emela |
|---|---|
| `record User(int id, String name)` | `type User(id: Int, name: String)` |
| `new User(user.id(), "bob")`（wither） | `User(name: "bob", ..user)` |
| `record Pair<A, B>(A first, B second)` | `type Pair[A, B](first: A, second: B)` |
| `sealed interface` と `record ... implements` | `enum` とバリアント |
| `enum Status { ACTIVE, CLOSED }` | `enum Status { Active, Closed }` |
| `switch (x) { case Circle(var r) when r > 0 -> ... }` | `x match { Circle(radius:) if radius > 0 -> ... }` |
| `null`、`Optional<User>` | `Option[User]` |
| `throws NotFoundException`（検査例外） | `fails NotFound` |
| `RuntimeException`（非検査例外） | defect（`panic`） |
| `try { } catch (E e) { }` | `式 escape { E(..) -> ... }` |
| `interface` とコンストラクタ注入（Spring） | `effect` / `handler` / `with` |
| Mockito の `@Mock` と `verify` | テスト用のハンドラと `State` |
| try-with-resources と `AutoCloseable` | ハンドラの `init` と `release` |
| `list.stream().filter(...).map(...).toList()` | `xs \|> List.filter(...) \|> List.map(...)` |
| `static` メソッドだけのユーティリティクラス | モジュール（1ファイル）と `pub fn` |
| `private` コンストラクタと static ファクトリ | `pub opaque type` と `pub fn` |
| `StructuredTaskScope` と `fork` | `Fiber.scope` と `Fiber.fork` |
| `@Test` と `assertEquals` | `@test` と `assert` |

## record と sealed interface

```java
record User(int id, String name) {
    User withName(String name) { return new User(id, name); }
}

record Pair<A, B>(A first, B second) {
    Pair<B, A> swap() { return new Pair<>(second, first); }
}

enum Status { ACTIVE, SUSPENDED, CLOSED }
```

```emela check
type User(id: Int, name: String)

type Pair[A, B](first: A, second: B)

enum Status {
  Active
  Suspended
  Closed
}

fn swap[A, B](p: Pair[A, B]) -> Pair[B, A] {
  Pair(first: p.second, second: p.first)
}

fn main() {
  user = User(id: 1, name: "alice")
  dbg(User(name: "bob", ..user))          # User(id: 1, name: "bob")
  dbg(user == User(id: 1, name: "alice")) # True
  dbg(swap(Pair(first: 1, second: "one")))
}
```

- record と同じく、`type` のフィールドは不変で、`==` は構造で比べます。`equals` と `hashCode` を書く必要はありません。
- `withName` のような wither は書かず、`User(name: "bob", ..user)` で一部だけ変えた値を作ります。
- 構築はいつも引数名付きです（`User(id: 1, name: "alice")`）。`new` はありません。
- Java の `enum` に当たるのは、中身のないバリアントだけの `enum` です。`Status.values()` や `ordinal()` に当たる関数はありません。
- 型引数は `<A>` でなく `[A]` と書きます。ワイルドカード（`? extends T`）と境界つきの型引数はありません。詳しくは[ジェネリクス](/guide/generics/)を見てください。
- メソッドは型の中に書けません。型と同じモジュールに、対象を第1引数に取る関数として書きます。

## switch のパターンと match

sealed interface を `switch` で分けていたところは、`enum` を `match` で分けます。

```java
record Point(int x, int y) {}

sealed interface Shape permits Circle, Square {}
record Circle(Point center, int radius) implements Shape {}
record Square(Point corner, int side) implements Shape {}

static String describe(Shape shape) {
    return switch (shape) {
        case Circle(Point(var x, var y), var r) when x == 0 && y == 0 -> "origin circle r=" + r;
        case Circle c when c.radius() > 100 -> "big circle";
        case Circle c -> "circle";
        case Square(var corner, var side) -> "square " + side;
    };
}
```

```emela check
type Point(x: Int, y: Int)

enum Shape {
  Circle(center: Point, radius: Int)
  Square(corner: Point, side: Int)
}

fn describe(shape: Shape) -> String {
  shape match {
    Circle(center: Point(x: 0, y: 0), radius:) -> "origin circle r=#{radius}"
    Circle(radius:, ..) if radius > 100 -> "big circle"
    Circle(..) -> "circle"
    Square(side:, ..) -> "square #{side}"
  }
}

fn main() {
  origin = Point(x: 0, y: 0)
  dbg(describe(Circle(center: origin, radius: 5)))    # "origin circle r=5"
  dbg(describe(Circle(center: Point(x: 1, y: 1), radius: 200)))  # "big circle"
  dbg(describe(Square(corner: origin, side: 3)))      # "square 3"
}
```

- `match` は後置で、`式 match { 腕 }` と書きます。網羅していなければコンパイルエラーです（sealed interface の `switch` と同じ）。
- パターンの中にリテラルを書けます（`Point(x: 0, y: 0)`）。Java のように `when` で比べ直さなくて済みます。
- `when` に当たるガードは `if` です。ガード付きの腕は網羅の判定に数えません。
- フィールドは名前で取り出し（`radius:`）、使わないものは `..` で省きます。`var` や型を書く必要はありません。
- `case A, B ->` のように腕をまとめる書き方はありません。腕を分けて書きます。
- バリアントは型ではないので、`case Circle c` のようにバリアントの値を変数に入れて渡すことはできません。渡したいときは、中身を別の `type` にします。

詳しくは[パターンマッチ](/guide/pattern-matching/)を見てください。

## null と Optional

Emela に null はありません。`Optional` に当たる `Option[A]` だけがあり、フィールドにも引数にもそのまま使えます。

```java
record Address(String city) {}
record User(int id, String name, Address address) {}   // address は null のことがある

static Optional<User> findUser(int id) {
    return USERS.stream().filter(u -> u.id() == id).findFirst();
}

static String cityOf(int id) {
    return findUser(id)
        .map(User::address)
        .map(Address::city)
        .orElse("unknown");
}

static User requireUser(int id) throws NotFoundException {
    return findUser(id).orElseThrow(() -> new NotFoundException(id));
}
```

```emela check
error NotFound(id: Int)

type Address(city: String)

type User(id: Int, name: String, address: Option[Address])

const USERS = [
  User(id: 1, name: "alice", address: Some(Address(city: "Tokyo"))),
  User(id: 2, name: "bob", address: None),
]

fn find_user(id: Int) -> Option[User] {
  USERS |> List.find(fn(u) { u.id == id })
}

fn city_of(id: Int) -> String {
  find_user(id)
    |> Option.and_then(fn(u) { u.address })
    |> Option.map(fn(a) { a.city })
    |> Option.or("unknown")
}

fn require_user(id: Int) -> User fails NotFound {
  find_user(id) |> Option.or_fail(NotFound(id:))
}

fn main() {
  dbg(city_of(1))                         # "Tokyo"
  dbg(city_of(2))                         # "unknown"
  dbg(require_user(3) escape { NotFound(_) -> User(id: 0, name: "guest", address: None) })
}
```

- `Optional.map` は関数が null を返すと空になりますが、Emela では `Option` を返す関数は `Option.and_then` でつなぎます。
- `orElse` は `Option.or`、`orElseThrow` は `Option.or_fail` です。`Optional.get()` のように中身がないと例外になる関数はありません。どうしても落とすなら `match` に `None -> panic("...")` の腕を書きます。
- `Optional` をフィールドに使わない、という Java の慣習はありません。ないかもしれないフィールドは `Option[A]` にします。

## 検査例外と fails

Java の検査例外と同じく、Emela のエラーは関数の型に出て、受けていなければコンパイラが止めます。

```java
class NotFoundException extends Exception {
    NotFoundException(int id) { super("not found: " + id); }
}
class ForbiddenException extends Exception {}

record User(int id, String name, boolean admin) {}

static User load(int id) throws NotFoundException {
    if (id == 1) return new User(1, "alice", false);
    throw new NotFoundException(id);
}

static User loadAdmin(int id) throws NotFoundException, ForbiddenException {
    User user = load(id);
    if (!user.admin()) throw new ForbiddenException();
    return user;
}

User user;
try {
    user = loadAdmin(1);
} catch (NotFoundException e) {
    user = new User(0, "guest", false);
} catch (ForbiddenException e) {
    user = new User(0, "nobody", false);
}
```

```emela check
error NotFound(id: Int)
error Forbidden

type User(id: Int, name: String, admin: Bool)

fn load(id: Int) -> User fails NotFound {
  if id == 1 { User(id: 1, name: "alice", admin: False) } else { fail NotFound(id:) }
}

# 推論される型: fn(Int) -> User fails NotFound | Forbidden
fn load_admin(id: Int) {
  user = load(id)
  if user.admin { user } else { fail Forbidden }
}

fn main() {
  user = load_admin(1) escape {
    NotFound(_) -> User(id: 0, name: "guest", admin: False)
    Forbidden -> User(id: 0, name: "nobody", admin: False)
  }
  dbg(user.name)                          # "nobody"
  dbg(Some(load(2)) escape { NotFound(_) -> None })   # None
}
```

`throws` を書かずに検査例外を投げるとコンパイルが通らないのと同じく、`-> T` と書いた関数でエラーを受けずにおくとエラーになります。

```emela check=error
error NotFound(id: Int)

fn load(id: Int) -> String fails NotFound {
  if id == 1 { "alice" } else { fail NotFound(id:) }
}

fn name_of(id: Int) -> String {
  load(id)          # error[E0318]: unhandled error `NotFound`
}

fn main() {
  dbg(name_of(1))
}
```

検査例外と違うのは次の点です。

- `throws` はいつも書きますが、`fails` は戻り値の型ごと省けば推論されます（上の `load_admin`）。`-> T` と書けば「エラーなし」、`-> T fails A | B` と書けば「ちょうどこの集合」の意味になります。
- エラーに継承はありません。`catch (Exception e)` や `throws Exception` のように親でまとめて受けたり宣言したりはできず、`escape` の腕にはエラーの構成子を1つずつ書きます。
- エラーはタグ名で区別します。`NotFound(id: 1)` と `NotFound(id: 2)` は同じエラーで、`fails NotFound` で両方を表します。
- `main` まで漏れたエラーは、実行時に `error: NotFound(id: 2)` と出して終了コード 1 で終わります。`main` に `throws` を書くのと似ていますが、`main` には何も書きません。

検査例外でいちばん困るのはラムダです。`Function<T, R>` は検査例外を投げられないので、`stream().map(...)` の中で `throws` のあるメソッドを呼べず、`RuntimeException` に包むことになります。Emela では引数に取る関数のエラーが呼び出し元へそのまま伝わるので、包む必要がありません。

```java
// コンパイルエラー: unreported exception IOException
List<String> lines = paths.stream().map(p -> Files.readString(p)).toList();

// よくある回避: 非検査例外に包む
List<String> lines = paths.stream().map(p -> {
    try { return Files.readString(p); }
    catch (IOException e) { throw new UncheckedIOException(e); }
}).toList();
```

```emela check
error DbError(message: String)
error Unavailable(reason: String)

fn query(sql: String) -> List[Int] fails DbError {
  if String.contains(sql, "users") { [1, 2, 3] } else { fail DbError(message: "no such table") }
}

# catch して別の例外で投げ直す、に当たる
fn order_ids() -> List[Int] fails Unavailable {
  query("select id from orders") escape {
    DbError(message:) -> fail Unavailable(reason: message)
  }
}

# ラムダの中の ParseError が、そのまま parse_all の fails に出る
fn parse_all(inputs: List[String]) -> List[Int] fails ParseError {
  inputs |> List.map(fn(s) { Int.parse(s) })
}

fn main() {
  dbg(Some(order_ids()) escape { Unavailable(_) -> None })        # None
  dbg(parse_all(["1", "2"]))                                      # [1, 2]
  dbg(parse_all(["1", "x"]) escape { ParseError(_) -> [] })       # []
}
```

- `List.map` の引数の型は `fn(A) -> B` で、`fails` を書いていません。引数の位置の関数型では、これが「何で失敗してもよく、そのエラーは呼び出し元へ伝わる」の意味です。
- 原因の例外を `getCause()` で辿る仕組みはありません。包み直すときは、必要な情報をフィールドに移します（`Unavailable(reason: message)`）。

詳しくは[エラー](/guide/errors/)を見てください。

## 非検査例外と defect

`NullPointerException` や `IllegalStateException` のような、プログラムの誤りを表す非検査例外に当たるのが defect です。型に出ず、`escape` でも受けられません。

```java
static int ratio(int a, int b) {
    if (b < 0) throw new IllegalArgumentException("negative divisor: " + b);
    return a / b;   // b == 0 なら ArithmeticException
}
```

```emela check
fn ratio(a: Int, b: Int) -> Int {
  if b < 0 { panic("negative divisor: #{b}") }
  a / b
}

fn main() {
  dbg(ratio(6, 3))
  dbg(ratio(1, 0))
}
```

```console
$ emela run main.emel
2
defect: division by zero
$ echo $?
101
```

- `throw new IllegalStateException(...)` は `panic("...")`、未実装の `throw new UnsupportedOperationException()` は `todo()` です。
- `catch (RuntimeException e)` のように defect を途中で受けることはできません。受けられるのはプログラムの最上位、テストランナー、`Fiber.attempt` の3か所だけです。Web サーバーのリクエストごとの「どんな例外でも 500 を返す」は、`Fiber.attempt` で書きます。
- 期待されるエラーを defect に変えるには、`escape` の腕で `panic` を呼びます。逆の向き（defect をエラーに戻す）は境界でしかできません。
- defect が起きても、途中のハンドラの `release` は走ります（`finally` と同じ）。

## interface と依存性の注入

Spring でコンストラクタに interface を注入していた依存は、エフェクトとして宣言します。実装はハンドラで、どの実装を使うかは呼ぶ側が `with` で決めます。DI コンテナはありません。

```java
public interface UserRepository {
    User find(int id) throws NotFoundException;
}

public interface Mailer {
    void send(String to, String body);
}

@Service
public class WelcomeService {
    private final UserRepository users;
    private final Mailer mailer;

    public WelcomeService(UserRepository users, Mailer mailer) {
        this.users = users;
        this.mailer = mailer;
    }

    public String welcome(int id) throws NotFoundException {
        User user = users.find(id);
        mailer.send(user.name(), "Welcome, " + user.name());
        return user.name();
    }
}
```

```emela check
import Std.Console.{Console, SystemConsole}

error NotFound(id: Int)

type User(id: Int, name: String)

effect Users {
  fn find(id: Int) -> User fails NotFound
}

effect Mailer {
  fn send(to: String, body: String) -> ()
}

# 依存は use 節に出る。サービスのクラスもコンストラクタもない
fn welcome(id: Int) -> String fails NotFound use { Users, Mailer } {
  user = (use Users).find(id)
  (use Mailer).send(user.name, "Welcome, #{user.name}")
  user.name
}

handler InMemoryUsers implements Users {
  fn find(id) {
    if id == 1 { User(id: 1, name: "alice") } else { fail NotFound(id:) }
  }
}

handler ConsoleMailer implements Mailer {
  fn send(to, body) { (use Console).print_line("to #{to}: #{body}") }
}

# @Configuration で Bean を並べるのに当たる
layer AppLive {
  InMemoryUsers
  ConsoleMailer
  SystemConsole
}

fn main() {
  with AppLive {
    dbg(welcome(1))
  }
}
```

```console
$ emela run main.emel
to alice: Welcome, alice
"alice"
```

- `welcome` の型に `use { Users, Mailer }` が出るので、何に依存しているかがシグネチャで分かります。供給し忘れはコンパイルエラーです（E0402）。Spring の起動時の `NoSuchBeanDefinitionException` に当たるものはありません。
- `layer` の中の並び順は意味を持ちません。ハンドラの依存（`ConsoleMailer` は `Console` を使う）から、コンパイラが初期化の順を決めます。
- 能力の値（`use Users` が返すもの）は、フィールドに入れる、引数に渡す、返す、のどれもできません。オブジェクトに依存を持たせる書き方はできないので、使う関数ごとに `use` で受けます。
- `@Scope("request")` のように寿命を変えたいときは、`with` を置く場所を変えます。`with` の本体の間だけハンドラが生きます。

### テストとモック

Mockito でモックを作っていたところは、テスト用のハンドラを書いて `with` で差し替えます。呼ばれたかどうかの `verify` は、ハンドラが `State` に記録して確かめます。

```java
@ExtendWith(MockitoExtension.class)
class WelcomeServiceTest {
    @Mock UserRepository users;
    @Mock Mailer mailer;
    @InjectMocks WelcomeService service;

    @Test
    void sendsOneMail() throws Exception {
        when(users.find(1)).thenReturn(new User(1, "alice"));
        assertEquals("alice", service.welcome(1));
        verify(mailer).send(eq("alice"), anyString());
    }
}
```

```emela check
import Std.State.{State}

error NotFound(id: Int)

type User(id: Int, name: String)

effect Users {
  fn find(id: Int) -> User fails NotFound
}

effect Mailer {
  fn send(to: String, body: String) -> ()
}

fn welcome(id: Int) -> String fails NotFound use { Users, Mailer } {
  user = (use Users).find(id)
  (use Mailer).send(user.name, "Welcome, #{user.name}")
  user.name
}

handler FakeUsers implements Users {
  fn find(id) {
    if id == 1 { User(id: 1, name: "alice") } else { fail NotFound(id:) }
  }
}

# 呼ばれた宛先を記録する。verify の代わり
handler RecordingMailer implements Mailer {
  fn send(to, body) {
    (use State[List[String]]).update(fn(sent) { List.append(sent, [to]) })
  }
}

@test
fn welcome_sends_one_mail() {
  (name, sent) = State.run([], fn() {
    with FakeUsers, RecordingMailer { welcome(1) }
  })
  assert name == "alice"
  assert sent == ["alice"]
}

@test
fn welcome_sends_nothing_for_unknown_id() {
  (result, sent) = State.run([], fn() {
    with FakeUsers, RecordingMailer {
      Some(welcome(2)) escape { NotFound(_) -> None }
    }
  })
  assert result == None
  assert sent == []
}
```

```console
$ emela test main.emel
running 2 tests
test welcome_sends_one_mail ... ok
test welcome_sends_nothing_for_unknown_id ... ok

test result: ok. 2 passed; 0 failed; 0 filtered out
```

- `@test` を付けられるのは引数のない関数です。実装と同じファイルに書けるので、非公開の関数もそのままテストできます。テストのクラスはありません。
- `assertEquals(expected, actual)` の代わりに `assert a == b` と書きます。失敗すると `assertion failed: sent == []` の後に `left:` と `right:` の値が出ます。
- テストの関数は `throws Exception` を書かなくても、受けていないエラーをそのまま残せます。漏れたエラーはそのテストの失敗になります。
- `@BeforeEach` や `@ParameterizedTest` はありません。準備は普通の関数で、パラメータ化は `List.map` などで書きます。
- 標準ライブラリにはテスト用のハンドラ（`TestClock`、`TestConsole` など）があります。

詳しくは[エフェクト](/guide/effects/)と[テスト](/guide/testing/)を見てください。

## try-with-resources とハンドラ

`AutoCloseable` を try-with-resources で閉じていたものは、ハンドラの `init` で開き、`release` で閉じます。`with` を抜けるとき、正常終了でもエラーでも `release` が走ります。

```java
class FakeConnection implements AutoCloseable {
    private final String name;

    FakeConnection() {
        System.out.println("open");
        this.name = "main";
    }

    List<String> query(String sql) throws QueryFailedException {
        if (sql.equals("select name from users")) return List.of("alice", "bob");
        throw new QueryFailedException(sql);
    }

    @Override
    public void close() {
        System.out.println("close " + name);
    }
}

try (var conn = new FakeConnection()) {
    System.out.println(String.join(", ", conn.query("select name from users")));
} catch (QueryFailedException e) {
    System.out.println("failed: " + e.getMessage());
}
```

```emela check
import Std.Console.{Console, SystemConsole}

error QueryFailed(sql: String)

effect Db {
  fn query(sql: String) -> List[String] fails QueryFailed
}

handler FakeConnection(name: String) implements Db {
  init {
    (use Console).print_line("open")
    FakeConnection(name: "main")
  }

  release {
    (use Console).print_line("close #{self.name}")
  }

  fn query(sql) {
    if sql == "select name from users" { ["alice", "bob"] } else { fail QueryFailed(sql:) }
  }
}

fn main() {
  with SystemConsole {
    names = with FakeConnection {
      (use Db).query("select name from users")
    }
    (use Console).print_line(String.join(names, ", "))

    broken = with FakeConnection {
      (use Db).query("drop table users")
    } escape {
      QueryFailed(sql:) -> ["failed: #{sql}"]
    }
    (use Console).print_line(String.join(broken, ", "))
  }
}
```

```console
$ emela run main.emel
open
close main
alice, bob
open
close main
failed: drop table users
```

- `init` はハンドラの値を返します。フィールドのあるハンドラの値は `init` の中でしか作れないので、開かずに使うことはできません。
- `release` はエラーにできません（E0420）。`close() throws Exception` のように失敗しうる後始末は、`release` の中で `escape` するか `panic` にします。Java の suppressed exception に当たる仕組みはありません。
- 複数の資源は `with A, B { ... }` や `layer` に並べます。`release` は初期化の逆順に走ります。
- 閉じた後の接続を使う誤り（`conn` を try の外に持ち出す）は、能力の値を `with` の外へ出せない規則で防ぎます。0.20 では一部を実行時に検査し、`handler FakeConnection was used after release` の defect になります。

詳しくは[資源](/guide/resources/)を見てください。

## Stream API とパイプ

`stream()` から始めて `.collect` で終える代わりに、リストに `List` の関数を `|>` でつないでいきます。遅延評価のストリームはなく、各段がリストを返します。

```java
record Order(int id, String customer, int amount, boolean paid) {}

List<Integer> ids = orders.stream()
    .filter(Order::paid)
    .map(Order::id)
    .toList();

int total = orders.stream()
    .filter(Order::paid)
    .mapToInt(Order::amount)
    .sum();

boolean anyLarge = orders.stream().anyMatch(o -> o.amount() > 1000);

Optional<String> firstUnpaid = orders.stream()
    .filter(o -> !o.paid())
    .findFirst()
    .map(Order::customer);
```

```emela check
type Order(id: Int, customer: String, amount: Int, paid: Bool)

const ORDERS = [
  Order(id: 1, customer: "alice", amount: 1200, paid: True),
  Order(id: 2, customer: "bob", amount: 800, paid: False),
  Order(id: 3, customer: "alice", amount: 300, paid: True),
]

fn main() {
  paid = ORDERS |> List.filter(fn(o) { o.paid })

  ids = paid |> List.map(fn(o) { o.id })
  dbg(ids)                                          # [1, 3]

  total = paid |> List.fold(from: 0, f: fn(sum, o) { sum + o.amount })
  dbg(total)                                        # 1500

  dbg(ORDERS |> List.any(fn(o) { o.amount > 1000 }))   # True

  first_unpaid = ORDERS
    |> List.find(fn(o) { !o.paid })
    |> Option.map(fn(o) { o.customer })
  dbg(first_unpaid)                                 # Some("bob")
}
```

- `x |> f(a)` は `f(x, a)` です。左の値が第1引数に入ります。
- メソッド参照（`Order::id`）はありません。`fn(o) { o.id }` と書きます。名前のある関数は `List.map(xs, to_string)` のようにそのまま渡せます。
- `reduce` と `mapToInt(...).sum()` は `List.fold` で書きます。
- `Collectors.groupingBy` で使う `Map` は 0.21 で入る予定です。
- `for` 文もありません。繰り返しは `List` の関数か再帰で書きます。

`static` メソッドだけを集めたユーティリティクラスは、モジュールにします。1ファイルが1モジュールで、`src/money.emel` は `Money` になります。`private` コンストラクタと static ファクトリで値の作り方を絞っていたものは、`pub opaque type` で書きます。

```emela
# src/money.emel
pub opaque type Money(cents: Int)

pub error NegativeAmount(cents: Int)

pub fn of(cents: Int) -> Money fails NegativeAmount {
  if cents < 0 { fail NegativeAmount(cents:) } else { Money(cents:) }
}

pub fn add(a: Money, b: Money) -> Money {
  Money(cents: a.cents + b.cents)
}
```

使う側は `import Money` して `Money.of(100)` と呼びます。詳しくは[モジュール](/guide/modules/)を見てください。

## Virtual Thread と StructuredTaskScope

Java 21 の `StructuredTaskScope`（プレビュー）と同じく、Emela の並行処理はスコープの中でだけ fiber を起動します。スコープを抜けるときには子がすべて終わっています。

```java
record Profile(String user, List<Integer> orders) {}

static Profile loadProfile(int id) throws InterruptedException, ExecutionException {
    try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
        Subtask<String> user = scope.fork(() -> fetchUser(id));
        Subtask<List<Integer>> orders = scope.fork(() -> fetchOrders(id));
        scope.join().throwIfFailed();
        return new Profile(user.get(), orders.get());
    }
}

try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    List<Future<String>> users = executor.invokeAll(
        List.of(1, 2, 3).stream().<Callable<String>>map(id -> () -> fetchUser(id)).toList());
}
```

```emela check
import Std.Clock.{Clock, SystemClock}
import Std.Fiber.{Fiber}

error NotFound(id: Int)

type Profile(user: String, orders: List[Int])

fn fetch_user(id: Int) -> String fails NotFound use Clock {
  (use Clock).sleep(50)
  if id > 0 { "user #{id}" } else { fail NotFound(id:) }
}

fn fetch_orders(id: Int) -> List[Int] use Clock {
  (use Clock).sleep(80)
  [id * 10, id * 10 + 1]
}

fn load_profile(id: Int) -> Profile fails NotFound use { Clock, Async } {
  Fiber.scope(fn() {
    user = Fiber.fork(fn() { fetch_user(id) })
    orders = Fiber.fork(fn() { fetch_orders(id) })
    Profile(user: Fiber.join(user), orders: Fiber.join(orders))
  })
}

fn main() {
  with SystemClock {
    dbg(load_profile(1))     # Profile(user: "user 1", orders: [10, 11])
    dbg(Some(load_profile(0)) escape { NotFound(_) -> None })   # None
    dbg(Fiber.map([1, 2, 3], fn(id) { fetch_user(id) }))       # ["user 1", "user 2", "user 3"]
  }
}
```

- `ShutdownOnFailure` と同じく、子が失敗すると兄弟を中断し、エラーをスコープの外へ伝えます。違うのは、子のエラーが `ExecutionException` に包まれず、`NotFound` のまま `load_profile` の `fails` に出ることです。
- `InterruptedException` はありません。中断は型に出ず、中断された fiber は途中の `release` を走らせながら巻き戻ります。
- fiber は1つのスレッドの上で協調的に切り替わります。Virtual Thread と違ってキャリアスレッドのプールはなく、CPU を使う計算は fiber に分けても速くなりません。`synchronized` や `Lock` もありません。
- `ExecutorService` に投げっぱなしにする、スコープの外で走り続ける fiber はありません。常駐する処理は `main` の直下のスコープで fork します。
- `CompletableFuture.allOf` は `Fiber.all`、`anyOf` は `Fiber.race`、`orTimeout` は `Fiber.timeout` です。
- `Semaphore` と `Queue` は 0.21 で入る予定です。

詳しくは[並行性](/guide/concurrency/)を見てください。

## 気をつけるところ

- クラスも継承もありません。データは `type` と `enum`、振る舞いはモジュールの関数、差し替えたい実装はエフェクトとハンドラで書きます。
- メソッド呼び出しの構文（`user.rename(...)`）はありません。`.` で書けるのはフィールドの参照と、能力の値の操作（`(use Users).find(1)`）だけです。
- `var` も再代入もありません。同じ名前で束縛し直すと、以降は新しい束縛が見えます。可変な状態は `State` で持ちます。
- 文字列の連結に `+` は使えません。補間 `"#{a}#{b}"` を使います。`toString()` を書かなくても、補間と `dbg` は構造のまま表示します。
- 数の型は `Int`（32ビット）、`Int64`、`Float` です。`int` から `long` への暗黙の変換はありません。あふれると2の補数で巻き戻るのは Java と同じで、検出したいときは `Int.checked_add` を使います（[基本](/guide/basics/)）。
- 名前の書き方が決まっています。関数と変数は `snake_case`（`find_user`）、型は `PascalCase`、定数は `UPPER_CASE` です。
- オーバーロードはありません。引数の数や型が違う関数には別の名前を付けます。
- `interface` に当たる `trait` と `impl` は 0.21 で入る予定です。`Comparable` や `equals` の上書きもまだ書けず、今は `==` がすべての型で構造の比較になります。
- リフレクションとアノテーション処理はありません。`@test` のような注釈は言語が決めたものだけです。
- Java のライブラリは呼べません。外の関数を呼ぶ先は JavaScript か C です（[外部関数](/guide/external/)）。
