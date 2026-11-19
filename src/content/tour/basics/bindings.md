---
title: 束縛
description: 値に名前を付ける、名前を付け直す、組を分解する
order: 3
---

`名前 = 式` で値に名前を付けます。これを束縛と呼びます。`let` や `var` のようなキーワードはありません。

値は変わりません。`count = count + 1` は `count` を書き換えるのではなく、`count + 1` という新しい値に同じ名前を付け直します。それより後では新しい値が見え、前の値を使っていた式には影響しません。

左辺にはパターンも書けます。`(x, y) = point` はタプルを分解して、2つの名前を一度に付けます。要らない部分は `_` で捨てます。

`const` はモジュールの一番外側で付ける定数です。名前はすべて大文字で書きます。

> **試してみよう**
> `(x, _) = point` に変えて、`y` を使うとどうなるか見てください。

```emela check tour
const GREETING = "Hello"

fn main() {
  count = 1
  count = count + 1
  dbg(count)

  point = (3, 4)
  (x, y) = point
  dbg(x * x + y * y)

  dbg("#{GREETING}, #{count} times")
  ()
}
```

```console
$ emela run main.emel
2
25
"Hello, 2 times"
```
