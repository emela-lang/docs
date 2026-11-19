---
title: モジュール
description: 1ファイルが1モジュール、import と pub
order: 1
---

Emela では1つのファイルが1つのモジュールです。モジュールの名前はファイルのパスから決まり、`src/email.emel` は `Email`、`src/http/client.emel` は `Http.Client` になります。ファイルの中でモジュールを宣言する構文はありません。

ほかのモジュールの名前は `import` で取り込みます。

- `import Http.Client` は、最後の名前 `Client` を取り込む。関数は `Client.get(...)` と呼ぶ
- `import Std.Map.{Map}` のように波括弧で並べた名前は、修飾なしで使える。右のプログラムでは、型の `Map` とモジュールの関数（`Map.get` など）の両方が使える

`List`、`String`、`Option` のような core のモジュールは import なしで使えます。標準ライブラリの `Std` の下のモジュール（`Std.Console`、`Std.Map` など）は import が要ります。

宣言は既定でそのモジュールの中だけから見えます。ほかのモジュールに見せるものには `pub` を付けます。このツアーのプログラムは1ファイルなので `pub` は出てきませんが、ファイルを分けたプロジェクトで使います。

> **試してみよう**
> `import Std.Map.{Map}` の行を消して、エラーを読んでみてください。

```emela check tour
import Std.Map.{Map}

fn count_words(text: String) -> Map[String, Int] {
  String.split(text, " ")
    |> List.fold(Map.empty(), |counts, word| {
      Map.update(counts, word, |n| Some(Option.or(n, 0) + 1))
    })
}

fn main() {
  counts = count_words("to be or not to be")
  dbg(Map.get(counts, "be"))
  dbg(Map.to_list(counts))
  ()
}
```

```console
$ emela run main.emel
Some(2)
[("be", 2), ("not", 1), ("or", 1), ("to", 2)]
```
