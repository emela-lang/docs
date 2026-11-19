---
title: Console と Platform
description: 出力も時計もエフェクト、Platform はホストのハンドラの束
order: 3
---

1章から使ってきた `Console` も、標準ライブラリの普通のエフェクトです。宣言はこうなっています。

```emela
pub effect Console {
  fn print_line(text: String) -> ()
  fn print_error_line(text: String) -> ()
}
```

本当に画面に書くのはハンドラ `SystemConsole` です。時計の `Clock` には `SystemClock`、乱数の `Random` には `SystemRandom` があります。`Platform` は、こうしたホストのハンドラをまとめて名前を付けたものです。`with Platform` と書くと、全部をまとめて渡せます。

`Console` のハンドラも自分で書けます。右の `Loud` は、受け取った行を大文字にして、外側の `Console` に書きます。ハンドラの中の `use Console` は、`with Loud` の外側にあるハンドラ（ここでは `Platform` の `SystemConsole`）を指します。

`announce` は1文字も変えずに、`with` の中だけ出力が変わります。

> **試してみよう**
> `with Loud {` を `with Loud, Platform {` に変えてみてください。同じ `with` に同じエフェクトのハンドラを並べると、後ろのものが使われます。

```emela check tour
import Std.Console.{Console}
import Std.Platform.{Platform}

handler Loud: Console {
  fn print_line(text) {
    (use Console).print_line(String.to_ascii_uppercase(text))
  }
  fn print_error_line(text) {
    (use Console).print_error_line(text)
  }
}

fn announce(event: String) {
  (use Console).print_line("#{event} starts now")
}

fn main() {
  with Platform {
    announce("lunch")
    with Loud {
      announce("fire drill")
    }
  }
}
```

```console
$ emela run main.emel
lunch starts now
FIRE DRILL STARTS NOW
```
