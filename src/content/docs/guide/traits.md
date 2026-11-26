---
title: Trait と導出
description: trait と impl、Trait の関数の呼び方、制約、derive と導出規則、組み込みの Trait、Show と Ord の規則
---

Trait は型への制約で、その型にどの関数が用意されているかを検査します。`==` は Eq を、文字列の補間は Show を使うというように、言語の決まった場所が Trait を求めます。環境によって差し替えたい振る舞いを書くのは Trait でなく [エフェクト](/guide/effects/) です。

```emela check
type User(id: Int, name: String)
  derive Eq, Show

trait Describe {
  fn describe(self) -> String
}

impl User: Describe {
  fn describe(self) { "user #{self.id}: #{self.name}" }
}

fn main() {
  user = User(id: 1, name: "alice")
  dbg(Describe.describe(user)) # "user 1: alice"
  dbg(user == User(id: 1, name: "alice")) # True
  _ = dbg("#{user}") # "User(id: 1, name: \"alice\")"
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

`trait Ord: Eq` は、Ord を実装する型が Eq も実装していることを求めます。前提が複数なら `trait A: B + C` と書きます。`[A: Ord]` の制約には前提も含まれるので、`[A: Ord]` の関数の中では `==` も使えます。

## impl

```emela
impl User: Show {
  fn show(self) { "User(#{self.name})" }
}
```

引数と戻り値の型は Trait の宣言から決まるので、impl では書きません。1つの型と1つの Trait の組に、実装はプログラム全体で1つだけです。型引数のある型の impl は、型引数への制約を頭に書きます（`impl Pair[A: Eq, B: Eq]: Eq`）。

impl を書けるのは、その型を定義したモジュールか、その Trait を定義したモジュールだけです。どちらの持ち主でもないときは、自分の型で包みます。

```emela
type MyDate(inner: ThirdParty.Date)

impl MyDate: Encode { ... }
```

フィールドが1つの型は、実行時のコストを持ちません。

## 呼び出しと制約

```emela
Show.show(user)
user |> Show.show

fn largest[A: Ord](xs: List[A]) -> Option[A] { ... }
fn report[A: Ord + Show](xs: List[A]) -> String { ... }
```

Trait の関数は `Show.show(user)` のように `Trait名.関数名(値)` の形で呼び、パイプにもそのままつなげます。`self` を取る関数は、その Trait が呼ぶ側のモジュールから名前で見えていれば（Prelude の Trait、`import` の波括弧で取り込んだ Trait、同じモジュールで定義した Trait）、`user.describe()` のように値の後ろに書いても呼べます。型引数への制約は `[A: Ord]` と書きます（[型引数](/guide/generics/)）。

`self` を取らず、戻り値にだけ Self がある関数（`Decode.decode(json)`）は、結果の型から impl を選びます。結果の型が関数の中で決まらないときはエラー（E3307）で、`n: Int = ...` のように型を書きます。

Trait の関数は既定では純粋です。宣言に `fails E` や `uses { R }` を書けば、実装はその範囲でエラーと効果を持てます。実装が宣言の範囲を超えられないので、`[A: Decode]` を使う関数のエラーと効果は、どの型の実装が選ばれても変わりません。

## derive

```emela
type User(id: Int, name: String, email: Email)
  derive Eq, Show, Encode
```

derive に並べた Trait の実装を、コンパイラが型の構造から作ります。作られるのはふつうの impl で、各フィールドはそのフィールドの型の実装を通ります。`Email` に手書きの Encode があれば、使われるのはそれです。

導出した Ord はバリアントを宣言の順に小さいとし、同じバリアントならフィールドを前から順に比べます。

導出できるのは、導出規則をコンパイラが持つ次の Trait だけです。ほかの Trait を derive に書くとエラー（E3302）です。

| Trait | 置き場所 | 導出の形 |
|---|---|---|
| Eq、Ord | Prelude | 2つの値をフィールドごとに比べる |
| Show | Prelude | フィールドごとの結果をまとめる |
| Encode、Decode、ObjectKey | `Std.Dynamic` | 値と動的な値（JSON など）を行き来する |
| Shaped | `Std.Shape` | 型の形を記述する |

- フィールドの型がその Trait を満たさなければ導出できません（E3302）。Float は Ord を満たさないので、Float のフィールドを持つ型には `derive Ord` を書けません。
- 前提の Trait は自動では導出しません。`derive Ord` には Eq の derive か impl が要ります。
- 同じ型と Trait の組に derive と手書きの impl を両方書くとエラー（E3305）です。
- 型引数のある型に導出すると、すべての型引数に同じ制約が付きます（`enum Tree[A] { ... } derive Eq` は `impl Tree[A: Eq]: Eq`）。
- 非公開の型に導出した実装がどこでも使われないときは警告（W3301）になります。

## 組み込みの Trait

| Trait | 使う場所 | 自分で impl を |
|---|---|---|
| Eq | `==` `!=` | 書ける |
| Ord | `<` `<=` `>` `>=` | 書ける |
| Show | 文字列の補間 | 書ける |
| Immediate | 効果が中断しないこと | 書けない（自動で判定） |

Eq、Ord、Show は Prelude にあり、import なしで使えます。関数型はこの3つのどれも満たしません。Map と Set のキーには Ord を求めます。Immediate は効果の集合に掛ける制約です（[中断する操作](/guide/suspend/)、[外部関数](/guide/external/)）。

関連型、高カインド型への Trait、実行時の動的ディスパッチ、`Add` のような演算子ごとの Trait はありません。

### Show の形

Show は値をソースで作るときの形で表します。

```emela check
import Std.Console.{Console, SystemConsole}

enum Shape {
  Circle(radius: Float)
  Rect(Float, Float)
  Empty
} derive Show

type User(id: Int, name: String)
  derive Show

fn main() {
  with SystemConsole {
    console <- Console
    console.print_line("#{Circle(radius: 1.0)} #{Rect(1.0, 2.0)} #{Empty}")
    console.print_line("#{(1, "a")} #{[1, 2, 3]} #{()}")
    console.print_line("#{User(id: 1, name: "alice")}")
    console.print_line("#{"plain"} #{["a\"b", "c\\d", "x\#{y}"]}")
    console.print_line("#{True} #{2.0} #{-0.0} #{1.0e21} #{-0.000000025} #{0.1 + 0.2}")
    console.print_line("#{Int64.from_int(5)}")
    _ = dbg("plain")
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

### Eq と Ord の形

自分で定義した型は、derive か impl を書かないと Eq、Ord、Show のどれも満たしません。`dbg` だけは Show がなくても値を表示します。Show を満たす型なら、手書きの impl も含めてその Show で表示します。

```emela check
type User(id: Int, name: String)
  derive Eq

enum Shape {
  Circle(radius: Float)
  Empty
} derive Eq

fn main() {
  a = User(id: 1, name: "alice")
  dbg(a == User(id: 1, name: "alice")) # True
  dbg(a != User(id: 2, name: "alice")) # True
  dbg([Circle(radius: 1.0), Empty] == [Circle(radius: 1.0), Empty]) # True
  dbg(Some(1) == None) # False
  nan = 0.0 / 0.0
  dbg(nan == nan) # False
  dbg(0.0 == -0.0) # True
  dbg("apple" < "banana") # True
  _ = dbg(False < True) # True
}
```

- Int、Int64、String、Bool は Eq、Ord、Show を満たします。Float は Eq と Show を満たし、Ord は満たしません。
- タプル、List、Option は、要素の型が満たす Trait を満たします。Ord は辞書式に比べます（`[1, 2] < [1, 3]` は True）。
- String の大小は Unicode のコードポイントの辞書式の順です。
- Float の `<` などは Ord を通らない組み込みの演算子で、IEEE 754 の比較に従います（`NaN` との比較はすべて False）。Float の全順序が要るときは `List.sort_by(xs, Float.compare)` のように `Float.compare` を渡します。
- 関数の値どうしの `==` はコンパイルエラー（E3302）です。
