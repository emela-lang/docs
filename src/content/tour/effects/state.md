---
title: State
description: 書き換える状態もエフェクトで持つ
order: 4
---

値は変わらないので、呼ぶたびに変わる状態は標準ライブラリのエフェクト `State[S]` に置きます。`S` は状態の型です。操作は3つあります。

- `get()` は今の状態を返す
- `set(value)` は状態を `value` にする
- `update(f)` は状態に関数 `f` を適用する

`next_id` は呼ぶたびに状態の番号を返し、1つ進めます。`uses { State[Int] }` と書いたとおり、状態に触ることが型に出ています。

状態の置き場所は `State.run(初期値, || 本体)` が作ります。本体を実行して、本体の値と最後の状態の組を返します。`State.run` の外からは状態が見えないので、`main` は `State` を使う関数になりません。2回目の `State.run` は 100 から数え直しています。

> **試してみよう**
> `State.run(1, ...)` の `1` を変えてみてください。`next_id` の `st.set(id + 1)` を消すとどうなるかも見てください。

```emela check tour
import Std.State.{State}

fn next_id() -> Int uses { State[Int] } {
  st <- State[Int]
  id = st.get()
  st.set(id + 1)
  id
}

fn label_all(names: List[String]) -> List[String] {
  List.map(names, |name| "#{next_id()}: #{name}")
}

fn main() {
  names = ["alice", "bob", "carol"]
  (labels, next) = State.run(1, || label_all(names))
  dbg(labels)
  dbg(next)
  dbg(State.run(100, || label_all(["dave"])))
  ()
}
```

```console
$ emela run main.emel
["1: alice", "2: bob", "3: carol"]
4
(["100: dave"], 101)
```
