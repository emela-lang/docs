---
title: 実装の状況
description: 0.28.0 のコンパイラで動くもの、まだ動かないもの、ターゲットの Tier と native の制限
---

このサイトは 0.20 系から続く仕様を書いています。コンパイラの版は `.emela-version`（いま 0.28.0）に合わせています。今のコンパイラで何が動き、何がまだかをここにまとめます。各ページに古い「予定」の注記が残っていることがあります。食い違うときはこのページと emela の CHANGELOG を優先してください。

ここでの「0.28.0」は最新のリリースを、「main」は emela リポジトリの main ブランチ（次のリリースに入るもの）を指します。

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
| エフェクトのラベル（`effect L of E`、`with L by P`） | 0.21 | [エフェクトのラベル](/guide/labels/) |
| WebAssembly（`--target wasm`） | 0.21 | [ターゲット](/reference/targets/) |
| `emela doc`（`pub` な宣言の文書を HTML か Markdown に出す） | 0.21 | [emela コマンド](/tools/cli/) |
| Pome の依存（`[dependencies]`、`[replace]`、`Pome.lock`）、`emela pome` | 0.22 | [プロジェクトと Pome](/tools/pome/) |
| テストのルート `test/`、`[dev-dependencies]` | 0.23 | [テスト](/guide/testing/)、[プロジェクトと Pome](/tools/pome/) |
| `trait`、`impl`、`derive`（`Eq`、`Ord`、`Show`）、`Std.Map`、`Std.Set` | 0.24 | [Trait と導出](/guide/traits/)、[標準ライブラリ](/std/overview/) |
| Http サービス（`@entry(Http.serve)`）、`@export`、handler の `init` 引数、`emela new`、`emela test --reporter` | 0.25 | [Http](/std/http/)、[emela コマンド](/tools/cli/) |
| メソッド呼び出し `x.f(a)`、`Std.Bytes` | 0.26 | [束縛と関数](/guide/functions/)、[標準ライブラリ](/std/overview/) |
| 無名関数、`uses { R }`、`escape` の `_`、`Std.Array`、`Std.Exit` | 0.27 | [束縛と関数](/guide/functions/)、[エラー](/guide/errors/) |
| `--target native`、`Std.Process`、局所 `fn`、`each`、`Std.Json` と `derive Encode, Decode`、`Std.Semaphore`、`Std.Queue`、capability の型、Bun（`EMELA_JS_HOST`）、`emela doctor`、Windows 向けのコンパイラ配布 | 0.28 | [ターゲット](/reference/targets/)、[標準ライブラリ](/std/overview/)、[emela コマンド](/tools/cli/) |
| `emela check`、`build`、`run`、`test`、`fmt`、`lsp`、`pome`、`new`、`doc`、`doctor` | （各版） | [emela コマンド](/tools/cli/) |

## 仕様にあって、まだ動かないもの・制限

| 機能 | 予定・方針 | 今の動き |
|---|---|---|
| capture set（能力、fiber のハンドル、`Deferred` の持ち出しの静的な検査） | 0.29 で既定にする方針（open-questions） | 一部を実行時に検査し、defect にする（`handler ... was used after release`、`fiber scope was used after it ended` など）。持ち出しには警告も出る |
| `FileSystem` / `Http` でのバイナリ | 未定 | `Std.Bytes` はあるが、いまの FileSystem と Http は UTF-8 のテキストだけを扱う |
| ブラウザを JS の実行ホストにすること | 対象外 | JS ターゲットは Node.js 22 以降、または Bun 1.4.3 以降。`emela-playground` はブラウザで検査・整形・JS へのコンパイルができるが、platform のハンドラはブラウザ向けに規定していない |
| native ターゲットの Windows | 未定 | コンパイラの Windows 向けバイナリはある。`--target native` が動くのは macOS（arm64）と Linux（x86_64、glibc） |
| `SystemHttp`（Http クライアントのホスト実装） | — | JS だけ。native と WASM で `send` に届くコードをビルドすると E0412 |
| `SystemStdin` | — | WASM ではまだ動かない |
| ユーザーが書く `@external(wasm, ...)` | 未定（WIT / Component Model の方向） | まだない |

derive できるのはいま `Eq`、`Ord`、`Show`、`Encode`、`Decode`、`ObjectKey`、`Shaped` です。

## ターゲット

| ターゲット | Tier | 状況 | 実行に要るもの |
|---|---|---|---|
| JS | 1 | 既定。実装済みの機能がすべて動く | Node.js 22 以降、または Bun 1.4.3 以降（`EMELA_JS_HOST`） |
| WASM | 1 | WASI 0.3 の component を出す | Wasmtime 49 以降（`-S p3=y`、または `EMELA_WASMTIME`） |
| native | 2 | このマシン向けの実行ファイルを出す。`--target c` は同じものの非推奨名（0.29 で削除） | C11 のコンパイラ（`cc`、`EMELA_CC`）。`emela doctor` で確かめられる |

同じプログラムはどのターゲットでも同じ観測可能な結果を返すことを仕様で求めています。Tier 2 のターゲットも意味は Tier 1 と同じで、同じテストスイートを通すことを条件にします。新しい機能だけは Tier 1 より遅れて入ってかまいません。

native ターゲットは、出力した C と C のランタイムを `cc` でコンパイルして実行ファイル `target/emela/native/main` を作ります。対象は macOS（arm64）と Linux（x86_64）で、Windows は未定です。

### native ターゲットの今の制限

native でも、純粋な部分、エラーとエフェクト、`suspend fn`、fiber、`Console`、`Clock`、`Random`、`Env`、`FileSystem`、テストは動きます。次はまだです。

| 使えないもの | 出る診断 |
|---|---|
| `String.length`、`String.chars` など、書記素クラスタの表が要る関数 | `` `String.length` needs the Unicode grapheme cluster tables, which target `native` does not support yet `` |
| `String.split(s, "")` を ASCII でない文字列に使う | 実行時の defect |
| `Http` のクライアント（`SystemHttp`） | `has no @external for target` 系のエラー（E0412） |
| Http サービス（`@entry(Http.serve)`） | E0442 |
| コールバックを受け取る外部関数 | コンパイル時のエラー（E0427） |

`with Platform` と書いても、`Http` を実際に使わなければ native でビルドできます。たどれない関数の `@external` は検査しないためです。

## 版の方針

0.y.z の範囲では、minor の版で言語に壊れる変更が入ることがあります。変更は emela リポジトリの CHANGELOG に記録しています。
