---
title: if と再帰
description: 値を返す if と、ループの代わりの再帰
order: 6
---

`if 条件 { 式 } else { 式 }` は値を返す式です。どちらの枝も同じ型の値になるので、結果をそのまま束縛したり返したりできます。値として使う `if` には `else` が要ります。

関数は自分自身を呼べます。これを再帰と呼びます。`factorial` は `n` が 0 になるまで自分を呼び、掛け算を積み上げます。

`sum_to` のように、自分を呼ぶのが最後の処理になっている再帰（末尾呼び出し）は、ループと同じように動きます。何万回呼んでもスタックを使い切りません。途中の結果は `acc` のような引数で次の呼び出しに渡します。

> **試してみよう**
> `sum_to(100, 0)` を `sum_to(50000, 0)` にしてみてください。`factorial` は末尾呼び出しではない（掛け算が後に残る）ので、大きな `n` ではスタックが足りなくなります。

```emela check tour
fn factorial(n: Int) -> Int {
  if n == 0 { 1 } else { n * factorial(n - 1) }
}

fn sum_to(n: Int, acc: Int) -> Int {
  if n == 0 { acc } else { sum_to(n - 1, acc + n) }
}

fn main() {
  dbg(factorial(5))
  sign = if -3 < 0 { "negative" } else { "positive" }
  dbg(sign)
  dbg(sum_to(100, 0))
  ()
}
```

```console
$ emela run main.emel
120
"negative"
5050
```
