---
title: 実行時の意味
description: 評価順序、with の実行、エラーと defect の伝播、main の終わり方、中断と再開、task、const の評価、終了コード
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
    config <- Config
    dbg("init NamedLog #{config.name()}")
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
  log <- Log
  with NamedLog, FixedConfig {
    log.info("body")
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
- ハンドラの操作の本体で使うエフェクトは、その with の外側のハンドラか、同じ with で先に初期化された名前のない項目のハンドラが供給します。
- 名前を付けた項目（`x = H`）はエフェクトを名前では供給しません。上書きされることもないので、必ず初期化します。
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
    config <- Config
    fail ConnectFailed(reason: config.url())
  }
  release {
    dbg("release FailingDb")
  }
  fn query(sql) { sql }
}

fn main() {
  db <- Db
  with FixedConfig, FailingDb {
    dbg(db.query("select 1"))
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
- main の戻り値の型は `()` か `ExitCode` にします。どちらでもなく Never でもない型は警告 W3001 になります。そのときも実行はでき、値は捨てます。
- `ExitCode` で 1、101、130 も選べます。そのときは終了コードだけではエラー、defect、中断と区別できず、区別できるのは標準エラーに出る行だけです。
- main まで達したエラーは、プログラムの異常終了になります。標準エラーに `error: <エラーの値の表示>` を1行出し、終了コード 1 で終わります。エラーの型が Show を満たすときは inspect と同じ表示です（`error DbError(message: String) derive Show` なら `error: DbError(message: "down")`）。満たさないときは、エラーの名前だけを表示します（`error: Retry`）。main の E に Show は要りません。
- main の E は空でなくてかまいません。
- main の R は、main に与えられるホストのエフェクト（Async と ProcessHost）を除いて空でなければなりません（E4301）。main に uses 節を書いていても同じです。

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

release はエラーで終われません（E が空。E4007）。release の中で defect が起きたときは次のとおりにします。

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
  log <- Log
  with NoisyLog {
    log.info("body")
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
3. 操作の本体の中でその場で resume した場合、呼び出し元は中断せずに続きを実行する。resume の後に操作の本体の残りがあれば、それを先に実行し終えてから呼び出し元が続く。resume の後の残りは中断しない（resume の後に中断しうる呼び出しを書くと E4305）。
4. 後から resume した場合、その resume の呼び出しの中で呼び出し元が再開し、呼び出し元が次に中断するか終わったところで resume が戻る（値は `()`）。操作の本体の残りは、その後に中断せずに最後まで実行する。

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
  wait <- Wait
  with After {
    n = wait.wait()
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
- resume が一度も呼ばれないまま捨てられた場合、その継続は中断されたものとして巻き戻ります。巻き戻るのは、その task を待っているもの（`Task.Group`、`Task.Background`、プログラムの最上位）が終わるときです。継続が捨てられた瞬間を検出することは求めません。
- main の継続が中断されたまま巻き戻ったときは、標準エラーに `interrupted` を1行出し、終了コード 130 で終わります。テスト関数の継続が中断されたときは、そのテストの `interrupted` の失敗として報告し、残りのテストを続けます。
- 中断されたまま巻き戻るときも、途中の with の release を内側から実行します。
- native のターゲットで、走れる fiber も、待ちの登録（タイマーやファイル記述子）も、届いていない完了もなくなったときは、すべての fiber を中断し、待っている継続を巻き戻し、ホストの待ちを取り消します（[ターゲット](/reference/targets/)）。

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
  wait <- Wait
  with Dropping {
    n = wait.wait()
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

- 他の fiber への切り替えと、中断の到達が起きるのは中断点だけです。
- 別の fiber から呼ばれた resume（resume を値として受け渡したとき）は待ち行列に入れ、呼んだ側の一息の区間に割り込ませません。ホストのコールバックと同じ fiber からの resume は、手順3と4のとおりその場で続けます。
- イベントループが空になったときは、すべての fiber を中断し、待っている継続すべてを巻き戻します。release の実行中でも打ち切ります。Task.Group と Task.Background の release だけは task の巻き戻りを待ちます。

## task に関わる規則

task の使い方は [並行処理](/guide/concurrency/) にあります。ここでは実行時の規則だけを並べます。

### 切り替え

- task は fiber の上で走ります。fiber は1つのスレッドの上で協調的に切り替わる軽量な実行単位です。並列ではありません。
- 切り替えが起きるのは中断点だけです。中断点とは、Async を要求する suspend な操作の呼び出しと、ランタイムが公平性のために挟む譲渡です。
- 譲渡は中断しうる呼び出しの位置にだけ挟みます。ランタイムは中断しうる呼び出しの回数を数え、一定の回数ごとに他の fiber とホストのコールバックに譲ります。時間でなく回数で数えるので、切り替えの順序は実行のたびに同じになります。回数は規定しません。
- 中断しうる呼び出しを挟まない区間は一息に実行されます。`st.set(st.get() + 1)` は一息ですが、`x = st.get(); helper(); st.set(x + 1)` は `helper` の R が Immediate でなければ割り込まれえます。
- Immediate な関数は他の task から見て一息に実行されます。譲渡も挟みません。
- `start` は中断点ではありません。task は待ち行列に入り、始めた task が次に中断したときに走り始めます。走り始める前に中断された task は、渡した関数を呼ばずに終わります。

### Task.Group の終わり方

- Task.Group の task は、その with を抜けるまでに必ず終わります。本体が値で終わった時点で残っている task は中断され、release はすべての task の巻き戻り（release を含む）が終わるまで待ちます。with の値は本体の値です。
- task が失敗（Fail か Die）で終わると、兄弟の task は中断され、失敗は本体の次の中断点で本体に届きます。本体はそこでその原因で失敗して巻き戻り、すべての task が巻き戻った後に with がその失敗で終わります。2つ以上の task が失敗したときは、先に失敗したものを結果にし、後の失敗は注記（`note: another task also failed: <原因>`）に足します。
- 本体が外からの中断で巻き戻る途中に task が defect で終われば、その defect が結果になります。
- グループは本体が終わったときか、task が失敗したときに閉じます。閉じたグループの `start` は defect（`task group was used after it closed`）です。task の失敗による巻き戻りの途中なら注記に回ります。
- 名前を付けたグループの task は、グループの能力（`tasks.start(...)`）を通して兄弟を始められます。入れ子のグループでは、外側の能力に start した task は外側のグループが終わるまで走り、内側の task は内側のグループと一緒に終わります。
- task の R は、グループの with の外（囲む with と、同じ with でグループより前に書いた項目）が供給します。本体の中の with や、グループより後に書いた項目が作る能力は task から使えません。
- 誰も値を入れない Deferred を待つ task は、グループの終わりで中断されます。
- with より長く生きる task はありません。長く走る処理は、それに頼る処理を囲む with のグループかバックグラウンドで始めます。

```emela check
import Std.Console.{Console, SystemConsole}
import Std.Clock.{Clock, SystemClock}
import Std.Task.{Task}

fn main() {
  console <- Console
  clock <- Clock
  with SystemConsole, SystemClock {
    with outer = Task.Group {
      with inner = Task.Group {
        outer.start(|| {
          clock.sleep(100)
          console.print_line("outer task")
        })
        inner.start(|| {
          clock.sleep(100)
          console.print_line("inner task")
        })
        clock.sleep(10)
      }
      console.print_line("inner group ended")
      clock.sleep(200)
    }
  }
}
```

```console
$ emela run main.emel
inner group ended
outer task
```

### Task.Background の終わり方

- バックグラウンドは閉じません。本体の実行中、task の失敗の後、本体が終わって release が待っている間のどれでも `start` できます。`start` が defect になることはありません。
- release は、待っている間に始めたものも含めて、すべての task が終わるまで待ちます。本体が値で終わっても失敗で終わっても task を中断しません。with の値か失敗は本体のものです。
- with が外から中断されたときは、task も中断します。release の待ちの間に届いた中断は、release のあいだ待たせたうえで task に渡し、task が巻き戻った後に release が終わります。外から中断された後に始めた task は、走り始める前に中断されます。
- task が失敗で終わっても、兄弟と本体は止まりません。`on_failure` がその原因を受けて、その task の中で、task が巻き戻った後に呼ばれます。release は `on_failure` も待ちます。with が外から中断されて中断された task には呼びません。
- `on_failure` の E は空です。`on_failure` の defect は release の defect と同じく扱います。

### 中断

- Task.Group の task が中断されるのは、グループの本体が終わったときと、同じグループの兄弟が失敗したときの2通りです。Task.Background の task は、その with が外から中断されたときだけ中断されます。task を中断する関数はありません。1つの task だけを止めるときは、専用のグループで始めてそのグループの with を終えるか、Deferred で止める合図を渡します。
- 中断は対象の task が次の中断点に達したときに効果を持ちます。
- 中断された task はその地点から巻き戻ります。途中の with について、ハンドラの release が内側から順に実行されます。
- release の実行中は中断されません。中断は、実行中の release が終わった後に効きます。
- 届いた中断は受け止める枠（グループかバックグラウンドの release か、プログラムの最上位）に達するまで巻き戻りとして続きます。途中で内側のグループの失敗を escape が受けるなどして普通の処理に戻っても、次の中断点でもう一度中断します。
- 閉じた標準出力への書き込みも、書いた fiber をその場から中断として巻き戻し、ほかのすべての fiber を中断します。main の巻き戻りが終わると、標準エラーに何も出さずに終了コード 141 で終わります。閉じた標準エラーへの書き込みは捨てて、プログラムは続きます。

```emela check
import Std.Clock.{Clock, SystemClock}
import Std.Task.{Task}

effect Log {
  fn info(msg: String) -> ()
}

handler Noisy: Log {
  release { dbg("release Noisy") }
  fn info(msg) { () }
}

fn main() {
  clock <- Clock
  with SystemClock {
    with tasks = Task.Group {
      tasks.start(|| {
        with Noisy { clock.sleep(1000) }
      })
      clock.sleep(10)
      dbg("body ends")
    }
  }
  ()
}
```

```console
$ emela run main.emel
"body ends"
"release Noisy"
```

本体が終わると、眠っている task が中断され、その中の with の release が走ります。

### 失敗の原因

計算が失敗したときの原因は次の2種類で、受ける側はこの区別を観測できます。中断は原因ではなく、値として受け取ることはありません。

| 原因 | 発生源 | 型に現れるか |
|---|---|---|
| Fail | fail | 現れる（E） |
| Die | defect | 現れない |

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

- task の値を受け取るのは `join` だけです。待つのは join を呼んだ task だけで、ほかの task はその間も進みます。終わった task の値は覚えておき、2回目からはすぐ返します。
- task の Fail と Die はグループに届き、task が中断されるのはグループ全体が巻き戻るときだけなので、呼んだ task が巻き戻っていなければ join は値を返します。release が中断を待たせている間に、失敗したか中断された task を join すると、呼んだ task を中断として巻き戻します（join の型に E がないため）。
- `Exit.attempt` はその場で f を実行し、Fail と Die を値に変えます。task は始めません。defect を値に変えられる境界です。
- attempt は自分の task への中断を受けません。受けると、中断を握りつぶして走り続ける task が書けてしまうためです。巻き戻りの途中の attempt は Die も受けません（release の defect を結果に残すため）。
- task のエラーをグループに届けたくないときは、task の中で attempt に包むか、バックグラウンドで始めます。

```emela check
import Std.Task.{Task}
import Std.Cause
import Std.Exit.{Exit, Success, Failure}

error Boom

fn main() {
  r = Exit.attempt(|| {
    with tasks = Task.Group {
      a = tasks.start(|| 1)
      b = tasks.start(|| {
        if True { fail Boom }
        2
      })
      a.join() + b.join()
    }
  })
  r match {
    Success(n)     -> dbg("#{n}")
    Failure(cause) -> dbg(Cause.to_string(cause)) # "error: Boom"
  }
  ()
}
```

### Deferred、Semaphore、Queue

Deferred、Semaphore、Queue は可変な入れ物で、それぞれ同じ名前の組み込みのハンドラを with の項目に書いて作ります（`with d = Deferred`、`with s = Semaphore(permits: 10)`、`with q = Queue(capacity: 100)`）。項目の名前がその能力です。release は何もしません（Semaphore の許可は Permits の項目の release が返します）。

- `Semaphore(permits: p)` の p が 1 未満なら defect です。`Queue(capacity: c)` の c も同じです。
- `x = s.Permits(n: n)` は n 個の許可が空くまで待って取り、x の release が許可を返します。release は本体がどう終わっても（値、エラー、defect、中断）走り、本体の中の with の release の後に走ります。本体にグループかバックグラウンドの with があれば、その task がすべて終わった後です。`with_permits(s, n, f)` はこの項目を開いて f を実行します。
- `n` が 1 未満のとき、また s を作ったときの許可の数より多いときは defect です。
- 許可を待つ task は待ち始めた順に受け取ります。先頭の task が待っている間は、少ない許可で足りる後ろの task も取りません。許可を返すことは中断点ではありません。受け取った task は、返した task の次の中断点以降に再開します。
- 許可は開くごとに数えます。Permits の本体の中で同じ Semaphore の Permits を開くと、さらに許可を取ります。どの task も進めなくなったときは、resume されない継続と同じく task を中断します。
- `x = s.TryPermits(n: n)` は、許可が空いていて s を待つ task がいなければ取り、そうでなければ init が NoPermits で失敗します。中断しません。`try_with_permits` はこれを使い、取れなければ f を実行せずに `None` を返します。
- Queue の `offer` は満杯の間、`take` は空の間待ちます。待つ task は offer 側と take 側それぞれで待ち始めた順に扱い、値は offer を始めた順に出てきます。
- 待っている間に中断された task は列から抜けます。中断された offer は何も足しません。
- `close` の後も、すでに入っている値は `take` と `poll` で順に取り出せます。空になった後の `take`、閉じた後の `offer`、閉じたときに待っていた `take` と `offer` は QueueClosed で失敗します。`try_offer` は False を返します。2回目の `close` は何もしません。
- Deferred の `complete` と `poll`、Queue の `try_offer`、`poll`、`size`、`close`、Semaphore の `available` は中断しません。
- dbg はこれらの能力を `<deferred>`、`<semaphore>`、`<queue>` と表示します。

```emela check
import Std.Task.{Task}
import Std.Queue.{Queue, QueueClosed}

fn main() {
  with q = Queue(capacity: 2), tasks = Task.Group {
    tasks.start(|| {
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
  }
  ()
}
```

```console
$ emela run main.emel
[1, 2, 3]
```

### 持ち出し

能力と、型や R に能力を含む値は、その能力を作った with の外へ出られません。これは型検査で止めます（E4405、[型と効果の体系](/reference/type-system/#能力が-with-から漏れないこと)）。0.28 までの capture set の警告と、release 済みのハンドラを使ったときの実行時の検査はなくなりました。Task は TaskGroup の能力に縛られた型なので、グループの with の外へ出られません。

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

- 右辺は純粋な式（E と R が空）に限ります。`use` と `fail` は書けません。純粋な関数の呼び出しは書けますが、失敗しうる関数やエフェクトを使う関数は呼べません（E3201、E4301）。
- 右辺は最初に参照したときに1回だけ評価し、その値を覚えておきます。起動時にすべてを評価しないのは、使っていない const の defect でプログラムやほかのテストが動かなくなるのを避けるためです。
- 評価の途中の defect は最初に参照したところで起きます。文面に const の名前を入れます（`while evaluating const X: division by zero`）。
- 評価の途中の defect も覚え、次の参照でも同じ defect を起こします（評価し直しません）。テストの間でも共有されます。
- 入れ子の const の defect は、通った const ごとに名前を前に足します（`while evaluating const A: while evaluating const B: division by zero`）。
- 評価の途中で自分自身を参照すると defect（`const A refers to itself while being evaluated`）になります。自己参照の defect には名前を足さず、どの const にも覚えさせません（最初の参照がどこから来たかで文面が変わらないようにするため）。
- 名前だけで循環している const（`const A = B` と `const B = A`）はコンパイル時に E2113 になります。E2113 は値を評価すると必ず評価する参照だけで循環を見ます。if と match の腕、`&&` と `||` の右辺、ラムダの本体、呼んだ関数の中の参照は数えず、実行時の自己参照の defect に任せます。構造を通る循環（`const P = (Q, 1)` と `const Q = [P]`）は E2113 です。
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

if の腕を通る自己参照は E2113 にならず、実行時に defect になります。

```emela check=error
const A = B + 1
const B = A + 1    # error[E2113]: constants refer to each other
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
