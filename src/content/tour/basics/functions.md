---
title: 関数
description: fn で関数を定義する、名前付きの引数、関数を値として渡す
order: 4
---

`fn 名前(引数: 型) -> 戻り値の型 { 本体 }` で関数を定義します。本体の最後の式が戻り値です。`return` はありません。

仮引数の名前は、そのまま引数の名前になります。`area(width: 3, height: 4)` のように名前付きで渡すと、呼び出しを読むだけで何を渡しているか分かります。名前を付けずに、並びの順で渡すこともできます。

関数も値です。`twice` は `fn(Int) -> Int` 型の関数 `f` を受け取って2回呼びます。定義した関数は、名前を書くだけで値として渡せます。

戻り値の型は省けます。省くと本体から推論されます。外から使う関数には書いておくと、型が読む人への説明になります。

> **試してみよう**
> `area("3", 4)` と書いて、コンパイラが何と言うか見てください。

```emela check tour
fn area(width: Int, height: Int) -> Int {
  width * height
}

fn add_one(n: Int) -> Int { n + 1 }

fn twice(f: fn(Int) -> Int, x: Int) -> Int {
  f(f(x))
}

fn main() {
  dbg(area(width: 3, height: 4))
  dbg(area(3, 4))
  dbg(twice(add_one, 10))
  ()
}
```

```console
$ emela run main.emel
12
12
12
```
