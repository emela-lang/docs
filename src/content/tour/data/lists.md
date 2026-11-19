---
title: List
description: リストを作る、関数で変換する、パターンで分解する
order: 4
---

`List[A]` は、同じ型 `A` の値を並べたものです。`[1, 2, 3]` と書いて作り、ほかの値と同じく変わりません。要素を足したり並べ替えたりすると、新しいリストができます。

操作は `List` モジュールの関数で書きます。`List.map`、`List.filter`、`List.fold` のほかに、`List.sort` で並べ替え、`List.take` で先頭から取り出し、`List.any` で条件を満たす要素があるか調べます。

リストは `match` でも分解できます。`[]` は空のリスト、`[x]` は要素が1つのリストに合います。`[first, ..rest]` は先頭を `first`、残りのリストを `rest` に取り出します。`describe` は長さによって説明を変えています。

> **試してみよう**
> `List.sort(scores)` の後に `|> List.reverse` をつないで、上位3つを取り出してください。

```emela check tour
fn describe(xs: List[Int]) -> String {
  xs match {
    []              -> "empty"
    [x]             -> "only #{x}"
    [first, ..rest] -> "#{first} and #{List.length(rest)} more"
  }
}

fn main() {
  scores = [72, 95, 88, 61, 99]
  dbg(List.sort(scores))
  dbg(List.take(scores, 2))
  dbg(List.any(scores, |s| s > 90))
  dbg(describe([]))
  dbg(describe(scores))
  ()
}
```

```console
$ emela run main.emel
[61, 72, 88, 95, 99]
[72, 95]
True
"empty"
"72 and 4 more"
```
