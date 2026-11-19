---
title: enum
description: 決まった種類のどれか1つになる型
order: 2
---

`enum` は、決まった種類のどれか1つになる型を定義します。種類ごとに構成子があり、それぞれ別のフィールドを持てます。

右の `Shape` は円か長方形か空のどれかです。`Circle` は半径を、`Rect` は幅と高さを持ち、`Empty` は何も持ちません。構成子は `type` と同じく `Circle(radius: 1.0)` のように呼びます。フィールドに名前を付けずに `Rect(Float, Float)` と書くこともできます。

`Shape` 型の値は、この3つ以外にはなりません。null のような「どれでもない値」もありません。だから `Shape` を受け取る関数は、この3つの場合だけを考えれば済みます。どう場合分けするかは次のページで見ます。

`Bool` も、`True` と `False` の2つの構成子を持つ enum です。

> **試してみよう**
> `Triangle(base: Float, height: Float)` を足して、リストに入れてみてください。

```emela check tour
enum Shape {
  Circle(radius: Float)
  Rect(Float, Float)
  Empty
}

fn main() {
  shapes = [Circle(radius: 1.0), Rect(2.0, 3.0), Empty]
  dbg(shapes)
  dbg(List.length(shapes))
  ()
}
```

```console
$ emela run main.emel
[Circle(radius: 1.0), Rect(2.0, 3.0), Empty]
3
```
