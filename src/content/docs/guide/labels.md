---
title: エフェクトのラベル
description: effect L of E で同じエフェクトを場所ごとに別のハンドラで供給する
---

同じエフェクトを、場所ごとに別のハンドラで供給したいときはラベルを使います。ラベルは、あるエフェクトと同じ操作を持つ、別の名前のエフェクトです。監査ログと通常の出力をどちらも Console で書きつつ、行き先を分ける、といった場面に使います。

```emela check
import Std.Console.{Console, SystemConsole, TestConsole}
import Std.State.{State}

effect AuditLog of Console

handler StderrConsole implements Console {
  fn print_line(text) { (use Console).print_error_line(text) }
  fn print_error_line(text) { (use Console).print_error_line(text) }
}

fn transfer(from: String, to: String, amount: Int) {
  (use Console).print_line("sent #{amount} from #{from} to #{to}")
  (use AuditLog).print_line("transfer #{from} -> #{to}: #{amount}")
}

fn main() {
  with SystemConsole, AuditLog by StderrConsole {
    transfer("alice", "bob", 100)
  }
}

@test
fn transfers_are_audited() {
  (_, audit) = State.run([], fn() {
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

## effect L of E

```emela
effect AuditLog of Console           # 供給が要る
effect DebugLog of Console default   # Console を供給する with が一緒に供給する
```

- `effect L of E` は、E と同じ操作を持つエフェクト L を宣言します。L を E のラベル、E を L の元のエフェクトと呼びます。
- R の中で L と E は別のエフェクトとして数えます。
- `use L` で取り出した能力の値の操作は E の操作で、呼ぶと R には L が載ります（`(use AuditLog).print_line(...)`）。
- L が中断しうるか（Immediate か）は E で決まります。

### 元のエフェクトの制約

元のエフェクトは、操作を持つ利用者のエフェクトでなければなりません。ラベルや、Async や Scope のような組み込みのエフェクトを書くと E0429 です。元のエフェクトが常に1段で決まり、`default` の意味も1通りで済むようにするためです。

```emela check=error
import Std.Console.{Console}

effect AuditLog of Console
effect Nested of AuditLog
# error[E0429]: label `Nested` cannot stand for `AuditLog`: `AuditLog` is a label
#   = help: write `effect Nested of Console`; `AuditLog` can still be plugged into it with `with Nested by AuditLog`
```

中身を分けたいときは、平たく `effect Nested of Console` と宣言し、`Nested by AuditLog` で差し込みます。

### ラベルのハンドラは書けない

ラベルを実装するハンドラは書けません（E0433）。元のエフェクトのハンドラを書き、`by` で差し込みます。

```emela check=error
import Std.Console.{Console}

effect AuditLog of Console

handler AuditH implements AuditLog {
  fn print_line(text) { () }
  fn print_error_line(text) { () }
}
# error[E0433]: handler `AuditH` cannot implement label `AuditLog`
#   = help: implement `Console` instead, and plug it in with `with AuditLog by AuditH`
```

## with の L と L by P

with には、ハンドラと layer に加えて、ラベルの項目を書けます。

| 項目 | 意味 | 供給 | 依存 |
|---|---|---|---|
| `L` | 本体の中の E を、L の担い手が担う | E | L |
| `L by P` | L に P を差し込む | L | P がハンドラならその依存、エフェクトなら P |

`P` には、E のハンドラ、E そのもの、E の別のラベルを書けます。

```emela check
import Std.Console.{Console, SystemConsole}

effect AuditLog of Console
effect DebugLog of Console default

handler PrefixConsole implements Console {
  fn print_line(text) { (use Console).print_line("[audit] #{text}") }
  fn print_error_line(text) { (use Console).print_error_line("[audit] #{text}") }
}

fn audit() { (use Console).print_line("user 1 logged in") }
fn debug() { (use Console).print_line("cache miss") }

fn report() -> () use { AuditLog, DebugLog } {
  with AuditLog { audit() }    # audit の中の Console を AuditLog が担う
  with DebugLog { debug() }
}

fn main() {
  with SystemConsole, AuditLog by PrefixConsole { report() }    # DebugLog は SystemConsole が担う
}
```

```console
$ emela run main.emel
[audit] user 1 logged in
cache miss
```

- `with AuditLog { audit() }` の中では、`audit` の Console を AuditLog の担い手（ここでは PrefixConsole）が担います。`audit` はラベルを知らないまま、普通に `use Console` を書いています。
- 依存の満たし方と初期化の順序は、ハンドラと同じです。上の PrefixConsole の依存 Console は、同じ with の SystemConsole が満たします。
- `by` の右がほかのエフェクトを担うと E0431 です（``label `AuditLog` stands for `Console`, but `OtherH` provides `Other` ``）。
- ラベルでないエフェクトを with に書く、`by` の左に書くのは E0430、同じ with で同じラベルに2回 `by` を書くのは E0432 です。

### 合流

`L by E` と元のエフェクトを書くと、L の区別を外して、外の E に戻せます。

```emela check
import Std.Console.{Console, SystemConsole}

effect AuditLog of Console

fn transfer() {
  (use AuditLog).print_line("audited")
}

fn main() {
  with SystemConsole, AuditLog by Console {    # 監査ログも標準出力へ
    transfer()
  }
}
```

右の Console は、同じ with の SystemConsole が満たします。

## default

`default` を付けたラベルは、E を供給する with が一緒に供給します。

```emela check
import Std.Console.{Console, SystemConsole}

effect DebugLog of Console default

handler Tagged implements Console {
  fn print_line(text) { (use Console).print_line("[debug] #{text}") }
  fn print_error_line(text) { (use Console).print_error_line(text) }
}

fn work() -> () use { DebugLog, Console } {
  (use DebugLog).print_line("step")
  (use Console).print_line("result")
}

fn main() {
  with SystemConsole { work() }                     # DebugLog も SystemConsole が担う
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

- E を担う項目（ハンドラでも、`M` のようなラベルの項目でもかまいません）に `L by E` を暗黙に足すのと同じです。L は、最も内側で E を供給する with の担い手に落ちます。
- 同じ with に `L by P` があれば、そちらが優先されます。並び順にはよりません（上の2回目は `DebugLog by Tagged` を前に書いていますが、Tagged が担います）。
- default の供給で消えるのは本体の R からだけです。同じ with のほかのハンドラの依存は満たしません。
- 見えない集合（引数の関数型の R など）の中の L は消しません。

### default のないラベルは忘れるとエラー

`default` のないラベルは、供給を忘れると `main` とテストで R が空にならず E0402 になります。監査ログが黙って標準出力に混ざるのを防ぐためです。混ぜたいときは、呼ぶ側が `L by E` と明示します。

```emela check=error
import Std.Console.{Console, SystemConsole}

effect AuditLog of Console

fn main() {
  with SystemConsole {
    (use AuditLog).print_line("x")    # E0402: effect `AuditLog` is not provided in `main`
  }
}
```

### 使われないラベルの項目

本体の R にも、同じ with のほかの項目の依存にも現れないラベルの項目は、警告 W0401 になります。本体の R が見えない集合を含むときは警告しません。

```emela check
import Std.Console.{Console, SystemConsole}

effect AuditLog of Console

fn main() {
  with SystemConsole, AuditLog by Console {
    (use Console).print_line("x")
  }
  # warning[W0401]: label `AuditLog` is listed here but never used
}
```

## シグネチャにはラベルを書く

関数の use 節には、ラベルをそのまま書きます（`use { AuditLog, DebugLog }`）。E に落ちるかどうかは呼ぶ側が決めるので、元のエフェクトは書きません。LSP の型の表示もラベルのまま出し、ラベルの名前の上では宣言（`effect DebugLog of Console default`）を出します。

## 型引数のあるエフェクトのラベル

型引数のあるエフェクトのラベルは、元のエフェクトの型引数を書きます（`effect Hits of State[Int]`）。ラベル自身は型引数を持たないので、書けるのは具体的な型だけです。操作の型はその型引数で決まります。`by` の右のエフェクトにも型引数を書けます（`Hits by State[Int]`）。型引数を書かなければ E0423 です。

同じ型の状態を2つ持つのにも使えます。

```emela check
import Std.State.{State}

effect Hits of State[Int]
effect Misses of State[Int]

fn look(key: String) {
  if key == "a" {
    (use Hits).update(fn(n) { n + 1 })
  } else {
    (use Misses).update(fn(n) { n + 1 })
  }
}

fn main() {
  ((_, misses), hits) = State.run(0, fn() {
    with Hits by State[Int] {
      State.run(0, fn() {
        with Misses by State[Int] {
          List.map(["a", "b", "a"], look)
        }
      })
    }
  })
  dbg(hits)      # 2
  dbg(misses)    # 1
}
```

`Hits by State[Int]` の右の `State[Int]` は、外側の `State.run` が満たします。`Misses by State[Int]` は内側の `State.run` が満たします。型で包む方法（`State[Hits]`、[状態と資源](/guide/resources/)）と比べ、状態の型は Int のままで済みます。
