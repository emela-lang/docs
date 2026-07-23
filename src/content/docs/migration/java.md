---
title: Java から
description: Java を書いてきた人のための Emela 入門
---

Java から来ると、**クラス・継承が無い** ことと **すべて不変** なことが大きな変化です。
一方で、`int` が 32bit で wrap する点や、**検査例外がシグネチャに現れる** 感覚は Emela の `throws` によく似ています。

## 対応表

| Java | Emela |
|---|---|
| `class`（データ + メソッド） | `record`（データ）+ `trait`/`impl`（振る舞い） |
| `interface` | `trait` |
| 継承 `extends` | 無し（合成と trait 境界） |
| `null` | `Option<T>`（`Some` / `None`） |
| 検査例外 `throws IOException` | `throws E`（型に現れる。近い感覚） |
| `try`/`catch` | `try`–`catch`（式） |
| ジェネリクス（型消去） | ジェネリクス（**単相化**。実行時に型が残る形で特殊化） |
| `enum`（限定的） | `enum`（payload を持てる本物の直和型） |
| `switch` | `match`（網羅的・式） |
| Maven / Gradle | Pome（`emela pome add`） |

## クラスは無い：record + trait

Java のクラスは「データ」と「メソッド」を1つにまとめますが、Emela では分かれます。

```java
interface Shape { double area(); }

class Circle implements Shape {
    private final double r;
    Circle(double r) { this.r = r; }
    public double area() { return Math.PI * r * r; }
}
```

```emela
trait Shape {
    fn area(self: Self) -> Float
}

record Circle { r: Float }

impl Shape for Circle {
    fn area(self: Circle) -> Float { 3.14 * self.r * self.r }
}

let c = Circle { r: 2.0 }
c.area()   -- レシーバ構文
```

継承階層は作れません。「is-a」ではなく trait の実装と合成で組み立てます。

## null は Option

Java 8 の `Optional<T>` に近いですが、Emela では `Option<T>` が基本で、null は言語に存在しません。

```java
Optional<User> findUser(int id);
```

```emela
fn find_user(id: Int) -> Option<User> uses { Db } { ... }

match find_user(1) {
    Some(u) -> u.name
    None -> "unknown"
}
```

## 検査例外に近い throws

Java の検査例外はメソッドシグネチャに現れ、呼び出し側が `try`/`catch` か再送出を強制されます。
Emela の `throws E` はこれによく似ています。伝播は `?`、捕捉は `try`–`catch` です。

```emela
fn load(path: Path) -> Config throws IoError uses { Fs } {
    let text = read(path)?   -- Java の「throws を再送出」に相当
    parse(text)?
}
```

ただし違いもあります。

- `throws E` の `E` は **単一の型**（複数種類は `enum` で束ねる）。
- **`main` は `throws Never`**。トップまで例外を投げ抜けることはできず、必ずどこかで処理します。
- error（`throws`）と副作用（`uses`）は **別の channel**。例外は capability ではありません。

## int の wrap は同じ、ジェネリクスは違う

- `Int` は i32・2の補数で、`+ - *` は **wrap** します。Java の `int` と同じ挙動です。
- 一方ジェネリクスは Java の **型消去** ではなく **単相化** です。`List<Int>` と `List<String>` は別々に特殊化され、型引数は typed IR に残る前に具体化されます（実行時のキャストや raw type の問題はありません）。型引数の境界は `<T: Show>` の形です。

## ループ → 再帰・コンビネータ

拡張 for も Stream も、Emela では再帰か `list` コンビネータ + [pipeline](/reference/expressions/#pipeline-) で書きます。

```emela
import std.list

names |> list.map(fn (u: User) -> String { u.name })
```

## 気をつけること

- **可変フィールド・setter は無い**。record は不変で、更新は「新しい record を作る」形になります。
- **`static` メソッド／グローバル可変状態は無い**。状態は effect（`uses`）で扱います。
- **`==` は要 `Eq` 実装**。record は組み込みの等価を持たないので、比較したい型には `impl Eq` を与えます。
- **オーバーロードは無い**。同名関数の多重定義はできません（trait メソッドで多態を表す）。

→ 詳しくは [トレイト](/reference/traits/) と [エラー](/reference/errors/)
