---
title: ようこそ
description: Emela ツアーの使い方と、最初のプログラム
order: 0
---

Emela ツアーへようこそ。Emela の機能を、1ページに1つずつ見ていきます。

どのページにも動くプログラムが付いています。右のエディタで ▶ Run を押すか Ctrl / ⌘ + Enter で実行し、書き換えて試してください。壊れたら「元に戻す」で最初のプログラムに戻せます。コンパイラはブラウザの中で動いていて、サーバーには何も送りません。

ページは左下の矢印か、PageUp / PageDown で移ります。左上の「目次」から好きなページに飛べます。

ツアーは6章あります。

1. 基本: 値、束縛、関数、パイプ、再帰
2. データ: type、enum、match、List、Option
3. エラー: fail、fails、escape
4. エフェクト: effect と handler、エフェクトの別名と uses、State、ハンドラの差し替え
5. 並行処理: 待つ操作、タスク、race と timeout、Task.Group
6. その先へ: モジュール、Trait、次に読むもの

## 最初のプログラム

Emela のプログラムは `main` 関数から始まります。右のプログラムは1行を出力して終わります。

出力するには、標準ライブラリの `Console` を使います。`import` でモジュールから名前を取り込み、`console <- Console` で `Console` に `console` という名前を付けてから、`console.print_line(...)` で1行を書きます。

`with Platform { ... }` は、本体の中で `Console` のようなホストの機能を使えるようにします。Emela では、関数が画面やファイルや時計に触るかどうかが型に表れます。`with` で外から渡さない限り、関数は外の世界に触れません。この仕組みは4章で詳しく見ます。今は「出力するときは `console <- Console` と書き、`with Platform` の中で `console.print_line`」と覚えてください。

文字列の中の `#{...}` には式を埋め込めます。

> **試してみよう**
> `name` を自分の名前に変えて実行してください。

```emela check tour
import Std.Console.{Console}
import Std.Platform.{Platform}

fn main() {
  console <- Console
  name = "Emela"
  with Platform {
    console.print_line("Hello, #{name}!")
  }
}
```

```console
$ emela run main.emel
Hello, Emela!
```
