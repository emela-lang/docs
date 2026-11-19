---
title: コレクション
description: List、Array、Map、Set、Bytes の使い分けと、比較と表示、計算量
---

標準ライブラリのコレクションはどれも不変で、変える関数は新しい値を返します。List は core にあり、ほかは std の値の層（`Std.Array`、`Std.Map`、`Std.Set`、`Std.Bytes`）にあります。

```emela check
import Std.Map
import Std.Map.{Map}
import Std.Set

fn count_words(text: String) -> Map[String, Int] {
  String.split(text, " ")
    |> List.filter(|w| w != "")
    |> List.fold(from: Map.empty(), f: |counts, w| {
      Map.update(counts, w, |n| Some(Option.or(n, 0) + 1))
    })
}

fn main() {
  counts = count_words("to be or not to be")
  dbg(counts) # Map.from_list([("be", 2), ("not", 1), ("or", 1), ("to", 2)])
  dbg(Map.get(counts, "to")) # Some(2)
  dbg(counts.keys() |> Set.from_list |> Set.contains("or")) # True
  _ = dbg(Map.filter(counts, |_, n| n > 1) |> Map.keys) # ["be", "to"]
}
```

関数の一覧は API リファレンスの [List](/std/api/list/)、[Std.Array](/std/api/std-array/)、[Std.Map](/std/api/std-map/)、[Std.Set](/std/api/std-set/)、[Std.Bytes](/std/api/std-bytes/) にあります。

## どれを使うか

| 型 | 向いている使い方 | 主な操作と計算量 |
|---|---|---|
| `List[A]` | 先頭から読む。少しずつ組み立てる。パターンで分ける | 先頭の追加と取り出しは O(1)、位置で読むのは O(n) |
| `Array[A]` | 組み立てた後に、位置で読む | `get` は O(1)、`set` は O(n) |
| `Map[K, V]` | キーで値を引く | `get`、`insert`、`remove`、`update` は O(log n) |
| `Set[A]` | 重なりのない値の集まり。含むかを調べる | `contains`、`insert`、`remove` は O(log n) |
| `Bytes` | バイト列。Base64 や16進、UTF-8 との変換 | 位置で読む（`get`）、切り出す（`slice`） |

Map と Set のキーには `Ord` が要ります。中身は純粋な Emela で書いた平衡木で、木の深さは O(log n) に保たれるので、大きな Map でもスタックを深く使いません。

## 比較と表示

Map と Set は中身で比べます。作った順や木の形が違っても、キーと値の並びが同じなら `==` です。Ord は持ちません。

表示（Show）は値を作り直せるソースの形で、要素はキーの昇順に並びます。`to_list`、`keys`、`values`、`fold` もキーの昇順です。

```emela check
import Std.Map
import Std.Set

fn main() {
  a = Map.from_list([(2, "b"), (1, "a")])
  b = Map.empty() |> Map.insert(1, "a") |> Map.insert(2, "b")
  dbg(a == b) # True
  dbg(Set.from_list(["b", "a", "b"])) # Set.from_list(["a", "b"])
  c = Map.union(a, Map.from_list([(1, "x"), (3, "c")]))
  _ = dbg(Map.to_list(c)) # [(1, "a"), (2, "b"), (3, "c")]
}
```

- `Map.from_list` は同じキーが並ぶと後の値を残します。
- `Map.union(a, b)` は両方にあるキーで `a` の値を残します。
- `Map.update(m, key, f)` は今の値（なければ `None`）を `f` に渡し、`Some` なら置き換えるか足し、`None` ならキーを除きます。

## Array

Array は長さの決まった並びで、位置で読むのが O(1) です。List から `Array.from_list` で作り、位置で読みます。並べた Array は `Array.binary_search` と `Array.lower_bound` で O(log n) で探せます。

```emela check
import Std.Array

fn main() {
  a = Array.from_list([30, 10, 20]) |> Array.sort
  dbg(a) # Array.from_list([10, 20, 30])
  dbg(Array.get(a, 1)) # Some(20)
  dbg(Array.get(a, 3)) # None
  dbg(Array.binary_search(a, 30)) # Some(2)
  dbg(Array.lower_bound(a, 25)) # 2
  _ = dbg(Array.set(a, 0, 5) |> Array.to_list) # [5, 20, 30]
}
```

`Array.set` は1つを置き換えた新しい Array を返すので O(n) です。WASM とネイティブでは、ほかから参照されていない Array をその場で書き換えます。範囲の外を `set` すると defect です。

## Bytes

Bytes は 0 から 255 の値の並びで、不変です。HTTP やファイルの中身を受け渡すための型で、UTF-8、16進、Base64 との変換を持ちます。

```emela check
import Std.Bytes

fn main() {
  b = Bytes.encode_utf8("é!")
  dbg(Bytes.to_list(b)) # [195, 169, 33]
  dbg(Bytes.to_hex(b)) # "c3a921"
  dbg(Bytes.to_base64(b)) # "w6kh"
  dbg(Bytes.decode_utf8(Bytes.hex("ff"))) # None
  _ = dbg(Bytes.from_list([1, 256])) # None
}
```

外から来た文字列を読む `Bytes.from_hex` と `Bytes.from_base64` は `Option` を返します。`Bytes.hex` はソースに書いた定数のためのもので、読めない文字列なら defect です。

## JSON との関係

`List`、`Array`、`Set`、`Option` と、キーが `ObjectKey` の `Map` は Encode と Decode を持つので、そのまま JSON に書いて読めます。Map は JSON のオブジェクトに、Array と Set は配列になります。詳しくは [JSON と Dynamic](/std/json/) にあります。
