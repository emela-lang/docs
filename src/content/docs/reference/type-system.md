---
title: 型と効果の体系
description: T・E・R の判定、関数型の節の省略、宣言での推論と汎化、型付け規則、E の包含、Immediate
---

Emela のすべての式は、値の型 T、エラーの集合 E、効果の集合 R の3つ組を持ちます。T は Hindley-Milner 方式で推論し、E と R は集合の和と差で求めます。

使い方の説明は [エラー](/guide/errors/) と [エフェクト](/guide/effects/) にあります。このページは、型検査器が従う規則をまとめたものです。

## 判定の形

```
Γ ⊢ e : T ! E ; R
```

- T は値の型です。
- E はエラーのタグの集合です。空なら失敗しません。
- R はエフェクトの集合です。空なら環境に依存しません。
- E と R がともに空の関数を、純粋な関数と呼びます。

E と R は普段ソースに現れず、LSP が表示します。

## 関数型

```
fn(A, B) -> C fails E use R
```

引数の位置に書く関数型では、節の省略は「何でもよく、呼び出し元に伝わる」を意味します。

| 書き方 | 受け取れる関数 |
|---|---|
| `fn(A) -> B` | どんなエラーと効果を持っていてもよい。それらは、受け取った関数を呼ぶ側の E と R に加わる |
| `fn(A) -> B fails {}` | 失敗しない関数だけ |
| `fn(A) -> B use {}` | 効果を持たない関数だけ |
| `fn(A) -> B fails {} use {}` | 純粋な関数だけ |
| `fn(A) -> B use R`（R は型引数） | 効果に名前を付け、制約を掛けられる（下の「効果への制約」） |

この規則により、`List.map(xs, f)` は f のエラーと効果をそのまま引き継ぎます。純粋版と効果版を2つ用意する必要はありません。

```emela check=error
error Bad

fn apply(f: fn(Int) -> Int fails {}) -> Int { f(1) }

fn main() {
  apply(fn(x) { fail Bad })    # error[E0321]: fails {} の位置に失敗する関数
}
```

### 節を省略したときの意味

関数型の節を省略したときの意味は、書いた位置で決まります。

| 位置 | 省略したときの意味 |
|---|---|
| 引数の型の中（どの深さでも。`f: fn(A) -> B`、`fs: List[fn(A) -> B]`） | 何でもよい。省略した節ごとに、見えない集合変数を置く。そのエラーと効果は、関数を呼んだ側に加わる |
| 戻り値の型、束縛の型注釈、無名関数の引数の型注釈 | 本体から推論する。引数の見えない集合変数を参照してよい（無名関数は汎化しないので、見えない集合変数を置けない） |
| 宣言の中（type・enum・error・handler のフィールド、エフェクトの操作、Trait の関数、const） | 空。失敗せず、効果を持たない関数だけ |

宣言の中で効果のある関数を持つときは、型引数で明示します。

```emela check
type Request(path: String)
type Response(body: String)

type Handler[E, R](run: fn(Request) -> Response fails E use R)

fn compose[A, B, C](f: fn(A) -> B, g: fn(B) -> C) -> fn(A) -> C {
  fn(x) { g(f(x)) }      # 戻り値の関数は f と g のエラーと効果を持つと推論される
}

fn main() {
  inc = compose(fn(x: Int) { x + 1 }, fn(x: Int) { x * 2 })
  dbg(inc(3))
}
```

- 宣言の中を空にするのは、型の名前に現れない集合変数を作らないためです。`Handler` が効果を持ちうることは、`Handler[E, R]` と型引数に現れます。
- 型引数がふつうの型か、エラーの集合か、効果の集合かは、使われた位置（`fails E`、`use R`）から推論します。種を書く構文は持ちません。

### 集合の型引数

名前付き型の集合の型引数には、集合を渡せます。書き方は fails 節（`A | B`）と use 節（`{ A, B }`）にそろえます。

```emela check
error NotFound(id: Int)
error Timeout

effect Db {
  fn query(sql: String) -> String
}

effect Log {
  fn info(msg: String) -> ()
}

type Request(path: String)
type Response(body: String)

type Handler[E, R](run: fn(Request) -> Response fails E use R)

fn serve(h: Handler[NotFound | Timeout, { Db, Log }], req: Request) -> Response
  fails NotFound | Timeout
  use { Db, Log } {
  h.run(req)
}

fn only_db(h: Handler[NotFound, Db], req: Request) -> Response fails NotFound use Db {
  h.run(req)
}

fn echo() -> Handler[{}, {}] {
  Handler(run: fn(req) { Response(body: req.path) })
}
```

- `Handler[NotFound | Timeout, { Db, Log }]`、`Handler[{}, {}]`、`Handler[E | Timeout, { R, Log }]` のように書きます。
- 要素が1つなら囲まずに書けます（`Handler[NotFound, Db]`）。構文の上では型として読みます。
- 空の `{}` はエラーの集合の位置にも書けます（`fails {}` と同じ）。
- どの型引数が集合を受けるかは文法では決めず、型検査で確かめます。違う種類の集合や集合でない要素は E0323、集合でない型引数の位置の集合（`List[{}]`）は E0324 になります。

```emela check=error
type Handler[E, R](run: fn() -> Int fails E use R)

fn bad(h: Handler[Int, {}]) -> Int { 1 }    # error[E0323]: E はエラーの集合
```

## 宣言での注釈と推論

| 部分 | 省略したとき | 書いたとき |
|---|---|---|
| 戻り値の型 | T と E を推論する | T を検査し、E は fails 節のとおりであることを強制する |
| fails 節 | 戻り値の型があれば「エラーなし」 | ちょうどその集合であることを強制する |
| use 節 | 常に R を推論する（戻り値の型を書いていても） | ちょうどその集合であることを強制する。引数の関数を呼んだときの効果（見えない集合変数）は足される |

関数の宣言の戻り値の書き方は、エラーについて次の意味を持ちます。

| 書き方 | 意味 |
|---|---|
| 戻り値の型を省略 | E を推論する。エラーはそのまま伝わる |
| `-> T` | エラーなしを強制する。本体に未処理のエラーがあればエラー（E0318） |
| `-> T fails NotFound` | エラーがちょうどこの集合であることを強制する |

- 複数のエラーは、縦棒で区切って並べます。エラーのタグと、エラーの集合を表す型引数を混ぜて構いません（`fails Timeout | E`）。
- `Timeout | E` は、タグ Timeout と集合変数 E の和です。引数の関数型にこう書くと、渡された関数のエラーのうち Timeout 以外が E になります。Timeout を起こさない関数を渡しても構いません。
- 戻り値の型を書いた関数の E は、書いた fails 節に、引数の関数を呼んだときのエラー（引数の関数型の見えない集合変数）を足したものです。見えない集合変数は書けないので、`-> T` でも引数の関数のエラーは伝わります。
- 引数の関数が受け取る関数（`f: fn(fn() -> A) -> B` の内側）の見えない集合変数は、本体から見ると中身が分からないので、そこへ失敗する関数を渡すとエラーになります。

```emela check
fn twice(f: fn() -> Int) -> Int { f() + f() }   # E は f のエラー。-> Int でもエラーにならない

fn main() {
  dbg(twice(fn() { 21 }))
}
```

### まとまりごとの推論と汎化

型を推論する定義は、互いに参照し合うまとまりごとに、参照される側から推論します。型を推論する定義とは、次のものです。

- 戻り値の型を書いていない fn
- 戻り値の型の中に節を省いた関数型がある fn
- use 節のない fn
- 型を書いていない const

規則:

- まとまりの中では単相の型で参照し、まとまりを推論し終えてから汎化します。まとまりの中で同じ定義を別の型に使うと型が合いません（多相再帰は持ちません）。
- use 節のない fn は、T と E が宣言のとおりで、R についてだけこの規則に従います。
- 汎化するとき、引数の関数型の E と R にあって下界も上界もない集合変数は、集合の型引数として量化します。`fn caller() { fn(g) { g() } }` は `∀ A, E. fn() -> fn(fn() -> A fails E) -> A fails E` です。
- それ以外の集合変数は、制約を満たす最小の集合に決めます。
- 型引数が値の型（`err: E`）とエラーの集合（`fails E`）の両方に使われたとき、その型引数は1つのエラーの型として推論します。`fn raise(err) { fail err }` の型は `∀ E, A. fn(E) -> A fails E` です。エラーでない型を `fail` に渡したとき、また1つのエラーの型の型引数をエラーでない型で具体化したときは E0319 です。

```emela check
error NotFound(id: Int)

fn or_fail[A, E](opt: Option[A], err: E) -> A fails E {
  opt match {
    Some(a) -> a
    None -> fail err
  }
}

fn find(id: Int) -> Int fails NotFound {
  or_fail(None, NotFound(id:))      # E = NotFound
}
```

### 型の表示

LSP と診断は、型を次の形で表示します。

- 汎化した型引数は現れた順に `A`、`B`、…、`Z`、その後は `T26`、`T27`、… と名付けます。制約は `∀ A: Ord + Show, B. T` の形で量化子に書きます。
- 汎化した集合の型引数は `E`、`E1`、…（エラー）、`R`、`R1`、…（効果）と名付け、ふつうの型引数の後ろに並べます。
- 引数の型の中の見えない集合は、引数の名前から `E(f)`、`R(f)` と表示します。同じ引数の2つ目以降は `E(f, 2)` です。
- 空の E と R は省きます。ただし関数型の引数の型の中では、省くと「何でもよい」と読めるので `fails {}`、`use {}` と書きます。
- 効果の集合は、要素が1つならそのまま、2つ以上なら `{ A, B }`、空なら `{}` と書きます。エフェクトを先、集合の型引数を後に並べます。
- `fails` 節の後に `use` 節を書きます。
- 外側に節のある関数型の戻り値が関数型なら、戻り値を括弧で囲みます。
- 能力の値の型は `use Logger` と表示します。
- 型の食い違いの診断には、まだ決まっていない集合変数を出しません。

```emela check=error
fn now_only[R: Immediate](f: fn() -> () use R) -> () use R { f() }

fn pass(g: fn() -> ()) {
  now_only(g)    # error[E0416]: effect set `R(g)` may suspend ...
}
```

## 型付け規則

各式の T、E、R は次のとおり決まります。部分式の E と R は、特記がないかぎり親の式に合流します。

| 式 | T | E | R |
|---|---|---|---|
| リテラル、変数、const | その型 | {} | {} |
| `[e1, ..., en]` / `[e1, ..., en, ..r]` | `List[T]`（各 ei が T、r が `List[T]`） | E1 ∪ … ∪ En ∪ Er | R1 ∪ … ∪ Rn ∪ Rr |
| `f(a)` | f の戻り値の型 | Ef ∪ Ea | Rf ∪ Ra |
| `C(fi: ei, ..r)` | C の型（型引数は ei と r の引き継ぐフィールドから決まる） | Ei ∪ Er | Ri ∪ Rr |
| `fail e` | Never | { e のタグ } | {} |
| `e escape { Ti -> ei }` | e の型と各腕の型の共通の型（Never は合流で消える） | (Ee ∖ {Ti}) ∪ Eei（Ti は腕が値をすべて受けるタグ。集合変数からは消さない） | Re ∪ Rei |
| `use X` | X の能力 | {} | { X } |
| `with H { e }` | e の型 | Ee ∪ (init の E) | (Re ∖ 供給(H)) ∪ 依存(H) |
| `fn(x) { e }` | `fn(..) -> T fails Ee use Re` | {} | {} |
| `if c { a } else { b }` | a と b の共通の型 | Ec ∪ Ea ∪ Eb | Rc ∪ Ra ∪ Rb |
| `e match { pi -> ei }` | 腕の共通の型 | Ee ∪ Eei | Re ∪ Rei |

補足:

- 無名関数は、本体の E と R を関数型の中に閉じ込めます。それらが表に出るのは、関数を呼んだときです。
- Never は、どの型とも共通の型を作れます。if や match の一方の分岐が fail でも、全体の型はもう一方の型になります。
- Never が他の型として扱われるのは、分岐の合流と、期待される型の位置に置かれたときの最上位だけです。`List[Never]` と `List[Int]` は一致しません。
- フィールドの参照 `x.name` は、検査がそこに達した時点で x の型が名前付きの型に決まっていなければなりません。決まっていなければ E0314 です。フィールドの名前から型を逆算することはしません（行多相は持ちません）。
- 呼び出しの引数は仮引数の順に検査します。期待する型がある位置（引数、戻り値の型、束縛の型注釈）では、その型をブロックの最後の式、if と match の各分岐、リストの要素、無名関数の引数と本体へ先に渡します。`List.map(users, fn(u) { u.name })` では、u の型は先に検査した users から決まります。
- 供給(H) は H が実装するエフェクト、依存(H) は H の init と操作が要求するエフェクトです。ラベルの項目（`L`、`L by P`）の供給と依存、`default` のラベルの供給は [ラベル](/guide/labels/) にあります。

```emela check
type User(name: String)

fn names(users: List[User]) -> List[String] {
  List.map(users, fn(u) { u.name })    # u の型は users から決まる
}

fn main() {
  dbg(names([User(name: "alice")]))
}
```

```emela check=error
type User(name: String)

fn main() {
  get = fn(u) { u.name }    # error[E0314]: u の型が決まっていない
  dbg(get(User(name: "a")))
}
```

### E の包含

部分型は持ちませんが、E にだけ包含があります。

- 関数の値の E は、期待される関数型の E に含まれれば十分です。E の小さい関数を E の大きい関数として使えます。
- 分岐の合流やリストの要素で E の違う関数を並べると、E はそれらの和になります。
- 包含の向きは、関数型の引数の中で逆になり、名前付きの型の型引数の中では両方向（一致）になります。
- E はタグと集合変数の和で表します。`∖ {Ti}` はタグの部分だけに作用し、集合変数はそのまま残します。集合変数が後で具体的な集合に決まっても、遡って消すことはしません（安全側に倒した近似です）。

```emela check
error Timeout
error Refused

fn run(f: fn() -> Int fails Timeout | Refused) -> Int fails Timeout | Refused { f() }

fn main() {
  n = run(fn() { 1 }) escape {
    Timeout -> 0
    Refused -> 0
  }
  dbg(n)
}
```

## escape と with が集合変数から消さないこと

escape はエラーを、with はエフェクトを集合から取り除きます。ただし、中身の分からない集合変数からは何も消しません。

### escape

- 腕で受けたタグは E から消えます。受けていないタグは、そのまま伝わります。
- タグが消えるのは、そのエラーのガードのない腕を合わせて、そのエラーの値をすべて受けるとき（`NotFound(_)`。`Flag(on: True)` と `Flag(on: False)` の2本でもよい）だけです。一部の値しか受けない腕（`NotFound(id: 1)`、ガード付きの腕）だけなら、タグは E に残ります。
- 腕の中で起きたエラーは E に加わります。
- 腕の結果は、元の式と同じ型か、Never でなければなりません。元の式の型が Never のときは、腕の共通の型が全体の型になります。
- 元の式から起きないエラーを受ける腕は警告になります（W0302）。元の式の E に中身の分からない集合変数がないときだけ確かめます。
- 式の E に中身の分からない集合変数が含まれるとき、escape はその変数から何も消しません。中身の分からない集合変数とは、集合の型引数 `E`、引数の関数型の見えない集合変数、1つのエラーの型の型引数、汎化する定義の集合変数です。同じ関数の中で推論中の集合（局所の関数の E など）からは、正確に消えます。
- 腕は実行時にはそのタグを受けますが、型の上では変数が残ります。型の上でも正確に消したいときは、受けたいタグを関数型に書き出します（`fails Timeout | E`）。書き出したタグは集合変数の外にあるので、escape で消えます。

```emela check=error
error Timeout

# f の E は見えない集合変数。escape しても型は変数のまま（Timeout が残りうる）
fn retry[A](f: fn() -> A) -> A {
  f() escape { Timeout -> f() }
}

fn flaky() -> Int {
  retry(fn() { fail Timeout })    # error[E0318]: unhandled error `Timeout`
}
```

```emela check
error Timeout

# Timeout を書き出すと、1回目の呼び出しの Timeout は型からも消える
fn retry[A, E](f: fn() -> A fails Timeout | E) -> A fails Timeout | E {
  f() escape { Timeout -> f() }    # escape の E は E、2回目の f() で Timeout | E
}
```

呼ぶ側では集合が決まるので、日常のコードの escape はいつも正確です。差が出るのは、関数を受け取る汎用の関数の中だけです。

### with

- 供給したエフェクトは、本体の R から消えます。ただし escape と同じく、中身の分からない効果の集合（引数の関数型の見えない集合など）からは消しません。
- 型の上でも正確に消したいときは、供給するエフェクトを関数型に書き出します（`use { Logger, R }`）。書き出したエフェクトは集合変数の外にあるので、with で消えます。

```emela check=error
effect Log {
  fn info(msg: String) -> ()
}

handler QuietLog implements Log {
  fn info(msg) { () }
}

fn run(f: fn() -> ()) {
  with QuietLog { f() }       # R は f の効果の集合のまま
}

fn caller() -> () use {} {
  run(fn() { (use Log).info("x") })    # error[E0402]: Log が残る
}
```

```emela check
effect Log {
  fn info(msg: String) -> ()
}

handler QuietLog implements Log {
  fn info(msg) { () }
}

fn run[R](f: fn() -> () use { Log, R }) -> () use R {
  with QuietLog { f() }       # R は R だけ。Log は消える
}

fn main() {
  run(fn() { (use Log).info("x") })
}
```

### 能力の値の型

- `use X` を含む関数の R には X が載ります。分岐の中に書いても、関数全体の R に載ります。
- 能力の値の操作を呼ぶと、R にそのエフェクトが載り、E に操作の `fails` が載ります。能力の値を捕まえたクロージャの型にもそのエフェクトが載ります。
- 能力の値の操作を呼ばずに `log.info` と書くと関数の値になります。能力の値はその位置で評価され、関数の値の型には能力のエフェクトが載ります。
- 能力の値の型はソースに書けません。能力の値を引数に渡す（E0408）、データ構造に入れる（E0409）、関数から返す（E0410）はどれもエラーです。値の最上位の型だけを見ます。
- R の中で同じエフェクトかどうかは、型引数まで比べます。`State[Int]` と `State[String]` は別のエフェクトです。型引数がまだ決まっていなければ単一化して比べます。R に残った型変数は汎化します（`fn peek() { modify(fn(x) { x }) }` は `∀ A. fn() -> A use State[A]`）。

## 効果への制約

効果の集合は型引数として書けて、Trait と同じ構文で制約を掛けられます。

```emela
@external(js, "./dom.mjs", "onClick")
fn on_click[R: Immediate](id: String, handler: fn() -> () use R) -> ()
```

Immediate は「中断せず、呼んだその場で完了する」ことを表す組み込みの制約です。コンパイラが宣言から自動で判定し、実装を書くことはありません。

- エフェクトが Immediate であるのは、suspend fn を1つも持たず、Async でもないときです。
- 効果の集合が Immediate であるのは、要素がすべて Immediate のときです。空集合は Immediate です。

中断されると困る場所（外部関数に渡すコールバックなど）だけがこの制約を要求します。呼び出し側に印を付ける代わりに、型検査で禁止します。

```emela check=error
effect Ticker {
  suspend fn tick() -> ()
}

fn now_only[R: Immediate](f: fn() -> () use R) -> () use R { f() }

fn bad() -> () use Ticker {
  now_only(fn() { (use Ticker).tick() })    # error[E0416]: Ticker は中断しうる
}
```

規則:

- `R: Immediate` の制約は、その定義（fn か構成子）を参照したところで、具体化した集合について確かめます（E0416）。型の注釈（`Ticker[Clock]`）では確かめません。値は構成子からしか作れないためです。
- 効果の集合でない型引数に Immediate を付けるとエラーです（E0322）。
- 引数の型の中の見えない効果の集合は Immediate の制約を持たないので、`R: Immediate` の引数には渡せません。制約が要るときは、名前を付けた型引数に `: Immediate` を書きます。
- 外部関数の引数の型の中の見えない効果の集合は、Immediate の制約を持ちます。外部関数の宣言の引数の関数型に書いた use 節は、Immediate でなければエラーになります。
- 型を推論する定義で、Immediate を要求する位置に渡した集合変数を汎化するときは、その型引数に Immediate の制約を付けます。
- エフェクトが Immediate かどうかは宣言だけで決まり、ハンドラには左右されません。型引数にも左右されません。ラベルが Immediate かどうかは元のエフェクトで決まります。
- fn の操作の実装は、本体の R が Immediate か、中断しうる呼び出しを含まないかのどちらかを満たさなければなりません（E0417）。そのため fn の操作の呼び出しはどのハンドラに当たっても中断せず、Immediate なエフェクトの操作が中断することはありません。

```emela check
effect Log {
  fn info(msg: String) -> ()
}

fn now_only[R: Immediate](f: fn() -> () use R) -> () use R { f() }

fn ok() -> () use Log {
  now_only(fn() { (use Log).info("x") })    # Log は Immediate
}
```

## 持たないもの

部分型（E の包含を除く）、一般の union 型と intersection 型、高カインド型、null、暗黙の型変換、動的型は持ちません。エラーの集合は、言語の中で union が現れる唯一の場所です。値として扱えるのは1つのエラーの型だけで、「NotFound か DbError のどちらか」という値の型は作れません。
