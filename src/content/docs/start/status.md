---
title: 実装の状況
description: 0.20.x のコンパイラで動くもの、仕様にあってまだ動かないもの、ターゲットの Tier と C の制限
---

このサイトは 0.20 系の仕様、つまり目標の言語を書いています。コンパイラはまだ仕様の全部を扱えません。今のコンパイラで何が動き、何がまだかをここにまとめます。各ページでも、未実装の機能には「予定」の注記を付けています。

ここでの「main」は emela リポジトリの main ブランチ（次のリリースに入るもの）を、「0.20.1」は最新のリリースを指します。

## 動くもの

| 機能 | 入った版 | 詳しくは |
|---|---|---|
| 関数、type、enum、`opaque`、パターンマッチ、末尾呼び出し、パイプ、`List` / `Option`、モジュール、`@test`、`dbg` | 0.20.0 | [束縛と関数](/guide/functions/)、[データ型](/guide/data/) |
| 後置の `match`、最初の参照で1回だけ評価する `const` | 0.20.0 | [パターンマッチ](/guide/pattern-matching/) |
| `error`、`fail`、`escape`、fails 節 | 0.20.0 | [エラー](/guide/errors/) |
| `effect`、`handler`、`use`、`with`、`@external` | 0.20.0 | [エフェクトとハンドラ](/guide/effects/)、[外部関数](/guide/external/) |
| `suspend fn`、`Async`、`Immediate` | 0.20.0 | [中断する操作](/guide/suspend/) |
| フィールドを持つハンドラ、`init` と `release`、`layer`、`State` | 0.20.0 | [状態と資源](/guide/resources/) |
| fiber（`Std.Fiber`、`Std.Cause`、`Std.Deferred`） | 0.20.0 | [並行処理](/guide/concurrency/) |
| `Console`、`Clock`、`Random`、`Env`、`FileSystem`、`Http` のクライアント、`Path`、`Instant` / `Duration`、`Platform` | 0.20.0 | [標準ライブラリ](/std/overview/) |
| パターンの負の数のリテラル（`-1`） | 0.20.1 | [パターンマッチ](/guide/pattern-matching/) |
| エフェクトのラベル（`effect L of E`、`with L by P`） | main | [エフェクトのラベル](/guide/labels/) |
| C ターゲット（`--target c`、`[build].target`） | main | [ターゲット](/reference/targets/) |
| `emela doc`（`pub` な宣言の文書を HTML か Markdown に出す） | main | [emela コマンド](/tools/cli/) |
| `emela check`、`build`、`run`、`test`、`fmt`、`lsp` | 0.20.0 | [emela コマンド](/tools/cli/) |

## 仕様にあって、まだ動かないもの

| 機能 | 予定 | 今の動き |
|---|---|---|
| `trait`、`impl`、`derive`、Trait の制約の検査 | 0.21 | `trait` の宣言は通るが、Trait の関数を呼ぶと `not supported yet` になる。`==` と文字列の補間は Trait を見ず、どの型にも構造のまま働く |
| `Map`、`Set`、`Array` | 0.21 | 名前が見つからないエラーになる |
| JSON（Encode / Decode） | 0.21 | なし。Trait と一緒に入る |
| `Semaphore`、`Queue`（同時に走る fiber の数の上限） | 0.21 | なし |
| `Http` のサーバー | 0.21 | クライアントの `send` だけ |
| WebAssembly の出力（`--target wasm`） | 0.21 以降 | `--target` に渡せるのは `js` と `c` だけ。`[build].target = "wasm"` はエラー |
| Pome の依存（`[dependencies]`、`[replace]`、`Pome.lock`） | 未定 | `Pome.toml` は有無と `[build].target` だけを読む。ほかの表は黙って無視する |
| `emela pome add` / `install` / `update` / `remove` / `list`、`emela new` | 未定 | コマンドがない |
| capture set（能力、fiber のハンドル、`Deferred` の持ち出しの静的な検査） | 0.22 | 一部を実行時に検査し、defect にする（`handler ... was used after release`、`fiber scope was used after it ended`） |
| `Bytes`（バイナリのデータ） | 未定 | `FileSystem` と `Http` は UTF-8 のテキストだけを扱う |
| ブラウザで動く JS | 未定 | JS ターゲットは Node.js 18 以降、Deno、Bun を前提にする |

0.20 で実行時の defect になる持ち出しは、0.22 でコンパイル時のエラーになります。0.20 でエラーになるプログラムは 0.22 でもエラーのままです。

## ターゲット

| ターゲット | Tier | 状況 | 実行に要るもの |
|---|---|---|---|
| JS | 1 | 既定。実装済みの機能がすべて動く | Node.js 18 以降 |
| WASM | 1 | 出力はまだない | |
| C | 2 | main にある。次のリリースで入る | C11 のコンパイラ（`cc`、`EMELA_CC`） |

同じプログラムはどのターゲットでも同じ観測可能な結果を返すことを仕様で求めています。Tier 2 のターゲットも意味は Tier 1 と同じで、同じテストスイートを通すことを条件にします。新しい機能だけは Tier 1 より遅れて入ってかまいません。

C ターゲットは、出力した C と C のランタイムを `cc` でコンパイルして native の実行ファイル `target/emela/c/main` を作ります。対象は macOS（arm64）と Linux（x86_64）で、Windows は後の版です。

### C ターゲットの今の制限

C ターゲットでも、純粋な部分、エラーとエフェクト、`suspend fn`、fiber、`Console`、`Clock`、`Random`、`Env`、`FileSystem`、テストは動きます。次はまだです。

| 使えないもの | 出る診断 |
|---|---|
| `String.length`、`String.chars` など、書記素クラスタの表が要る関数 | `` `String.length` needs the Unicode grapheme cluster tables, which target `c` does not support yet `` |
| `String.split(s, "")` を ASCII でない文字列に使う | 実行時の defect |
| `Http`（`SystemHttp` に C の実装がない） | `has no @external for target c` のエラー |
| コールバックを受け取る外部関数 | コンパイル時のエラー |

`with Platform` と書いても、`Http` を実際に使わなければ C ターゲットでビルドできます。たどれない関数の `@external` は検査しないためです。

## 版の方針

0.y.z の範囲では、minor の版で言語に壊れる変更が入ることがあります。変更は emela リポジトリの CHANGELOG に記録しています。
