---
title: 待つ操作
description: suspend fn の操作、Clock.sleep、待たないハンドラ
order: 1
---

時計のエフェクト `Clock` の `sleep(ms)` は、`ms` ミリ秒待ってから戻ります。右の `countdown` は 0.5 秒ごとに数を出します。

`Clock` の宣言では、`sleep` に `suspend` が付いています。

```emela
pub effect Clock {
  suspend fn sleep(ms: Int) -> ()
  fn now() -> Instant
}
```

`suspend fn` の操作は、呼び出し元を中断させることがあります。いつ続きを実行するかはハンドラが決めます。ハンドラは最後の引数に `resume` を受け取り、`resume(値)` を呼んだところで呼び出し元が続きを始めます。呼ぶ側の書き方は普通の呼び出しと同じで、印は付きません。

`NoWait` は、待たずにその場で `resume` する `Clock` のハンドラです。`with NoWait` の中では、同じ `countdown` がすぐに終わります。テストで時間を待ちたくないときは、こうしたハンドラに差し替えます。

> **試してみよう**
> `NoWait` の `resume(())` の前に `(use Clock).sleep(100)` を足して、本当に待つハンドラに変えてみてください。

```emela check tour
import Std.Clock.{Clock}
import Std.Console.{Console}
import Std.Platform.{Platform}

fn countdown(n: Int) {
  List.each(List.range(0, n), |i| {
    (use Clock).sleep(500)
    (use Console).print_line("#{n - i}")
  })
  (use Console).print_line("liftoff")
}

handler NoWait: Clock {
  suspend fn sleep(ms, resume) {
    (use Console).print_line("(skip #{ms}ms)")
    resume(())
  }
  fn now() { (use Clock).now() }
}

fn main() {
  with Platform {
    countdown(3)
    with NoWait {
      countdown(2)
    }
  }
}
```

```console
$ emela run main.emel
3
2
1
liftoff
(skip 500ms)
2
(skip 500ms)
1
liftoff
```
