---
title: 実行時の意味
description: 評価順序、with の実行、エラーと defect の伝播、main の終わり方、中断と再開、fiber、const の評価、終了コード
---

:::note[規範は仕様]
このページは仕様の [実行時の意味](https://github.com/emela-lang/emela/blob/main/spec/language/14-dynamics.md)、[並行性](https://github.com/emela-lang/emela/blob/main/spec/language/11-concurrency.md)、[エラー](https://github.com/emela-lang/emela/blob/main/spec/language/07-errors.md)、[エフェクト](https://github.com/emela-lang/emela/blob/main/spec/language/08-effects.md) の実行時の部分と、[コマンド](https://github.com/emela-lang/emela/blob/main/spec/tooling/commands.md) の終了コードを日本語でまとめたものです。規範となるのは英語の [仕様](https://github.com/emela-lang/emela/tree/main/spec) で、食い違うときは仕様に従います。
:::

Emela の評価は正格で、左から右に進みます。with に入るときの初期化と抜けるときの解放は、本体がどう終わっても必ず対になります。

このページはプログラムが実行時にどう振る舞うかの規則です。型の上の規則は [型と効果の体系](/reference/type-system/) にあります。正式な意味論は表層構文を脱糖したコア計算に対して定義する予定です。

## 評価順序

```emela check
type Point(x: Int, y: Int)

fn point(x: Int, y: Int) -> Point { Point(x:, y:) }

fn main() {
  p = point(y: dbg(2), x: dbg(1)) # 2、1 の順に出る
  q = Point(y: dbg(20), ..dbg(p)) # 20 の後に p
  xs = [dbg(10), ..dbg([30])] # 10 の後に [30]
  ok = False && dbg(True) # 右辺は評価しない
  ()
}
```

- 引数は関数を呼ぶ前にすべて評価します（値呼び）。
- 部分式はソースに書かれた順に左から右へ評価します。名前付き引数も宣言の順ではなく書かれた順に評価します。
- リストのリテラルと構成子の呼び出しの `..式` はほかの要素とフィールドの後に評価します。
- `&&` と `||` は左辺で結果が決まれば右辺を評価しません。
- match は対象を1回だけ評価し、腕を上から順に試します。ガードはパターンが合った後に評価します。どの腕にも合わなければ defect（`unreachable: no match arm matched`）になります。型検査で網羅が保証されるので、通常は起きません。
- Float のリテラルのパターンは `==` で照合します。`0.0` は `-0.0` にも合います。NaN は自分自身とも等しくないので、NaN の値のパターンはどの値にも合いません。NaN を見分けるには、ガードで `x != x` を確かめます。

### assert

- 比較の `assert` は両辺を左から1回ずつ評価します。assert は通常のビルドでも取り除きません。
- 失敗すると defect になり、メッセージは `assertion failed: <式のソース>` です。比較の assert で両辺の型が Show を満たすときは、その後に `  left: <左辺>` と ` right: <右辺>` の2行を続けます（コロンの位置がそろうように、left の前は空白2つ、right の前は1つ）。満たさないときは式のソースだけです。
- 値を表示する関数は、比較が False のときにだけ呼びます。

```emela check
fn main() {
  xs = [1, 2]
  assert List.length(xs) == 3
}
```

```console
$ emela run main.emel
defect: assertion failed: List.length(xs) == 3
  left: 2
 right: 3
```

## with の実行

`with H1, ..., Hn { 本体 }` は次の順で実行します。

1. 項目の引数（`H(引数)`）を、項目を書いた順に評価する。次にハンドラを依存関係の順に並べ、順に init を実行する。
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

handler FixedConfig: Config {
  init {
    dbg("init FixedConfig")
    FixedConfig
  }
  release {
    dbg("release FixedConfig")
  }
  fn name() { "app" }
}

handler NamedLog: Log {
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

```console
$ emela run main.emel
"init FixedConfig"
"init NamedLog app"
"body"
"release NamedLog"
"release FixedConfig"
```

NamedLog は init で Config を使うので、書いた順によらず FixedConfig が先に初期化されます。

- 手順3は本体がどの形で終わっても実行します。release は正常終了、エラー、defect、中断のどの場合でも1回実行されます。release の実行中は中断されません。
- 引数の評価が失敗したときは、まだどの init も実行していないので何も release せず、with はそのエラーで終わります。
- ある init が失敗したときは、それまでに初期化が済んだハンドラだけを逆順に release し、本体は評価しません。失敗したハンドラ自身の release は実行しません（init が値を返していないため）。with はその init のエラーで終わります。
- ハンドラの操作の本体で使うエフェクトは、その with の外側のハンドラか、同じ with で先に初期化されたハンドラが供給します。
- 同じエフェクトを供給するハンドラが並んだときは後ろが優先され、上書きされた前のハンドラは初期化もしません。その引数も評価しません。
- 複数のエフェクトを実装するハンドラは、そのすべてを供給します。init と release は1回ずつ実行します。
- ハンドラメンバーの項目（`x = E.M(引数)` や `x = c.M(引数)`）は、E（または c）を供給するハンドラのメンバー M の init を実行します。並び順は、ほかの項目と同じく要求（E か c だけ）で決めます。
- init の中で開いたハンドラは、開いたハンドラの release の後に、開いたのと逆の順に release します。init が途中で失敗したときは、それまでに開いたものを逆順に release します。
- release の値は捨てるので、型は問いません。release の中で suspend な操作を呼んでもかまいません（その間は中断されません）。
- フィールドのないハンドラに init を書くときは、`handler H` なら値 `H` を、`handler H()` なら `H()` を返します。
- layer の中のハンドラも依存の順に初期化します。依存から順が決まらないところは、書いた順を保ちます。

```emela check
error ConnectFailed(reason: String)

effect Config {
  fn url() -> String
}

effect Db {
  fn query(sql: String) -> String
}

handler FixedConfig: Config {
  release {
    dbg("release FixedConfig")
  }
  fn url() { "db://down" }
}

handler FailingDb: Db {
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
  ()
}
```

```console
$ emela run main.emel
"release FixedConfig"
error: ConnectFailed
$ echo $?
1
```

FailingDb の release と本体は実行されません。

## エラーの伝播

- `fail e` は評価中の式を外側へ順に終わらせていきます。e のタグに合う腕を持つ最も内側の escape に達すると、その腕を評価し、結果が escape 式の値になります。
- 途中で with を抜けるときは、release を実行します。
- 操作の本体が resume せずに失敗したときは、そのエラーが操作の呼び出しの結果になります（操作の fails として呼び出し元の E に入ります）。

### main の終わり方

- main はエントリのモジュールの `main` という名前の fn です。main でない `main`（const など）は数えません。
- main が正常に終わったときは、戻り値を表示せずに捨て、終了コード 0 で終わります。値を見たいときは `dbg` を使います。
- 例外は戻り値の型が `ExitCode`（`Std.Process`）の main で、その値の終了コードで終わります。0 から 255 のどれでも選べます。
- main の戻り値の型は `()` か `ExitCode` にします。どちらでもなく Never でもない型は警告 W0304 になります。そのときも実行はでき、値は捨てます。
- `ExitCode` で 1、101、130 も選べます。そのときは終了コードだけではエラー、defect、中断と区別できず、区別できるのは標準エラーに出る行だけです。
- main まで達したエラーは、プログラムの異常終了になります。標準エラーに `error: <エラーの値の表示>` を1行出し、終了コード 1 で終わります。エラーの型が Show を満たすときは inspect と同じ表示です（`error DbError(message: String) derive Show` なら `error: DbError(message: "down")`）。満たさないときは、エラーの名前だけを表示します（`error: Retry`）。main の E に Show は要りません。
- main の E は空でなくてかまいません。
- main の R は、main に与えられるホストのエフェクト（Async と ProcessHost）を除いて空でなければなりません（E0402）。main に uses 節を書いていても同じです。

```emela check
error DbError(message: String) derive Show

fn load() -> Int fails DbError { fail DbError(message: "down") }

fn main() {
  dbg(load())
  ()
}
```

```console
$ emela run main.emel
error: DbError(message: "down")
$ echo $?
1
```

```emela check
import Std.Process.{ExitCode, EXIT_SUCCESS, exit_code}

fn check(n: Int) -> ExitCode {
  if n > 0 { EXIT_SUCCESS } else { exit_code(2) }
}

fn main() -> ExitCode {
  check(0)
}
```

```console
$ emela run main.emel
$ echo $?
2
```

`exit_code` に 0 から 255 の外の数を渡すと defect です。

## defect の伝播

defect はプログラムの誤りや回復できない異常です。型には現れず、escape では受けられません。

| 発生源 | 例 | メッセージの例 |
|---|---|---|
| `panic(message)` | 到達しないはずの分岐 | message そのもの。`todo()` は `not yet implemented` |
| `assert` の失敗 | テストでの検証 | `assertion failed: ...` |
| 整数のゼロ除算 | `1 / 0` | `division by zero` |
| 外部関数が投げた例外 | JS の throw | `TypeError: bad` |
| Float から Int への変換の失敗 | `Float.floor(NaN)` | `cannot convert NaN to Int` |
| 負のシフト量 | `Int.shift_left(1, -1)` | `negative shift amount: -1` |
| match の腕に合わない値 | 網羅の検査をすり抜けたとき | `unreachable: no match arm matched` |
| 2回目の resume | 同じ継続を2回 resume した | ``resume called twice in operation `sleep` of handler `SystemClock` `` |
| ターゲットの指定がない外部関数の呼び出し | 公開する fn から届く外部関数 | ``external function `console_log` is not available on this target`` |

メッセージの文面は仕様の一部ではなく、改善のために変えてよいものです。メモリが足りないときに defect になるかどうかは実装が決めます。プログラムはその扱いに頼ってはいけません。

- defect は escape を素通りし、境界まで巻き戻ります。途中の with では release を実行します。
- 境界とはプログラムの最上位、テストランナー、`Exit.attempt` です。defect を観測できるのは境界だけです。
- `emela run` は最上位に達した defect を標準エラーに `defect: <message>` と1行出し、終了コード 101 で終わります。
- 期待されるエラーを defect に変えるには、escape の腕で panic を呼びます。逆方向の変換は境界でしかできません。
- 外部関数が投げた例外の defect は、例外の名前を前に付けたメッセージになります（`defect: TypeError: bad`）。Error でない値を投げたときは `defect: uncaught exception: oops` の形です。外部関数の呼び出しの外でホストのコードが投げた例外（呼び出しが戻った後のタイマーのコールバックなど）も、同じメッセージの defect になります。
- 外部関数に渡したコールバックの中で起きた defect は、外部関数の例外として包まれずに元の defect のまま伝わります。

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

handler NoisyLog: Log {
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

suspend な操作の呼び出しは次の手順で進みます。

1. suspend な操作を呼ぶと、呼び出し元の残りの計算が継続として取り出され、ハンドラの操作の本体が実行される。
2. ハンドラが `resume(v)` を呼ぶと、継続が再開し、操作の呼び出し式の値が v になる。
3. 操作の本体の中でその場で resume した場合、呼び出し元は中断せずに続きを実行する。resume の後に操作の本体の残りがあれば、それを先に実行し終えてから呼び出し元が続く。
4. 後から resume した場合、その resume の呼び出しの中で呼び出し元が再開し、呼び出し元が次に中断するか終わったところで resume が戻る（値は `()`）。

```emela check
effect Wait {
  suspend fn wait() -> Int
}

handler After: Wait {
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
  ()
}
```

```console
$ emela run main.emel
"after resume"
1
```

手順3のとおり、`"after resume"` が `1` より先に出ます。

### resume の回数

- 継続を再開できるのは高々1回です。2回目の resume は defect になります。文面にはどのハンドラのどの操作で起きたかを出します（`` resume called twice in operation `wait` of handler `Twice` ``）。
- 同じ経路で2回呼ぶ、ループや再帰の中で呼ぶ、のような目で見て分かる誤りは linter が警告します。型での保証は持ちません。
- resume した後で操作の本体が失敗したり defect になったりしたときは、呼び出し元はすでに進んでいるので、プログラムの最上位（またはテスト）の defect になります（`... failed after resume: <エラー>`）。
- main かテスト関数が終わった後に呼ばれた resume は、何もしません（2回目でも defect にしません）。

### resume されない継続

- 中断しない文脈（R が Immediate。その場で resume するハンドラの with の中）で suspend な操作がその場で resume されなかったときは、その継続はもう resume されません（後から resume できるハンドラは依存に Async を持ち、R が Immediate でなくなるため）。この場合は、プログラムの最上位が終わるのを待たず、その時点で中断されたまま巻き戻ります。
- resume が一度も呼ばれないまま捨てられた場合、その継続は中断されたものとして巻き戻ります。巻き戻るのは、その fiber を待っているスコープ（Fiber.scope か、プログラムの最上位）が終わるときです。継続が捨てられた瞬間を検出することは求めません。
- main の継続が中断されたまま巻き戻ったときは、標準エラーに `interrupted` を1行出し、終了コード 130 で終わります。テスト関数の継続が中断されたときは、そのテストの `interrupted` の失敗として報告し、残りのテストを続けます。
- 中断されたまま巻き戻るときも、途中の with の release を内側から実行します。
- native のターゲットで、走れる fiber も、待ちの登録（タイマーやファイル記述子）も、届いていない完了もなくなったときは、すべての fiber を中断し、待っている継続を巻き戻し、待っている task を取り消します（[ターゲット](/reference/targets/)）。

```emela check
effect Wait {
  suspend fn wait() -> Int
}

handler Dropping: Wait {
  release {
    dbg("release Dropping")
  }
  suspend fn wait(resume) { () } # resume しない
}

fn main() {
  with Dropping {
    n = (use Wait).wait()
    dbg(n)
  }
  ()
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
- resume の後も走り続ける操作の実装は、同じ fiber の別の継続として進みます。fiber への中断は本筋の継続にだけ届き、操作の実装の継続は止めません。スコープは操作の実装の継続を待ちません。起動（main かテスト）が中断されたときは、これらの継続も閉じ（release を実行して巻き戻し）、その release の defect は起動の結果にします。
- イベントループが空になったときは、すべての fiber を中断し、待っている継続すべてを巻き戻します。release の実行中でも打ち切ります。子を待つスコープだけは子の巻き戻りを待ちます。

## fiber に関わる規則

fiber の使い方は [並行性](/guide/concurrency/) にあります。ここでは実行時の規則だけを並べます。

### 切り替え

- fiber は1つのスレッドの上で協調的に切り替わる軽量な実行単位です。並列ではありません。
- 切り替えが起きるのは中断点だけです。中断点とは、Async を要求する suspend な操作の呼び出しと、ランタイムが公平性のために挟む譲渡です。
- 譲渡は中断しうる呼び出しの位置にだけ挟みます。ランタイムは中断しうる呼び出しの回数を数え、一定の回数ごとに他の fiber とホストのコールバックに譲ります。時間でなく回数で数えるので、切り替えの順序は実行のたびに同じになります。回数は規定しません。
- 中断しうる呼び出しを挟まない区間は一息に実行されます。`st.set(st.get() + 1)` は一息ですが、`x = st.get(); helper(); st.set(x + 1)` は `helper` の R が Immediate でなければ割り込まれえます。
- Immediate な関数は他の fiber から見て一息に実行されます。譲渡も挟みません。
- fork は中断点ではありません。子は待ち行列に入り、親が次に中断したときに走り始めます。走り始める前に中断された子は、渡した関数を呼ばずに Interrupt で終わります。

### スコープの終わり方

- 子の fiber はスコープを抜けるまでに必ず終わります。スコープの本体が値を返した時点で残っている子は中断され、すべての子の巻き戻り（release を含む）が終わってから、スコープが本体の値を返します。
- 子がエラーか defect で終わると、兄弟の fiber（スコープの本体を含む）は中断され、原因はスコープの外へ伝わります。2つ以上の子が失敗したときは、先に失敗したものをスコープの結果にし、後の失敗は注記（`note: another fiber also failed: <原因>`）に足します。
- スコープの結果は本体と子のうち最初の Fail か Die、なければ本体の終わり方です。本体が外からの中断で巻き戻る途中に子が defect で終われば、その defect が結果になります。
- スコープは本体が値を返したときか、子が失敗したときに閉じます。閉じた後に fork すると defect になります。兄弟の失敗で巻き戻る途中の fork、deferred、semaphore、queue も defect になり、注記に回ります。
- 子の中の `use Scope` は、その子が属すスコープ自身を指します。子は兄弟を fork できます。
- 入れ子のスコープでは、`use Scope` と `Fiber.fork` は最も内側のスコープを指します。外側へ fork するときは、外側で取り出した能力の値を使います（`outer = use Scope` と取り出して `outer.fork(...)`）。
- 内側の子は内側のスコープと一緒に終わり、外側に fork した子は外側のスコープが終わるまで走ります。
- 誰も値を入れない Deferred を待つ子は、スコープの終わりで中断されます。
- 親より長く生きる切り離された fiber はありません。長く走る処理は main の直下のスコープで fork します。

```emela check
import Std.Console.{Console, SystemConsole}
import Std.Clock.{Clock, SystemClock}
import Std.Fiber.{Fiber, Scope}

fn main() {
  with SystemConsole, SystemClock {
    console = use Console
    clock = use Clock
    Fiber.scope(|| {
      outer = use Scope
      Fiber.scope(|| {
        outer.fork(|| {
          clock.sleep(100)
          console.print_line("outer child")
        })
        Fiber.fork(|| {
          clock.sleep(100)
          console.print_line("inner child")
        })
        clock.sleep(10)
      })
      console.print_line("inner scope ended")
      clock.sleep(200)
    })
  }
}
```

```console
$ emela run main.emel
inner scope ended
outer child
```

### 中断

- 中断は対象の fiber が次の中断点に達したときに効果を持ちます。
- 中断された fiber はその地点から巻き戻ります。途中の with について、ハンドラの release が内側から順に実行されます。
- release の実行中は中断されません。中断は、実行中の release が終わった後に効きます。
- 子が中断されるのは、スコープの本体が値を返したとき、兄弟が失敗したとき、`Fiber.interrupt` を呼ばれたときの3通りです。
- `Fiber.interrupt` は子を中断し、巻き戻り（release を含む）が終わるまで待ちます。終わっている子には何もしません。自分自身への `Fiber.interrupt` は、その場で巻き戻ります（release の中なら release の後）。
- 届いた中断は受け止める枠（スコープかプログラムの最上位）に達するまで巻き戻りとして続きます。途中で内側のスコープの結果を escape が受けるなどして普通の処理に戻っても、次の中断点でもう一度中断します。
- 閉じた標準出力への書き込みも、書いた fiber をその場から中断として巻き戻し、ほかのすべての fiber を中断します。main の巻き戻りが終わると、標準エラーに何も出さずに終了コード 141 で終わります。閉じた標準エラーへの書き込みは捨てて、プログラムは続きます。

### 失敗の原因

fiber が正常に終わらなかったときの原因は3種類で、監視する側はこの区別を観測できます。

| 原因 | 発生源 | 型に現れるか |
|---|---|---|
| Fail | fail | 現れる（E） |
| Die | defect | 現れない |
| Interrupt | 中断 | 現れない |

原因ごとに受け取り方が違います。

| 原因 | attempt | await | スコープ |
|---|---|---|---|
| Fail | Failure として受ける | 届かない | 兄弟を中断して伝える |
| Die | Failure として受ける | 届かない | 兄弟を中断して伝える |
| Interrupt | 受けずに巻き戻る | Failure として受ける | その子だけが終わる |

```emela check
import Std.Cause
import Std.Exit.{Exit, Success, Failure}

error Boom

fn describe[A, E](exit: Exit[A, E]) -> String {
  exit match {
    Success(_)     -> "success"
    Failure(cause) -> Cause.to_string(cause)
  }
}

fn main() {
  dbg(describe(Exit.attempt(|| 1))) # "success"
  dbg(describe(Exit.attempt(|| fail Boom))) # "error: Boom"
  dbg(describe(Exit.attempt(|| panic("broken")))) # "defect: broken"
  ()
}
```

- 待つのは join か await を呼んだ fiber だけです。ほかの fiber はその間も進みます。
- 子の Fail と Die はスコープに伝わるので、join と await に届くのは成功か Interrupt だけです。終わった子の値は覚えておき、2回目からはすぐ返します。
- 中断された子を join すると、中断の起こり方（`Fiber.interrupt`、スコープの終わり、resume されずに捨てられた継続）によらず defect（`fiber was interrupted`）になります。
- release の実行中は中断を待たせるので、その間だけ join と await が失敗した子を見ることがあります。そのとき join は呼んだ fiber を中断として巻き戻し（join の型に E がないため）、await は `Failure(原因)` をそのまま返します。
- 巻き戻りの途中の attempt は Die も受けません（release の defect を fiber の結果に残すため）。
- attempt は自分の fiber への中断（Interrupt）を受けません。受けると、中断を握りつぶして走り続ける fiber が書けてしまうためです。Interrupt を観測できるのは、await で子を見るときだけです。
- 子のエラーをスコープに伝えたくないときは、子の中で attempt に包みます。fork の種類はほかにありません。

```emela check
import Std.Clock.{Clock, SystemClock}
import Std.Cause
import Std.Exit.{Success, Failure}
import Std.Fiber.{Fiber}

fn main() {
  with SystemClock {
    Fiber.scope(|| {
      child = Fiber.fork(|| (use Clock).sleep(1000))
      Fiber.interrupt(child)
      Fiber.await(child) match {
        Success(_)     -> dbg("success")
        Failure(cause) -> dbg(Cause.to_string(cause)) # "interrupted"
      }
      Fiber.join(child) # defect: fiber was interrupted
    })
  }
}
```

### Semaphore と Queue

Semaphore と Queue は、Deferred と同じくスコープに属す可変な入れ物です。作れるのは Scope の操作（`Fiber.semaphore`、`Fiber.queue`）だけです。

- `Fiber.semaphore(permits)` の `permits` が 1 未満なら defect です。`Fiber.queue(capacity)` の `capacity` も同じです。
- `with_permits(s, n, f)` は n 個の許可が空くまで待って取り、`f` を実行し、`f` がどう終わっても（値、エラー、defect、中断）許可を返します。`f` の中の with の release は許可を返す前に実行します。`f` の中で Fiber.scope を使っていれば、許可を返すのはその子がすべて終わった後です。
- `n` が 1 未満のとき、また s を作ったときの許可の数より多いときは defect です。
- 許可を待つ fiber は待ち始めた順に受け取ります。先頭の fiber が待っている間は、少ない許可で足りる後ろの fiber も取りません。許可を返すことは中断点ではありません。受け取った fiber は、返した fiber の次の中断点以降に再開します。
- 許可は呼び出しごとに数えます。`with_permits` の `f` の中で同じ Semaphore の `with_permits` を呼ぶと、さらに許可を取ります。どの fiber も進めなくなったときは、resume されない継続と同じく fiber を中断します。
- `try_with_permits` は、許可が空いていて s を待つ fiber がいなければ `f` を実行して `Some` を返し、そうでなければ `f` を実行せずに `None` を返します。中断点ではありません。
- Queue の `offer` は満杯の間、`take` は空の間待ちます。待つ fiber は offer 側と take 側それぞれで待ち始めた順に扱い、値は offer を始めた順に出てきます。
- 待っている間に中断された fiber は列から抜けます。中断された offer は何も足しません。
- `close` の後も、すでに入っている値は `take` と `poll` で順に取り出せます。空になった後の `take`、閉じた後の `offer`、閉じたときに待っていた `take` と `offer` は QueueClosed で失敗します。`try_offer` は False を返します。2回目の `close` は何もしません。
- `try_offer`、`poll`、`size`、`close` と、Semaphore の `available` は中断しません。
- Semaphore と Queue は Eq も Show も持ちません。dbg は `<semaphore>`、`<queue>` と表示します。

```emela check
import Std.Fiber.{Fiber}
import Std.Queue.{QueueClosed}

fn main() {
  Fiber.scope(|| {
    q = Fiber.queue(2)
    Fiber.fork(|| {
      List.each([1, 2, 3], |n| q.offer(n))
      q.close()
    })
    fn drain(acc: List[Int]) -> List[Int] {
      Some(q.take()) escape { QueueClosed -> None } match {
        Some(n) -> drain([n, ..acc])
        None    -> List.reverse(acc)
      }
    }
    dbg(drain([]))
  })
  ()
}
```

```console
$ emela run main.emel
[1, 2, 3]
```

### 持ち出しの実行時の検査

能力の値や、能力を抱えた値（能力を捕まえたクロージャやローカルの fn、能力を含むデータ）を、それを供給する with やスコープの外へ出すと、コンパイラは警告 W0402 を出します。実験的な機能 `capture-checking` を有効にすると、警告でなくエラー E0444 になります。エラーが既定でない間は、次の実行時の検査が残ります。

- release 済みのハンドラの操作を呼ぶと defect（`handler PostgresUsers was used after release`）になります。この検査はフィールド、init、release のどれかを持つハンドラにだけ掛かります。
- 終わったスコープの Scope の操作、ハンドルの join、await、interrupt、Deferred の complete、await、poll、Semaphore と Queue のすべての関数は defect になります。文面は `fiber scope was used after it ended`、`fiber was joined after its scope ended`（awaited、interrupted も同じ形）、`deferred was completed after its scope ended`（awaited も同じ形）、`deferred was polled after its scope ended`、`semaphore was used after its scope ended`、`queue was used after its scope ended` です。
- スコープの子でない fiber が、スコープが終わるときにその Semaphore か Queue を待っていたら、同じ defect で待つのをやめます。
- Fiber.scope の値の型のどこかに `Fiber`、`Deferred`、`Semaphore`、`Queue` を含むと、警告でなく常にコンパイルエラー（E0425）です。
- 子より先に終わる with のハンドラを子が使うことは、型の上では起きません（子の使うエフェクトは Fiber.scope の外で供給するため）。例外は、同じエフェクトをスコープの外でも供給していて、本体の中の with で作ったクロージャを子に渡した場合です。その with が先に終われば、実行時の検査で defect になります。

```emela check
effect Log {
  fn info(msg: String) -> ()
}

handler PrintLog: Log {
  init { PrintLog }
  release { () }
  fn info(msg) {
    dbg(msg)
    ()
  }
}

fn main() {
  say = with PrintLog {
    log = use Log
    || log.info("hi")
  }
  say()
}
```

```console
$ emela run main.emel
warning[W0402]: a value that holds `log` leaves the `with` that provides it
    ╭─[ main.emel:17:5 ]
    │
 15 │   say = with PrintLog {
    │              ────┬───
    │                  ╰───── `log` is released at the end of this `with`
    │
 17 │     || log.info("hi")
    │     ────────┬────────
    │             ╰────────── the value of the body holds `log`
────╯

1 warning
defect: handler PrintLog was used after release
```

| 持ち出し方 | 既定 | `capture-checking` を有効にしたとき |
|---|---|---|
| 能力の値（Scope を含む）か、それを抱えた値を with やスコープの外へ出す | 警告 W0402 と実行時の検査（状態を持つハンドラと Scope） | 静的（E0444） |
| 能力を捕まえたクロージャを with やスコープの外へ出す | 警告 W0402 と実行時の検査（状態を持つハンドラと Scope） | 静的（E0444） |
| `Fiber`、`Deferred`、`Semaphore`、`Queue` を型に含む値を Fiber.scope から返す | 静的（E0425） | 静的（E0425） |
| `Fiber`、`Deferred`、`Semaphore`、`Queue` を State に入れる、クロージャで捕まえて外へ出す | 実行時 | 静的 |

## 値とメモリ

- すべての値は不変です。可変な状態は、State のエフェクト、ハンドラが持つホスト側のオブジェクト、Deferred（一度だけ書ける）、Semaphore、Queue に限られます。
- メモリの解放のタイミングは観測できず、規定しません。
- 必要なメモリを得られなかったときの結果は実装が決めます。defect になるか（したがって release が走るか、`Exit.attempt` で Die として観測できるか）、何を出力するか、終了コードも含みます。プログラムはこれらに頼ってはいけません。
- リソースはハンドラの release で後始末します。値の解放に連動するデストラクタは持ちません。

## const の評価

```emela check
const ZERO = 0
const RATIO = 1 / ZERO

fn main() {
  dbg("start")
  dbg(RATIO)
  ()
}
```

```console
$ emela run main.emel
"start"
defect: while evaluating const RATIO: division by zero
$ echo $?
101
```

- 右辺は純粋な式（E と R が空）に限ります。`use` と `fail` は書けません。純粋な関数の呼び出しは書けますが、失敗しうる関数やエフェクトを使う関数は呼べません（E0318、E0402）。
- 右辺は最初に参照したときに1回だけ評価し、その値を覚えておきます。起動時にすべてを評価しないのは、使っていない const の defect でプログラムやほかのテストが動かなくなるのを避けるためです。
- 評価の途中の defect は最初に参照したところで起きます。文面に const の名前を入れます（`while evaluating const X: division by zero`）。
- 評価の途中の defect も覚え、次の参照でも同じ defect を起こします（評価し直しません）。テストの間でも共有されます。
- 入れ子の const の defect は、通った const ごとに名前を前に足します（`while evaluating const A: while evaluating const B: division by zero`）。
- 評価の途中で自分自身を参照すると defect（`const A refers to itself while being evaluated`）になります。自己参照の defect には名前を足さず、どの const にも覚えさせません（最初の参照がどこから来たかで文面が変わらないようにするため）。
- 名前だけで循環している const（`const A = B` と `const B = A`）はコンパイル時に E0231 になります。E0231 は値を評価すると必ず評価する参照だけで循環を見ます。if と match の腕、`&&` と `||` の右辺、ラムダの本体、呼んだ関数の中の参照は数えず、実行時の自己参照の defect に任せます。構造を通る循環（`const P = (Q, 1)` と `const Q = [P]`）は E0231 です。
- 汎化した const（`const EMPTY = []`）も、型が実行時に消えるので、覚える値は1つです。

```emela check
const A = next()

fn next() -> Int { A + 1 }

fn main() {
  dbg(A) # defect: const A refers to itself while being evaluated
  ()
}
```

```emela check
const A: Int = if True { A } else { 0 }

fn main() {
  dbg(A)
  ()
}
```

```console
$ emela run main.emel
defect: const A refers to itself while being evaluated
```

if の腕を通る自己参照は E0231 にならず、実行時に defect になります。

```emela check=error
const A = B + 1
const B = A + 1    # error[E0231]: constants refer to each other
```

## 終了コード

`emela run` の終了コードは次のとおりです。

| 終了コード | 意味 |
|---|---|
| 0 | main が値で終わった（戻り値の型が `ExitCode` のときを除く）。診断が警告だけのときも 0 |
| `ExitCode` の値 | 戻り値の型が `ExitCode` の main が、その値を返した |
| 1 | main までエラーが達した（`error: ...`）。または、コンパイルの診断にエラーがあった |
| 101 | 最上位に defect が達した（`defect: ...`） |
| 130 | main の継続が中断されたまま巻き戻った（`interrupted`） |
| 141 | 閉じた標準出力に書き込んだ。標準エラーには何も出さない |
| 128 + シグナル番号 | シグナルで止まった |

JS のターゲットでは、defect でない例外が起きたときも、JS のホストのスタックの表示を出して 1 で終わります。終了コードは標準エラーへの書き込みが終わってから決めます。

`emela test` は、1つでも失敗すれば 1、なければ 0（テストが0個でも 0）で終わります。診断にエラーがあれば 1 です。テストの途中でプログラムが終了したときは、実行中のテストを失敗にします。コマンドの詳細は [CLI](/tools/cli/) にあります。
