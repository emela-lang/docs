---
title: 次に読むもの
description: ツアーの終わりと、この先のドキュメント
order: 3
---

ツアーはこれで終わりです。おつかれさまでした。

ここまでで、Emela の中心にある考えをひととおり見ました。失敗するかどうかは `fails` として、外の世界に触るかどうかは `uses` として、関数の型に表れます。外の世界にはエフェクトを通してしか触れないので、ハンドラを差し替えるだけで振る舞いを変えたり、試したりできます。

この先は次のページが役に立ちます。

- 自分のマシンで動かすなら [インストール](/start/installation/) と [最初のプロジェクト](/start/first-project/)
- 言語を詳しく知るなら [ガイド](/guide/basics/)。ツアーで触れなかった、資源を開いて閉じるハンドラ（[状態と資源](/guide/resources/)）、同じエフェクトを場所ごとに分けるラベル（[エフェクトのラベル](/guide/labels/)）、`@test` と `emela test`（[テスト](/guide/testing/)）もここにある
- 使える型と関数を探すなら [標準ライブラリ](/std/overview/)
- エディタの設定は [エディタ](/tools/editors/)

ツアーのどのページにも、目次から戻ってこられます。

> **試してみよう**
> 右のプログラムを書き換えて、ここまでで覚えたことを自由に試してください。

```emela check tour
import Std.Console.{Console}
import Std.Platform.{Platform}

fn main() {
  chapters = ["基本", "データ", "エラー", "エフェクト", "並行処理", "その先へ"]
  with Platform {
    console <- Console
    List.each(List.enumerate(chapters), |(i, title)| {
      console.print_line("#{i + 1}. #{title} ✓")
    })
    console.print_line("Tour complete!")
  }
}
```

```console
$ emela run main.emel
1. 基本 ✓
2. データ ✓
3. エラー ✓
4. エフェクト ✓
5. 並行処理 ✓
6. その先へ ✓
Tour complete!
```
