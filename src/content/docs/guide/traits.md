---
title: Trait と導出
description: trait と impl、Trait の関数の呼び方、制約、derive と導出規則、組み込みの Trait、Show と Ord の規則
---

:::caution[0.21 で入る予定]
`trait`、`impl`、`derive` と Trait の制約の検査は 0.21 で入ります。このページは仕様の形を書いています。0.20 で今どう動くかは、最後の「0.20 での動き」にまとめました。
:::

Trait は型への制約で、その型にどの関数が用意されているかを検査するためのものです。`==` が Eq を、文字列の補間が Show を使うように、言語の決まった場所が Trait を求めます。環境によって差し替えたい振る舞いは Trait でなく、[エフェクト](/guide/effects/)で書きます。

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

- `self` は第1引数で、型は `Self`（実装する型）です。
- `self` を取らない関数も書けます（上の `decode`）。どの型の実装を使うかは、期待される戻り値の型から決まります。
- 本体を持つ関数は既定の実装で、impl で省略できます。
- `trait A: B` は、A を実装する型が B も実装していることを求めます。上位の Trait が複数なら `trait A: B + C` と書きます。

## impl

```emela
impl Show for User {
  fn show(self) { "User(#{self.name})" }
}
```

- 引数と戻り値の型は Trait の宣言から決まるので書きません（ハンドラの操作と同じ）。
- 1つの型と1つの Trait の組に、実装はプログラム全体で1つだけです。
- impl を書けるのは、その型を定義したモジュールか、その Trait を定義したモジュールだけです。

どちらの持ち主でもないときは、自分の型で包みます。フィールドが1つの型は、実行時のコストを持ちません。

```emela
type MyDate(inner: ThirdParty.Date)

impl Encode for MyDate { ... }
```

Rust の孤児規則に近いですが、Emela には包む型のための特別な構文はなく、ふつうの `type` で書きます。

## 呼び出しと制約

```emela
Show.show(user)
user |> Show.show

fn largest[A: Ord](xs: List[A]) -> Option[A] { ... }
fn report[A: Ord + Show](xs: List[A]) -> String { ... }
```

- Trait の関数は `Trait名.関数名(値)` の形で呼びます。`user.show()` のようなメソッド呼び出しの構文はありません。パイプ（`|>`）とはそのまま組み合わせられます。
- 型引数への制約は `[A: Ord]`、複数なら `[A: Ord + Show]` と書きます（[ジェネリクス](/guide/generics/)）。
- `==` と `!=` は Eq、`<` `<=` `>` `>=` は Ord、文字列の補間は Show の実装を使います。

### Trait の関数のエラーと効果

- Trait の関数は、既定では純粋です。
- 宣言に `fails E` や `use R` を書けば、実装はその範囲でエラーと効果を持てます。実装は宣言の範囲を超えられません。
- そのため、`[A: Decode]` を使う関数の E と R は、Trait の宣言だけで決まります。どの型の実装が選ばれても変わりません。

## derive

```emela
type User(id: Int, name: String, email: Email)
  derive Eq, Show, Encode
```

- derive に並べた Trait の実装を、コンパイラが型の構造から作ります。作られるのはふつうの impl です。
- 各フィールドは、そのフィールドの型自身の実装を通ります。Email に手書きの Encode があれば、それが使われます。
- 同じ型と Trait の組に、derive と手書きの impl の両方があるとエラーです。
- 導出した Ord は、バリアントを宣言の順に小さいとし、同じバリアントならフィールドを前から順に比べます。Bool は `False` を先に宣言しているので `False < True` です。
- 導出できるのは、導出規則を持つ Trait だけです。

### 導出規則

導出規則は Trait の作者が書きます。形は次の3種類です。

| 導出の型 | 形 | 例 |
|---|---|---|
| 畳み込み | 値を1つ受け取り、フィールドごとの結果をまとめる | Show、Encode、Hash |
| 突き合わせ | 値を2つ受け取り、フィールドごとに比べる | Eq、Ord |
| 組み立て | フィールドごとの生成結果から値を作る | Decode、Default |

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

- Eq、Ord、Show、Hash は Prelude にあり、import なしで使えます。
- 関数型は Eq、Ord、Show、Hash を満たしません。
- Immediate は効果の集合に掛ける制約です（[中断する操作](/guide/suspend/)、[外部関数](/guide/external/)）。

関連型、高カインド型への Trait、実行時の動的ディスパッチ、演算子ごとの Trait（`Add` など）、利用者が定義する自動判定の Trait はありません。

### 基本型の Show と Ord

- Bool の Show は `True` / `False`（構成子の名前）です。
- Float の Show は、往復できる最短の桁数で表します（JS の `Number.prototype.toString` と同じ規則）。有限の整数値には `.0` を付けます（`1.0`）。それ以外は `1e+21`、`-2.5e-8`、`Infinity`、`NaN` の形です。どのターゲットでも同じ文字列になります。
- Float の `-0.0` は `0.0` と表示します。
- Int64 の Show に接尾辞は付きません。
- String の Ord は、Unicode のコードポイントの辞書順です。
- Float の Eq は IEEE 754 の比較に従います。`NaN` は自分自身とも等しくなく、`0.0 == -0.0` です。

### 導出した Show の形

導出した Show は、値をソースで作るときの形で表します。

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

- 補間で引用符を付けずに埋め込むのは、最上位の String だけです。リストや構成子の中の String と、`dbg` の String は `"` で囲みます。
- 囲むときは `\"`、`\\`、`\n`、`\t`、`\r` と、`#{` の前の `\#` でエスケープします。それ以外の制御文字（U+0000〜U+001F、U+007F）は `\u{...}` と出します。

## 0.20 での動き

0.20 には Trait の検査がまだありません。かわりに、`==` `!=` と補間（と `dbg`）が、型の構造のまま、すべての型で動きます。derive を書かなくても、自分で定義した型を比べたり表示したりできます。

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

- 表示の形は、上の「導出した Show の形」と同じです。
- 大小比較は、Int、Int64、Float、String、Bool で動きます。タプル、リスト、自分で定義した型の `<` は `not supported yet: this operator on this type` になります。
- `trait` の宣言、`impl`、`derive` は `emela check` を通ります。ただし Trait の関数を呼ぶ（`Show.show(x)`、`Describe.describe(user)`）と `not supported yet: reference to this kind of definition` になります。
- 手書きの `impl Show` を書いても、補間と `dbg` は使わず、構造のまま表示します。
- 制約（`[A: Ord]`）の構文は受け付けますが、検査しません。型引数の値に `<` を使う関数はまだコンパイルできません（[ジェネリクス](/guide/generics/)）。
- 関数の値どうしの `==` も今は通ってしまいます。仕様では関数型は Eq を満たさないので、書かないでください。
