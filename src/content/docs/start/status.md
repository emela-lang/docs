---
title: 実装の状況
description: emela 0.28.1 で動くもの、ターゲットごとの違い、実験的な機能、仕様にあってまだ動かないもの、既知の不具合
---

このサイトは emela 0.28.1（2026-11-19 のリリース）に合わせて書いています。仕様は emela リポジトリの [`spec/`](https://github.com/emela-lang/emela/tree/main/spec) にあり、コンパイラはそのほとんどを実装しています。ここには、0.28.1 で使えるもの、ターゲットごとの違い、実験的な機能、まだ動かないものをまとめます。各版で入ったものは emela リポジトリの [CHANGELOG](https://github.com/emela-lang/emela/blob/main/CHANGELOG.md) にあります。

## 版ごとに入ったもの

| 版 | 入ったもの | ページ |
|---|---|---|
| 0.20 | 言語の土台。データ型、パターンマッチ、モジュール、型付きのエラーとエフェクト、`suspend fn`、状態を持つハンドラ、fiber、ファイル、`Http` のクライアント、`@test` | [データ型](/guide/types/)、[エラー](/guide/errors/)、[エフェクト](/guide/effects/) |
| 0.21 | WebAssembly と C のターゲット、`emela doc`、エフェクトのラベル | [ターゲット](/reference/targets/)、[エフェクトのラベル](/guide/labels/) |
| 0.22 | 依存（`emela pome`）、`@external` のファイルを出力にコピーする | [プロジェクトと Pome](/tools/pome/) |
| 0.23 | テストのルート `test/` と `[dev-dependencies]`、言語サーバーの機能の追加 | [テスト](/guide/testing/) |
| 0.24 | `trait`、`impl`、`derive`（`Eq`、`Ord`、`Show`）、`Std.Map`、`Std.Set`。テストの補助は Pome の [brix](https://github.com/emela-lang/brix) に移った | [Trait と導出](/guide/traits/)、[コレクション](/std/collections/) |
| 0.25 | HTTP サービス（`@entry(Http.serve)`）、`@export`、ハンドラの `init` の引数、WASM ですべての構文が動く、`emela test --reporter`、`emela new` | [Http](/std/http/)、[emela コマンド](/tools/cli/) |
| 0.26 | メソッド呼び出し `x.f(a)`、`Std.Bytes` | [メソッド呼び出し](/guide/functions/#メソッド呼び出し) |
| 0.27 | 無名関数 `\|x\| e`、`uses { R }`、`escape` の `_`、`Std.Array`、`Std.Exit` | [束縛と関数](/guide/functions/)、[エラー](/guide/errors/) |
| 0.28 | `--target native`、`Std.Process`（引数、標準入出力、`main` の終了コード）、局所関数、`each`、`Std.Json` と `derive Encode, Decode`、`Semaphore` と `Queue`、能力の型 `use E`、1つのハンドラで複数のエフェクトを実装する、handler member、Bun、`emela doctor`、Windows 向けのリリース、ブラウザで動くコンパイラ（[Playground](/playground/)） | [ターゲット](/reference/targets/)、[標準ライブラリ](/std/overview/)、[emela コマンド](/tools/cli/) |
| 0.28.1 | Playground とツアーのエディタの補完、ホバー、診断（ブラウザで動く言語サーバー）。同じ `with` の `L by P` の不具合などの修正 | [Playground](/playground/)、[エフェクトのラベル](/guide/labels/) |

## ターゲット

| ターゲット | Tier | 0.28.1 での状況 | 実行に要るもの |
|---|---|---|---|
| `js` | 1 | 既定。すべての構文と std が動く | Node.js 22 以降か Bun 1.4.3 以降 |
| `wasm` | 1 | すべての構文が動く。標準入力と `Http` のクライアントはまだない。利用者の `@external(wasm, ...)` と `@export(wasm, ...)` はまだ書けない | Wasmtime 49 以降 |
| `native` | 2 | 0.28 で `c` から改名した。書記素クラスタの関数、コールバックを取る外部関数、境界の `Bytes` と `Array`、HTTP サービス、`Http` のクライアントがまだない | C11 のコンパイラ、POSIX の C ヘッダとライブラリ |

- `--target c` と `[build].target = "c"` は `native` の古い名前として読み、警告 W0903 を出します。0.29 で取り除きます。
- native は macOS（arm64）と Linux（x86_64、glibc）だけで動きます。Windows の `emela` は JS と WASM のターゲットを使えます。
- 細かな違いは [ターゲット](/reference/targets/) にあります。

## 実験的な機能

仕様の中には、まだ安定していない「実験的な機能」があります。互換性の保証の外にあり、どの版でも変わったり取り除かれたりします。Pome ごとに `Pome.toml` の `[experimental]` で有効にするか、コマンドの1回の実行だけ `--experimental-<名前>` で有効にします。

```toml
[experimental]
capture-checking = true
```

```sh
emela check --experimental-capture-checking
```

| 名前 | 入った版 | 変えること |
|---|---|---|
| `capture-checking` | 0.28 | 能力を持つ値が、それを供給する `with` か `Fiber.scope` の外へ出ると、警告 W0402 の代わりにコンパイル時のエラー E0444 にする |

- 知らない名前、安定した機能、取り除いた機能の名前は警告 W2304 です。
- フラグは `check`、`build`、`run`、`test` が受け取ります。言語サーバーは `Pome.toml` だけを見るので、フラグだけで有効にした機能はエディタの診断に出ません。
- 0.29 では `capture-checking` を既定にし、W0402 と実行時の検査を外す予定です（[emela#666](https://github.com/emela-lang/emela/issues/666)）。

## 仕様にあって、まだ動かないもの

| 機能 | 0.28.1 での動き |
|---|---|
| 持ち出しの静的な検査（capture set） | 既定は警告 W0402 だけで、実際に使うと実行時の defect（`handler ... was used after release`、`fiber scope was used after it ended`）になる。`capture-checking` で E0444 にできる |
| 相互再帰の末尾呼び出しの警告 | 出ない（[emela#265](https://github.com/emela-lang/emela/issues/265)） |
| 能力の型の組み込み Trait `Capability` | 採択済みで、まだない（``cannot find trait `Capability` in this scope``） |
| `emela pome publish` | コマンドがない（`unrecognized subcommand 'publish'`）。公開は tag を push するだけでできる |
| `FileSystem` と `Http` でのバイナリ | `Std.Bytes` はあるが、`FileSystem` と `Http` は UTF-8 のテキストだけを扱う |
| derive できる Trait | `Eq`、`Ord`、`Show`、`Encode`、`Decode`、`ObjectKey`、`Shaped` だけ。Trait の作者が導出規則を書く構文は未決 |
| ブラウザで動く JS | ターゲットではない。JS の出力はサーバーのホストを前提にする |

仕様でまだ決まっていない点は [`spec/open-questions.md`](https://github.com/emela-lang/emela/blob/main/spec/open-questions.md) にあります。

## 既知の不具合

0.28.1 で分かっている、仕様と違う動きです。

| 不具合 | 回避のしかた |
|---|---|
| 仕様は WASM の `SystemClock.sleep` と `Std.FileSystem` をまだ使えないとしているが、0.28.1 では動く | 仕様の側を直す |

ほかの不具合は [GitHub の issue](https://github.com/emela-lang/emela/issues) にあります。

## 版の方針

0.y.z の範囲では、minor の版で言語に壊れる変更が入ることがあります。変更は CHANGELOG に記録しています。実験的な機能は、patch の版でも変わることがあります。
