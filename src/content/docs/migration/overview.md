---
title: 移行の全体像
description: 他の言語から Emela へ来る人が最初につかむべき考え方の転換
---

すでに他の言語を知っている人向けに、Emela へ来たとき最初に組み替えるべき **考え方** をまとめます。
言語ごとの詳しい対応は各ページ（[Python](/migration/python/) / [TypeScript](/migration/typescript/) / [C・C++](/migration/c-cpp/) / [Go](/migration/go/) / [Java](/migration/java/) / [Ruby](/migration/ruby/) / [Gleam](/migration/gleam/) / [Rust](/migration/rust/)）を見てください。

## 共通する4つの転換

### 1. 可変・ループ → 不変・再帰

束縛（`let`）はすべて不変で、再代入はできません。`for` / `while` などのループ構文もありません。
繰り返しは **再帰** で書き、自己末尾呼び出しはスタックを消費しないことが保証されます。
コレクション処理は `list.map` / `list.filter` / `list.fold` などのコンビネータと [pipeline `|>`](/reference/expressions/#pipeline-) を使います。

```emela
fn sum(xs: List<Int>) -> Int {
    list.fold(xs, 0, fn (acc: Int, x: Int) -> Int { acc + x })
}
```

### 2. null・例外 → Option・throws・panic

失敗を3つに分けて表します。

| 目的 | Emela | 多くの言語での近いもの |
|---|---|---|
| 値の不在（「無い」を返す） | `Option<T>` | `null` / `nil` / `None` / `Optional` |
| 回復可能な失敗 | `throws E` + `?` / `try`–`catch` | 例外 / `Result` |
| 回復不能な異常 | `panic` | abort / 未捕捉例外 |

null は言語に存在しません。例外の暗黙伝播もなく、失敗しうる関数は型（`throws E`）にそれが現れます。

### 3. クラス・継承 → record・enum・trait

クラスも継承もありません。データは **record（積型）** と **enum（直和型）** で表し、
振る舞いは **trait** とその `impl` で与えます。メソッド呼び出し `x.f(y)` は関数呼び出し `f(x, y)` の糖衣（レシーバ構文）です。

```emela
record User { id: Int  name: String }

impl Show for User {
    fn to_string(u: User) -> String { "User(" ++ u.name ++ ")" }
}
```

### 4. 副作用が型に出る（`uses`）

これは多くの言語に無い概念です。関数が使う **capability（能力＝副作用）** を関数型の `uses` 節に書きます。
標準出力に書く関数は `uses { Io }` を持ち、`uses {}`（純粋）な関数からは呼べません。
しかもこの集合はそのまま WebAssembly サンドボックスの **権限表** になります（→ [エフェクト](/reference/effects/)）。

```emela
import std.io

fn greet(name: String) -> Unit uses { Io } {
    Io.print("hello, " ++ name ++ "\n")
}
```

Java の検査例外がシグネチャに現れるのに近い感覚ですが、対象は例外ではなく **副作用** で、
静的な型検査と実行時サンドボックスの二重で強制されます。

## 用語のざっくり対応

| 一般的な概念 | Emela での対応 |
|---|---|
| 可変変数 | 無し（`let` は不変・再帰で書く） |
| `for` / `while` | 無し（再帰 + `list` コンビネータ） |
| `null` / `nil` | `Option<T>`（`Some` / `None`） |
| 例外 throw / try-catch | `throw` / `?` / `try`–`catch`（型に `throws E`） |
| クラス | `record`（データ）＋ `trait`/`impl`（振る舞い） |
| 継承 | 無し（合成と trait 境界） |
| インターフェース / プロトコル | `trait` |
| ジェネリクス | ジェネリクス（単相化。型パラメータは不透明） |
| メソッド `obj.m()` | レシーバ構文 `obj.m()` ≡ `m(obj)` |
| 演算子オーバーロード | 演算子は trait の糖衣（`+` = `Add` など） |
| パッケージマネージャ | Pome（`Pome.toml` / `emela pome add`） |
| GC / 手動メモリ管理 | ランタイム管理の非循環ヒープ（所有権・借用は無い） |

## 型まわりで最初に驚くところ

- `Int` は **i32 に固定** で、`+ - *` は 2³² で **wrap**（overflow で trap しない）。`0` 除算は panic。
- `Float` は **f64 固定**。
- `String` は **immutable**、長さ・添字は **Unicode scalar 単位**（byte ではない）。
- `Array<T>` は **固定長・不変**。可変長リストは stdlib の `List<T>`（`import std.list`）。
- `==` を使うにはその型に `Eq` の実装が要る（record は組み込みの構造的等価を持たない）。

## 次のステップ

- 使っていた言語のページへ：[Python](/migration/python/) / [TypeScript](/migration/typescript/) / [C・C++](/migration/c-cpp/) / [Go](/migration/go/) / [Java](/migration/java/) / [Ruby](/migration/ruby/) / [Gleam](/migration/gleam/) / [Rust](/migration/rust/)
- [言語ツアー](/guides/tour/) で機能を一巡り
- [リファレンス](/reference/values/) で正確な規則
