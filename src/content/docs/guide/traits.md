---
title: Trait と導出
description: trait と impl、Trait の関数の呼び方、制約、derive と導出規則、組み込みの Trait、Show と Ord の規則
---

:::caution[0.21 で入る予定]
`trait`、`impl`、`derive` と Trait の制約の検査は 0.21 で入ります。このページは仕様の形を書いています。0.20 で今どう動くかは、最後の「0.20 での動き」にまとめました。
:::

Trait は型への制約で、その型にどの関数が用意されているかを検査します。`==` は Eq を、文字列の補間は Show を使うというように、言語の決まった場所が Trait を求めます。環境によって差し替えたい振る舞いを書くのは Trait でなく [エフェクト](/guide/effects/) です。

```emela
type User(id: Int, name: String)
  derive Eq, Show

trait Describe {
  fn describe(self) -> String
}

impl Describe for User {
  fn describe(self) { "user #{self.id}: #{self.name}" }
}

fn main() {
  user = User(id: 1, name: "alice")
  dbg(Describe.describe(user))    # "user 1: alice"
  dbg(user)                       # User(id: 1, name: "alice")
}
```

## trait

```emela
trait Show {
  fn show(self) -> String
}

trait Ord: Eq {                          # Eq を前提とする
  fn compare(self, other: Self) -> Ordering

  fn max(self, other: Self) -> Self {    # 既定の実装
    Ord.compare(self, other) match {
      Less -> other
      _    -> self
    }
  }
}

trait Decode {
  fn decode(json: Json) -> Self fails DecodeError
}
```

`self` は第1引数で、型は実装する型 `Self` です。`decode` のように `self` を取らない関数も書けて、どの型の実装を使うかは期待される戻り値の型で決まります。本体を持つ `max` は既定の実装なので、impl で省けます。

`trait Ord: Eq` は、Ord を実装する型が Eq も実装していることを求めます。前提が複数なら `trait A: B + C` と書きます。

## impl

```emela
impl Show for User {
  fn show(self) { "User(#{self.name})" }
}
```

引数と戻り値の型は Trait の宣言から決まるので、impl では書きません。1つの型と1つの Trait の組に、実装はプログラム全体で1つだけです。

impl を書けるのは、その型を定義したモジュールか、その Trait を定義したモジュールだけです。どちらの持ち主でもないときは、自分の型で包みます。

```emela
type MyDate(inner: ThirdParty.Date)

impl Encode for MyDate { ... }
```

フィールドが1つの型は、実行時のコストを持ちません。

## 呼び出しと制約

```emela
Show.show(user)
user |> Show.show

fn largest[A: Ord](xs: List[A]) -> Option[A] { ... }
fn report[A: Ord + Show](xs: List[A]) -> String { ... }
```

Trait の関数は `Show.show(user)` のように `Trait名.関数名(値)` の形で呼び、パイプにもそのままつなげます。`user.show()` のようなメソッド呼び出しの構文はありません。型引数への制約は `[A: Ord]` と書きます（[型引数](/guide/generics/)）。

Trait の関数は既定では純粋です。宣言に `fails E` や `use R` を書けば、実装はその範囲でエラーと効果を持てます。実装が宣言の範囲を超えられないので、`[A: Decode]` を使う関数のエラーと効果は、どの型の実装が選ばれても変わりません。

## derive

```emela
type User(id: Int, name: String, email: Email)
  derive Eq, Show, Encode
```

derive に並べた Trait の実装を、コンパイラが型の構造から作ります。作られるのはふつうの impl で、各フィールドはそのフィールドの型の実装を通ります。`Email` に手書きの Encode があれば、使われるのはそれです。

導出した Ord はバリアントを宣言の順に小さいとし、同じバリアントならフィールドを前から順に比べます。

導出できるのは、導出規則を持つ Trait だけです。導出規則は Trait の作者が書き、値を1つ受け取ってフィールドごとの結果をまとめる形（Show、Encode、Hash）、2つの値をフィールドごとに比べる形（Eq、Ord）、フィールドごとに作った値から全体を組み立てる形（Decode、Default）があります。

構文はまだ決まっていません。今は次のような形を想定しています。

```emela
trait Encode {
  fn encode(self) -> Json

  derive fold {
    record(name, fields) { Json.object(fields) }
    variant(name, tag, payload) {
      Json.object([("tag", Json.string(tag)), ("value", payload)])
    }
  }
}
```

## 組み込みの Trait

| Trait | 使う場所 | 自分で impl を |
|---|---|---|
| Eq | `==` `!=` | 書ける |
| Ord | `<` `<=` `>` `>=` | 書ける |
| Show | 文字列の補間、`dbg` | 書ける |
| Hash | Map と Set のキー | 書ける |
| Immediate | 効果が中断しないこと | 書けない（自動で判定） |

Eq、Ord、Show、Hash は Prelude にあり、import なしで使えます。関数型はこの4つのどれも満たしません。Immediate は効果の集合に掛ける制約です（[中断する操作](/guide/suspend/)、[外部関数](/guide/external/)）。

関連型、高カインド型への Trait、実行時の動的ディスパッチ、`Add` のような演算子ごとの Trait はありません。

### Show の形

Show は値をソースで作るときの形で表します。

```emela check
import Std.Console.{Console, SystemConsole}

enum Shape {
  Circle(radius: Float)
  Rect(Float, Float)
  Empty
}

type User(id: Int, name: String)

fn main() {
  with SystemConsole {
    console = use Console
    console.print_line("#{Circle(radius: 1.0)} #{Rect(1.0, 2.0)} #{Empty}")
    console.print_line("#{(1, "a")} #{[1, 2, 3]} #{()}")
    console.print_line("#{User(id: 1, name: "alice")}")
    console.print_line("#{"plain"} #{["a\"b", "c\\d", "x\#{y}"]}")
    console.print_line("#{True} #{2.0} #{-0.0} #{1.0e21} #{-0.000000025} #{0.1 + 0.2}")
    console.print_line("#{Int64.from_int(5)}")
    dbg("plain")
  }
}
```

```console
$ emela run main.emel
Circle(radius: 1.0) Rect(1.0, 2.0) Empty
(1, "a") [1, 2, 3] ()
User(id: 1, name: "alice")
plain ["a\"b", "c\\d", "x\#{y}"]
True 2.0 0.0 1e+21 -2.5e-8 0.30000000000000004
5
"plain"
```

補間に引用符なしで埋め込むのは、最上位の String だけです。リストや構成子の中の String と、`dbg` の String は `"` で囲んでエスケープします。Float は往復できる最短の桁数で表し、整数の値には `.0` を付けます。この文字列はどのターゲットでも同じです。

## 0.20 での動き

0.20 には Trait の検査がまだありません。かわりに `==`、`!=`、補間、`dbg` が型の構造のまますべての型で動くので、derive を書かなくても自分で定義した型を比べたり表示したりできます。

```emela check
type User(id: Int, name: String)

enum Shape {
  Circle(radius: Float)
  Empty
}

fn main() {
  a = User(id: 1, name: "alice")
  dbg(a == User(id: 1, name: "alice"))                               # True
  dbg(a != User(id: 2, name: "alice"))                               # True
  dbg([Circle(radius: 1.0), Empty] == [Circle(radius: 1.0), Empty])  # True
  dbg(Some(1) == None)                                               # False
  nan = 0.0 / 0.0
  dbg(nan == nan)                                                    # False
  dbg(0.0 == -0.0)                                                   # True
  dbg("apple" < "banana")                                            # True
  dbg(False < True)                                                  # True
}
```

表示の形は上の「Show の形」と同じです。大小比較は Int、Int64、Float、String、Bool で動き、タプルやリスト、自分で定義した型の `<` は `not supported yet: this operator on this type` になります。

`trait` の宣言、`impl`、`derive` は `emela check` を通りますが、`Show.show(x)` のように Trait の関数を呼ぶと `not supported yet: reference to this kind of definition` になります。手書きの `impl Show` を書いても、補間と `dbg` はそれを使わず構造のまま表示します。

関数の値どうしの `==` も今は通ってしまいます。仕様では関数型は Eq を満たさないので、書かないでください。
