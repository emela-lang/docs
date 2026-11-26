---
title: エフェクトのラベル
description: effect L of E で同じエフェクトを場所ごとに別のハンドラで供給する
---

同じエフェクトを、場所ごとに別のハンドラで供給したいときはラベルを使います。ラベルは、あるエフェクトと同じ操作を持つ別の名前のエフェクトです。監査ログと通常の出力をどちらも Console で書きつつ、行き先を分ける、といった場面に使います。

```emela check
import Std.Console.{Console, SystemConsole, TestConsole}
import Std.State.{State}

effect AuditLog of Console

handler StderrConsole: Console {
  fn print_line(text) {
    console <- Console
    console.print_error_line(text)
  }
  fn print_error_line(text) {
    console <- Console
    console.print_error_line(text)
  }
}

fn transfer(from: String, to: String, amount: Int) {
  console <- Console
  audit <- AuditLog
  console.print_line("sent #{amount} from #{from} to #{to}")
  audit.print_line("transfer #{from} -> #{to}: #{amount}")
}

fn main() {
  with SystemConsole, AuditLog by StderrConsole {
    transfer("alice", "bob", 100)
  }
}

@test
fn transfers_are_audited() {
  (_, audit) = State.run([], || {
    with SystemConsole, AuditLog by TestConsole {
      transfer("alice", "bob", 100)
    }
  })
  assert audit == ["transfer alice -> bob: 100"]
}
```

```console
$ emela run main.emel 2>/dev/null
sent 100 from alice to bob
$ emela run main.emel 2>&1 >/dev/null
transfer alice -> bob: 100
$ emela test main.emel
running 1 test
sent 100 from alice to bob
test transfers_are_audited ... ok

test result: ok. 1 passed; 0 failed; 0 filtered out
```

`transfer` の R は `{ Console, AuditLog }` です。Console と AuditLog は別のエフェクトなので、`main` では標準出力と標準エラーに、テストでは監査の行だけを State に集められます。

## ラベルを宣言する

```emela
effect AuditLog of Console           # 供給が要る
effect DebugLog of Console default   # Console を供給する with が一緒に供給する
```

`effect L of E` は、E と同じ操作を持つエフェクト L を宣言します。L を E のラベル、E を L の元のエフェクトと呼びます。`audit <- AuditLog` と別名を付けて `audit.print_line(...)` のように E の操作をそのまま呼べますが、R に載るのは AuditLog で、Console とは別のエフェクトとして数えます。

元のエフェクトには、操作か[ハンドラのメンバー](/guide/resources/#ハンドラのメンバー)を持つ利用者のエフェクトを書きます。ラベルのラベルや、Async のような組み込みのエフェクトのラベルは作れません。ラベルを実装するハンドラも書けないので、元のエフェクトのハンドラを書いて、次の `by` で差し込みます。

ラベルは元のエフェクトのハンドラのメンバーも持ちます。`effect AuditFiles of Files` なら、with に `x = AuditFiles.Open(path)` と書いて、AuditFiles を担うハンドラの Open を開けます。

## with でラベルを供給する

with にはハンドラと layer に加えてラベルの項目を書けます。書き方は2つあります。`L by P` は、ラベル L の担い手として P を差し込みます。P には E のハンドラ、E そのもの、E の別のラベルを書けます。複数のエフェクトを実装するハンドラ（`handler H: A + B`）を書いたときは、そのうち E の実装が使われます。`L` だけを書くと、本体の中の E を L の担い手に任せます。ラベルの項目は、ハンドラを作らないので名前を付けられません（`x = L` や `x = L by E` は E4105）。本体でラベルを使うときは、名前を付けずに供給し、本体で `audit <- AuditLog` と別名を付けます。

```emela check
import Std.Console.{Console, SystemConsole}

effect AuditLog of Console
effect DebugLog of Console default

handler PrefixConsole: Console {
  fn print_line(text) {
    console <- Console
    console.print_line("[audit] #{text}")
  }
  fn print_error_line(text) {
    console <- Console
    console.print_error_line("[audit] #{text}")
  }
}

fn audit() {
  console <- Console
  console.print_line("user 1 logged in")
}

fn debug() {
  console <- Console
  console.print_line("cache miss")
}

fn report() -> () uses { AuditLog, DebugLog } {
  with AuditLog { audit() } # audit の中の Console を AuditLog が担う
  with DebugLog { debug() }
}

fn main() {
  with SystemConsole, AuditLog by PrefixConsole { report() } # DebugLog は SystemConsole が担う
}
```

```console
$ emela run main.emel
[audit] user 1 logged in
cache miss
```

`audit` はラベルを知らないまま、普通に `console <- Console` と書いています。`report` の `with AuditLog { audit() }` がその Console を AuditLog の担い手に回し、`main` が AuditLog の担い手として PrefixConsole を差し込んでいます。PrefixConsole の依存の Console は、ハンドラと同じく同じ with の SystemConsole が満たします。

### 元のエフェクトに戻す

`L by E` と元のエフェクトを書くと、L の区別を外して外の E に戻せます。

```emela check
import Std.Console.{Console, SystemConsole}

effect AuditLog of Console

fn transfer() {
  audit <- AuditLog
  audit.print_line("audited")
}

fn main() {
  with SystemConsole, AuditLog by Console { # 監査ログも標準出力へ
    transfer()
  }
}
```

`by` の右の Console は、同じ with の SystemConsole が満たします。

## default

`default` を付けたラベルは、E を供給する with が一緒に供給します。

```emela check
import Std.Console.{Console, SystemConsole}

effect DebugLog of Console default

handler Tagged: Console {
  fn print_line(text) {
    console <- Console
    console.print_line("[debug] #{text}")
  }
  fn print_error_line(text) {
    console <- Console
    console.print_error_line(text)
  }
}

fn work() -> () uses { DebugLog, Console } {
  debug_log <- DebugLog
  console <- Console
  debug_log.print_line("step")
  console.print_line("result")
}

fn main() {
  with SystemConsole { work() } # DebugLog も SystemConsole が担う
  with DebugLog by Tagged, SystemConsole { work() } # 明示の by が優先
}
```

```console
$ emela run main.emel
step
result
[debug] step
result
```

1回目の with では、DebugLog も SystemConsole が担います。L は最も内側で E を供給する with の担い手に落ちます。同じ with に `L by P` を書けばそちらが優先され、並び順にはよりません。2回目は `DebugLog by Tagged` を前に書いていますが、Tagged が担います。

ラベルの供給と依存の細かい規則は [型と効果の体系](/reference/type-system/#ラベル) にあります。

`default` のないラベルは、供給を忘れると `main` とテストでエラーになります。監査ログが黙って標準出力に混ざることはありません。混ぜたいときは、呼ぶ側が `L by E` と明示します。

```emela check=error
import Std.Console.{Console, SystemConsole}

effect AuditLog of Console

fn main() {
  audit <- AuditLog
  with SystemConsole {
    audit.print_line("x")
  }
}
```

```text
effect `AuditLog` is not provided in `main`
```

## シグネチャにはラベルを書く

関数の uses 節にはラベルをそのまま書きます（`uses { AuditLog, DebugLog }`）。元のエフェクトに落ちるかどうかは呼ぶ側が決めるので、元のエフェクトは書きません。LSP もラベルのまま表示し、ラベルの名前の上では宣言（`effect DebugLog of Console default`）を出します。

## 型引数のあるエフェクトのラベル

型引数のあるエフェクトのラベルには、元のエフェクトの具体的な型引数を書きます（`effect Hits of State[Int]`）。ラベル自身は型引数を持ちません。`by` の右にも型引数を書きます（`Hits by State[Int]`）。

同じ型の状態を2つ持つのに使えます。

```emela check
import Std.State.{State}

effect Hits of State[Int]
effect Misses of State[Int]

fn look(key: String) {
  hits <- Hits
  misses <- Misses
  if key == "a" {
    hits.update(|n| n + 1)
  } else {
    misses.update(|n| n + 1)
  }
}

fn main() {
  ((_, misses), hits) = State.run(0, || {
    with Hits by State[Int] {
      State.run(0, || {
        with Misses by State[Int] {
          List.map(["a", "b", "a"], look)
        }
      })
    }
  })
  dbg(hits) # 2
  _ = dbg(misses) # 1
}
```

`Hits by State[Int]` の右の `State[Int]` は、外側の `State.run` が満たします。`Misses by State[Int]` は内側の `State.run` が満たします。型で包む方法（`State[Hits]`、[状態と資源](/guide/resources/)）と比べ、状態の型は Int のままで済みます。
