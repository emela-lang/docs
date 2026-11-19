---
title: match
description: 値の形で場合分けし、中身を取り出す
order: 3
---

`式 match { パターン -> 式 ... }` は、値の形で場合分けします。上の腕から順に試し、最初に合った腕の式が結果になります。`match` は式の後ろに書くので、パイプの続きにもそのまま置けます。

パターンは値の形を書いたものです。`Circle(radius:)` は円に合い、半径を `radius` という名前で取り出します。`Rect(w, h)` は長方形に合い、幅と高さを `w` と `h` にします。数や文字列、タプルもパターンにでき、`_` は何にでも合います。

腕に `if 条件` を付けると、形が合ったうえで条件も満たすときだけ選ばれます。

腕は全部の場合を覆っていなければなりません。`Shape` に種類を足したのに `area` を直し忘れると、コンパイルが通りません。

> **試してみよう**
> `Empty -> 0.0` の腕を消して、エラーを読んでみてください。

```emela check tour
enum Shape {
  Circle(radius: Float)
  Rect(Float, Float)
  Empty
}

fn area(shape: Shape) -> Float {
  shape match {
    Circle(radius:) -> 3.14 * radius * radius
    Rect(w, h)      -> w * h
    Empty           -> 0.0
  }
}

fn fizzbuzz(n: Int) -> String {
  (n % 3, n % 5) match {
    (0, 0) -> "FizzBuzz"
    (0, _) -> "Fizz"
    (_, 0) -> "Buzz"
    _      -> "#{n}"
  }
}

fn main() {
  dbg(area(Rect(2.0, 3.0)))
  dbg(List.map([9, 10, 15, 7], fizzbuzz))
  ()
}
```

```console
$ emela run main.emel
6.0
["Fizz", "Buzz", "FizzBuzz", "7"]
```
