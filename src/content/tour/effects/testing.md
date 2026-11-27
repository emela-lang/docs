---
title: ハンドラを差し替えて試す
description: 同じ関数を、本物のハンドラとテスト用のハンドラで動かす
order: 5
---

関数が外の世界に触るのはエフェクトを通してだけなので、ハンドラを差し替えれば、関数を書き換えずに振る舞いを確かめられます。

標準ライブラリには、テスト用の `TestConsole` があります。`TestConsole` は画面に書かずに、行を `State[List[String]]` の状態に足していきます。`State.run([], ...)` の中で使えば、書かれた行がリストで返ってきます。

右のプログラムは、同じ `report` を2回呼びます。1回目は `SystemConsole` で画面に書き、2回目は `TestConsole` で行を集めます。集めた行は普通のリストなので、`==` で期待する値と比べられます。

テストは `@test` を付けた関数に `assert` で書き、`emela test` で実行します。中身はここでの2回目と同じです。`emela test` はブラウザでは動かないので、このページでは `main` の中で比べています。

これで4章は終わりです。次の章では、時間のかかる操作を待つことと、いくつもの待ちを同時に進める並行処理を見ます。

> **試してみよう**
> `scores` に `30` を足して、最後の `==` の結果がどう変わるか見てください。

```emela check tour
import Std.Console.{Console, SystemConsole, TestConsole}
import Std.State.{State}

fn report(scores: List[Int]) {
  console <- Console
  List.each(scores, |s| {
    result = if s >= 60 { "pass" } else { "fail" }
    console.print_line("#{s}: #{result}")
  })
}

fn main() {
  scores = [72, 45]
  with SystemConsole {
    report(scores)
  }
  (_, lines) = State.run([], || {
    with TestConsole {
      report(scores)
    }
  })
  dbg(lines)
  dbg(lines == ["72: pass", "45: fail"])
  ()
}
```

```console
$ emela run main.emel
72: pass
45: fail
["72: pass", "45: fail"]
True
```
