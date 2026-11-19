---
title: Trait と derive
description: 型に用意された関数を約束する Trait、impl、derive、型引数の制約
order: 2
---

Trait は「この型にはこの関数がある」という約束です。`trait Stability` は、`is_stable` という関数を持つことを約束させます。型ごとの中身は `impl 型: Trait { ... }` で書き、呼ぶときは `Stability.is_stable(v)` のように `Trait 名.関数名` と書きます。

言語の決まった場所が、決まった Trait を使います。

- `==` と `!=` は Eq
- `<` や `>` と `List.sort` は Ord
- 文字列の `#{...}` と `dbg` は Show

`derive Eq, Ord` は、Eq と Ord の実装をフィールドから自動で作ります。導出した Ord は、フィールドを前から順に比べます。だから `v1.2` は `v1.10` より小さくなります。Show は `impl` で手書きしているので、`dbg` も `#{...}` も `v1.2` の形で出します。

`fn newest[A: Ord]` の `[A: Ord]` は、型引数 `A` に Ord を求める制約です。`newest` は `Version` にも `Int` にも使えます。

> **試してみよう**
> `derive Eq, Ord` を `derive Eq` だけにして、どこでエラーになるか見てください。

```emela check tour
type Version(major: Int, minor: Int)
  derive Eq, Ord

impl Version: Show {
  fn show(self) { "v#{self.major}.#{self.minor}" }
}

trait Stability {
  fn is_stable(self) -> Bool
}

impl Version: Stability {
  fn is_stable(self) { self.major >= 1 }
}

fn newest[A: Ord](xs: List[A]) -> Option[A] {
  List.sort(xs) |> List.last
}

fn main() {
  versions = [
    Version(major: 1, minor: 2),
    Version(major: 0, minor: 9),
    Version(major: 1, minor: 10),
  ]
  dbg(Version(major: 1, minor: 2) < Version(major: 1, minor: 10))
  dbg("#{List.sort(versions)}")
  dbg(List.filter(versions, Stability.is_stable) |> List.length)
  dbg(newest(versions))
  dbg(newest([3, 1, 2]))
  ()
}
```

```console
$ emela run main.emel
True
"[v0.9, v1.2, v1.10]"
2
Some(v1.10)
Some(3)
```
