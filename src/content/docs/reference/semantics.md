---
title: 実行時の意味
description: 評価順序、with の実行、エラーと defect の伝播、中断と再開、fiber、const の評価、終了コード
---

Emela の評価は正格で、左から右に進みます。with に入るときの初期化と抜けるときの解放は、本体がどう終わっても必ず対になります。

このページはプログラムが実行時にどう振る舞うかの規則です。型の上の規則は [型と効果の体系](/reference/type-system/) にあります。正式な意味論は、表層構文を脱糖したコア計算に対して定義する予定です。

## 評価順序

```emela check
type Point(x: Int, y: Int)

fn point(x: Int, y: Int) -> Point { Point(x:, y:) }

fn main() {
  p = point(y: dbg(2), x: dbg(1))      # 2、1 の順に出る
  q = Point(y: dbg(20), ..dbg(p))      # 20 の後に p
  xs = [dbg(10), ..dbg([30])]          # 10 の後に [30]
  ok = False && dbg(True)              # 右辺は評価しない
  ()
}
```

- 引数は、関数を呼ぶ前にすべて評価します（値呼び）。
- 部分式は、ソースに書かれた順に左から右へ評価します。名前付き引数も、宣言の順ではなく書かれた順に評価します。
- リストのリテラルと構成子の呼び出しの `..式` は、ほかの要素とフィールドの後に評価します。
- `&&` と `||` は、左辺で結果が決まれば右辺を評価しません。
- match は対象を1回だけ評価し、腕を上から順に試します。ガードは、パターンが合った後に評価します。どの腕にも合わなければ defect（`unreachable: no match arm matched`）になります。型検査で網羅が保証されるので、通常は起きません。
- 比較の `assert` は、両辺を左から1回ずつ評価します。

## with の実行

`with H1, ..., Hn { 本体 }` は次の順で実行します。

1. ハンドラを依存関係の順に並べ、順に init を実行する。
2. 本体を評価する。
3. 初期化と逆の順に release を実行する。
4. 本体の結果（値、エラー、defect、中断のいずれか）を、with の結果とする。

```emela check
effect Config {
  fn name() -> String
}

effect Log {
  fn info(msg: String) -> ()
}

handler FixedConfig implements Config {
  init {
    dbg("init FixedConfig")
    FixedConfig
  }
  release {
    dbg("release FixedConfig")
  }
  fn name() { "app" }
}

handler NamedLog implements Log {
  init {
    dbg("init NamedLog #{(use Config).name()}")
    NamedLog
  }
  release {
    dbg("release NamedLog")
  }
  fn info(msg) {
    dbg(msg)
    ()
  }
}

fn main() {
  with NamedLog, FixedConfig {
    (use Log).info("body")
  }
}
```

NamedLog は init で Config を使うので、書いた順によらず FixedConfig が先に初期化されます。

```text
"init FixedConfig"
"init NamedLog app"
"body"
"release NamedLog"
"release FixedConfig"
```

- 手順3は、本体がどの形で終わっても実行します。
- ある init が失敗したときは、それまでに初期化が済んだハンドラだけを逆順に release し、本体は評価しません。失敗したハンドラ自身の release は実行しません（init が値を返していないため）。with はその init のエラーで終わります。
- ハンドラの操作の本体で使うエフェクトは、その with の外側のハンドラか、同じ with で先に初期化されたハンドラが供給します。
- 同じエフェクトを供給するハンドラが並んだときは後ろが優先され、上書きされた前のハンドラは初期化もしません。
- release は、正常終了、エラー、defect、中断のどの場合でも1回実行されます。release の実行中は中断されません。

```emela check
error ConnectFailed(reason: String)

effect Config {
  fn url() -> String
}

effect Db {
  fn query(sql: String) -> String
}

handler FixedConfig implements Config {
  release {
    dbg("release FixedConfig")
  }
  fn url() { "db://down" }
}

handler FailingDb implements Db {
  init {
    fail ConnectFailed(reason: (use Config).url())
  }
  release {
    dbg("release FailingDb")
  }
  fn query(sql) { sql }
}

fn main() {
  with FixedConfig, FailingDb {
    dbg((use Db).query("select 1"))
  }
}
```

```console
$ emela run main.emel
"release FixedConfig"
error: ConnectFailed(reason: "db://down")
$ echo $?
1
```

FailingDb の release と本体は実行されません。

## エラーの伝播

- `fail e` は、評価中の式を外側へ順に終わらせていきます。e のタグに合う腕を持つ最も内側の escape に達すると、その腕を評価し、結果が escape 式の値になります。
- 途中で with を抜けるときは、release を実行します。
- 操作の本体が resume せずに失敗したときは、そのエラーが操作の呼び出しの結果になります。

### main の終わり方

- main が正常に終わったときは、戻り値を表示せずに捨て、終了コード 0 で終わります。値を見たいときは `dbg` を使います。
- main まで達したエラーは、プログラムの異常終了になります。標準エラーに `error: <エラーの値の表示>` を1行出し、終了コード 1 で終わります。表示は dbg と同じです（`error: DbError(message: "down")`）。
- 関数型のフィールドを持つ error は、エラーの名前だけを表示します（`error: Retry`）。
- main の E は空でなくて構いません。
- main の R は、Async を除いて空でなければなりません（E0402）。main はエントリのモジュールの `main` という名前の fn です。

```emela check
error DbError(message: String)

fn load() -> Int fails DbError { fail DbError(message: "down") }

fn main() {
  dbg(load())
}
```

```console
$ emela run main.emel
error: DbError(message: "down")
$ echo $?
1
```

## defect の伝播

defect は、プログラムの誤りや回復できない異常です。型には現れず、escape では受けられません。

| 発生源 | 例 | メッセージの例 |
|---|---|---|
| `panic(message)` | 到達しないはずの分岐 | message そのもの。`todo()` は `not yet implemented` |
| `assert` の失敗 | テストでの検証 | `assertion failed: ...` |
| 整数のゼロ除算 | `1 / 0` | `division by zero` |
| 外部関数が投げた例外 | JS の throw | `TypeError: bad` |
| Float から Int への変換の失敗 | `Float.floor(NaN)` | `cannot convert NaN to Int` |
| 負のシフト量 | `Int.shift_left(1, -1)` | `negative shift amount: -1` |
| match の腕に合わない値 | 網羅の検査をすり抜けたとき | `unreachable: no match arm matched` |

メッセージの文面は仕様の一部ではなく、改善のために変えてよいものです。

- defect は escape を素通りし、境界まで巻き戻ります。途中の with では release を実行します。
- 境界とは、プログラムの最上位、テストランナー、`Fiber.attempt` です。defect を観測できるのは境界だけです。
- `emela run` は、最上位に達した defect を標準エラーに `defect: <message>` と1行出し、終了コード 101 で終わります。
- 期待されるエラーを defect に変えるには、escape の腕で panic を呼びます。逆方向の変換は境界でしかできません。

### release の中の defect

release はエラーで終われません（E が空。E0420）。release の中で defect が起きたときは次のとおりにします。

- 本体が値かエラーで終わっていたなら、release の defect が with の結果になります。
- 本体がすでに defect で終わっていたなら、最初の defect を結果にし、release の defect は表示の注記に足します。
- どちらの場合も、残りのハンドラの release はすべて実行します。
- 注記は `note: the release of handler <名前> also failed: <メッセージ>` の形で、起きた順に並べます。
- 中断されたまま巻き戻る途中で release が defect になったときは、`interrupted` でなくその defect が結果になります。
- release の中の suspend な操作が resume されないまま捨てられたときは、本体が defect ならそれを、そうでなければ `interrupted` を結果にします。

```emela check
effect Log {
  fn info(msg: String) -> ()
}

handler NoisyLog implements Log {
  init { NoisyLog }
  release {
    panic("close failed")
  }
  fn info(msg) {
    dbg(msg)
    ()
  }
}

fn main() {
  with NoisyLog {
    (use Log).info("body")
    panic("body failed")
  }
}
```

```console
$ emela run main.emel
"body"
defect: body failed
note: the release of handler NoisyLog also failed: close failed
$ echo $?
101
```

## 中断と再開

suspend な操作の呼び出しは、次の手順で進みます。

1. suspend な操作を呼ぶと、呼び出し元の残りの計算が継続として取り出され、ハンドラの操作の本体が実行される。
2. ハンドラが `resume(v)` を呼ぶと、継続が再開し、操作の呼び出し式の値が v になる。
3. 操作の本体の中でその場で resume した場合、呼び出し元は中断せずに続きを実行する。resume の後に操作の本体の残りがあれば、それを先に実行し終えてから呼び出し元が続く。
4. 後から resume した場合、その resume の呼び出しの中で呼び出し元が再開し、呼び出し元が次に中断するか終わったところで resume が戻る（値は `()`）。

```emela check
effect Wait {
  suspend fn wait() -> Int
}

handler After implements Wait {
  suspend fn wait(resume) {
    resume(1)
    dbg("after resume")
    ()
  }
}

fn main() {
  with After {
    n = (use Wait).wait()
    dbg(n)
  }
}
```

手順3のとおり、`"after resume"` が `1` より先に出ます。

### resume の回数

- 継続を再開できるのは高々1回です。2回目の resume は defect になります。文面には、どのハンドラのどの操作で起きたかを出します（`` resume called twice in operation `wait` of handler `Twice` ``）。
- 同じ経路で2回呼ぶ、ループや再帰の中で呼ぶ、のような目で見て分かる誤りは linter が警告します。型での保証は持ちません。
- resume した後で操作の本体が失敗したり defect になったりしたときは、呼び出し元はすでに進んでいるので、プログラムの最上位（またはテスト）の defect になります（`... failed after resume: <エラー>`）。
- main かテスト関数が終わった後に呼ばれた resume は、何もしません（2回目でも defect にしません）。

### resume されない継続

- 中断しない文脈（R が Immediate。その場で resume するハンドラの with の中）で suspend な操作がその場で resume されなかったときは、その継続はもう resume されません（後から resume できるハンドラは依存に Async を持ち、R が Immediate でなくなるため）。この場合は、プログラムの最上位が終わるのを待たず、その時点で中断されたまま巻き戻ります。
- resume が一度も呼ばれないまま捨てられた場合、その継続は中断されたものとして巻き戻ります。巻き戻るのは、その fiber を待っているスコープ（Fiber.scope か、プログラムの最上位）が終わるときです。継続が捨てられた瞬間を検出することは求めません。
- main の継続が中断されたまま巻き戻ったときは、標準エラーに `interrupted` を1行出し、終了コード 130 で終わります。テスト関数の継続が中断されたときは、そのテストの `interrupted` の失敗として報告し、残りのテストを続けます。
- 中断されたまま巻き戻るときも、途中の with の release を内側から実行します。

```emela check
effect Wait {
  suspend fn wait() -> Int
}

handler Dropping implements Wait {
  release {
    dbg("release Dropping")
  }
  suspend fn wait(resume) { () }    # resume しない
}

fn main() {
  with Dropping {
    n = (use Wait).wait()
    dbg(n)
  }
}
```

```console
$ emela run main.emel
"release Dropping"
interrupted
$ echo $?
130
```

### 継続と fiber

- main かテスト関数が値、エラー、defect のどれかで終わった後に残った継続（resume の後も走り続ける操作の実装など）の中の with は、release しません。
- 他の fiber への切り替えと、中断の到達が起きるのは中断点だけです。
- 別の fiber から呼ばれた resume（resume を値として受け渡したとき）は待ち行列に入れ、呼んだ側の一息の区間に割り込ませません。ホストのコールバックと同じ fiber からの resume は、手順3と4のとおりその場で続けます。
- resume の後も走り続ける操作の実装は、同じ fiber の別の継続として進みます。fiber への中断は本筋の継続にだけ届き、操作の実装の継続は止めません。スコープは操作の実装の継続を待ちません。起動（main かテスト）が中断されたときは閉じ、その release の defect は起動の結果にします。
- イベントループが空になったときは、すべての fiber を中断し、待っている継続すべてを巻き戻します。release の実行中でも打ち切ります。子を待つスコープだけは子の巻き戻りを待ちます。

## fiber に関わる規則

fiber の使い方は [並行性](/guide/concurrency/) にあります。ここでは実行時の規則だけを並べます。

### 切り替え

- fiber は、1つのスレッドの上で協調的に切り替わる軽量な実行単位です。並列ではありません。
- 切り替えが起きるのは中断点だけです。中断点とは、Async を要求する suspend な操作の呼び出しと、ランタイムが公平性のために挟む譲渡です。
- 譲渡は、中断しうる呼び出しの位置にだけ挟みます。ランタイムは中断しうる呼び出しの回数を数え、一定の回数ごとに他の fiber とホストのコールバックに譲ります。時間でなく回数で数えるので、切り替えの順序は実行のたびに同じになります。回数は規定しません。
- 中断しうる呼び出しを挟まない区間は一息に実行されます。`st.set(st.get() + 1)` は一息ですが、`x = st.get(); helper(); st.set(x + 1)` は `helper` の R が Immediate でなければ割り込まれえます。
- Immediate な関数は、他の fiber から見て一息に実行されます。譲渡も挟みません。
- fork は中断点ではありません。子は待ち行列に入り、親が次に中断したときに走り始めます。走り始める前に中断された子は、渡した関数を呼ばずに Interrupt で終わります。

### スコープの終わり方

- 子の fiber は、スコープを抜けるまでに必ず終わります。スコープの本体が値を返した時点で残っている子は中断され、すべての子の巻き戻り（release を含む）が終わってから、スコープが本体の値を返します。
- 子がエラーか defect で終わると、兄弟の fiber（スコープの本体を含む）は中断され、原因はスコープの外へ伝わります。2つ以上の子が失敗したときは、先に失敗したものをスコープの結果にし、後の失敗は注記（`note: another fiber also failed: <原因>`）に足します。
- スコープの結果は、本体と子のうち最初の Fail か Die、なければ本体の終わり方です。本体が外からの中断で巻き戻る途中に子が defect で終われば、その defect が結果になります。
- スコープは、本体が値を返したときか、子が失敗したときに閉じます。閉じた後に fork すると defect になります。兄弟の失敗で巻き戻る途中の fork と deferred も defect になり、注記に回ります。

### 中断

- 中断は、対象の fiber が次の中断点に達したときに効果を持ちます。
- 中断された fiber は、その地点から巻き戻ります。途中の with について、ハンドラの release が内側から順に実行されます。
- release の実行中は中断されません。中断は、実行中の release が終わった後に効きます。
- 子が中断されるのは、スコープの本体が値を返したとき、兄弟が失敗したとき、`Fiber.interrupt` を呼ばれたときの3通りです。
- `Fiber.interrupt` は、子を中断し、巻き戻り（release を含む）が終わるまで待ちます。終わっている子には何もしません。自分自身への `Fiber.interrupt` は、その場で巻き戻ります（release の中なら release の後）。
- 届いた中断は、受け止める枠（スコープかプログラムの最上位）に達するまで巻き戻りとして続きます。途中で内側のスコープの結果を escape が受けるなどして普通の処理に戻っても、次の中断点でもう一度中断します。

### 失敗の原因

fiber が正常に終わらなかったときの原因は3種類で、監視する側はこの区別を観測できます。

| 原因 | 発生源 | 型に現れるか |
|---|---|---|
| Fail | fail | 現れる（E） |
| Die | defect | 現れない |
| Interrupt | 中断 | 現れない |

原因ごとに、受け取り方が違います。

| 原因 | attempt | await | スコープ |
|---|---|---|---|
| Fail | Failure として受ける | 届かない | 兄弟を中断して伝える |
| Die | Failure として受ける | 届かない | 兄弟を中断して伝える |
| Interrupt | 受けずに巻き戻る | Failure として受ける | その子だけが終わる |

```emela check
import Std.Cause
import Std.Fiber.{Fiber, Exit, Success, Failure}

error Boom

fn describe[A, E](exit: Exit[A, E]) -> String {
  exit match {
    Success(_) -> "success"
    Failure(cause) -> Cause.to_string(cause)
  }
}

fn main() {
  dbg(describe(Fiber.attempt(fn() { 1 })))                  # "success"
  dbg(describe(Fiber.attempt(fn() { fail Boom })))          # "error: Boom"
  dbg(describe(Fiber.attempt(fn() { panic("broken") })))    # "defect: broken"
  ()
}
```

- 待つのは、join か await を呼んだ fiber だけです。ほかの fiber はその間も進みます。
- 子の Fail と Die はスコープに伝わるので、join と await に届くのは成功か Interrupt だけです。終わった子の値は覚えておき、2回目からはすぐ返します。
- 中断された子を join すると、中断の起こり方（`Fiber.interrupt`、スコープの終わり、resume されずに捨てられた継続）によらず defect（`fiber was interrupted`）になります。
- release の実行中は中断を待たせるので、その間だけ join と await が失敗した子を見ることがあります。そのとき join は呼んだ fiber を中断として巻き戻し（join の型に E がないため）、await は `Failure(原因)` をそのまま返します。
- 巻き戻りの途中の attempt は Die も受けません（release の defect を fiber の結果に残すため）。
- attempt は、自分の fiber への中断（Interrupt）を受けません。受けると、中断を握りつぶして走り続ける fiber が書けてしまうためです。Interrupt を観測できるのは、await で子を見るときだけです。

```emela check
import Std.Clock.{Clock, SystemClock}
import Std.Cause
import Std.Fiber.{Fiber, Success, Failure}

fn main() {
  with SystemClock {
    Fiber.scope(fn() {
      child = Fiber.fork(fn() { (use Clock).sleep(1000) })
      Fiber.interrupt(child)
      Fiber.await(child) match {
        Success(_) -> dbg("success")
        Failure(cause) -> dbg(Cause.to_string(cause))    # "interrupted"
      }
      Fiber.join(child)    # defect: fiber was interrupted
    })
  }
}
```

### 持ち出しの実行時の検査

型で止まらない持ち出しは、0.20 では実行時に検査します（0.22 の capture set で静的になります）。

- release 済みのハンドラの操作を呼ぶと defect（`handler PostgresUsers was used after release`）になります。この検査は、フィールド、init、release のどれかを持つハンドラにだけ掛かります。
- 終わったスコープの Scope の操作、ハンドルの join、await、interrupt、Deferred の complete、await、poll は defect になります。文面は `fiber scope was used after it ended`、`fiber was joined after its scope ended`（awaited、interrupted も同じ形）、`deferred was completed after its scope ended`（awaited も同じ形）です。

## 値とメモリ

- すべての値は不変です。可変な状態は、State のエフェクト、ハンドラが持つホスト側のオブジェクト、Deferred（一度だけ書ける）に限られます。
- メモリの解放のタイミングは観測できず、規定しません。
- リソースはハンドラの release で後始末します。値の解放に連動するデストラクタは持ちません。

## const の評価

```emela check
const ZERO = 0
const RATIO = 1 / ZERO

fn main() {
  dbg("start")
  dbg(RATIO)
}
```

```console
$ emela run main.emel
"start"
defect: while evaluating const RATIO: division by zero
$ echo $?
101
```

- 右辺は純粋な式（E と R が空）に限ります。関数の呼び出しは書けます。
- 右辺は、最初に参照したときに1回だけ評価し、その値を覚えておきます。起動時にすべてを評価しないのは、使っていない const の defect でプログラムやほかのテストが動かなくなるのを避けるためです。
- 評価の途中の defect は、最初に参照したところで起きます。文面に const の名前を入れます（`while evaluating const X: division by zero`）。
- 評価の途中の defect も覚え、次の参照でも同じ defect を起こします（評価し直しません）。テストの間でも共有されます。
- 入れ子の const の defect は、通った const ごとに名前を前に足します（`while evaluating const A: while evaluating const B: division by zero`）。
- 評価の途中で自分自身を参照すると defect（`const A refers to itself while being evaluated`）になります。自己参照の defect には名前を足さず、どの const にも覚えさせません。
- 名前だけで循環している const（`const A = B` と `const B = A`）はコンパイル時に E0231 になります。E0231 は、値を評価すると必ず評価する参照だけで循環を見ます。if と match の腕、`&&` と `||` の右辺、ラムダの本体、呼んだ関数の中の参照は数えず、実行時の自己参照の defect に任せます。構造を通る循環（`const P = (Q, 1)` と `const Q = [P]`）は E0231 です。
- 汎化した const（`const EMPTY = []`）も、0.20 では型が実行時に消えるので、覚える値は1つです。

```emela check
const A = next()

fn next() -> Int { A + 1 }

fn main() {
  dbg(A)    # defect: const A refers to itself while being evaluated
}
```

```emela check=error
const A = B + 1
const B = A + 1    # error[E0231]: constants refer to each other
```

:::caution[今の実装との違い]
if の腕を通る自己参照（`const A: Int = if True { A } else { 0 }`）は、今の実装では defect にならず、実行が止まりません。
:::

## 終了コード

`emela run` の終了コードは次のとおりです。

| 終了コード | 意味 |
|---|---|
| 0 | main が正常に終わった。診断が警告だけのときも 0 |
| 1 | main までエラーが達した（`error: ...`）。または、コンパイルの診断にエラーがあった |
| 101 | 最上位に defect が達した（`defect: ...`） |
| 130 | main の継続が中断されたまま巻き戻った（`interrupted`） |
| 128 + シグナル番号 | シグナルで止まった。C のターゲットで C の関数が `abort` したときも、defect でなくこれで終わる |

`emela test` は、1つでも失敗すれば 1、なければ 0（テストが0個でも 0）で終わります。テストの途中でプログラムが終了したときは、実行中のテストを失敗にします。コマンドの詳細は [CLI](/tools/cli/) にあります。
