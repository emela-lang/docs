---
title: 型と効果の体系
description: T・E・R の判定、関数型の節の省略、宣言での推論と汎化、型付け規則、網羅性、E の包含、能力の型、Immediate、ハンドラ、ラベル、Trait と導出
---

:::note[規範は仕様]
このページは仕様の [型](https://github.com/emela-lang/emela/blob/main/spec/language/09-types.md)、[関数](https://github.com/emela-lang/emela/blob/main/spec/language/06-functions.md)、[エラー](https://github.com/emela-lang/emela/blob/main/spec/language/07-errors.md)、[エフェクト](https://github.com/emela-lang/emela/blob/main/spec/language/08-effects.md)、[Trait](https://github.com/emela-lang/emela/blob/main/spec/language/10-traits.md) の型の規則を日本語でまとめたものです。規範となるのは英語の [仕様](https://github.com/emela-lang/emela/tree/main/spec) で、食い違うときは仕様に従います。
:::

Emela のすべての式は値の型 T、エラーの集合 E、効果の集合 R の3つ組を持ちます。T は Hindley-Milner 方式で推論し、E と R は集合の和と差で求めます。

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
fn(A, B) -> C fails E uses { R }
```

引数の位置に書く関数型では、節の省略は「何でもよく、呼び出し元に伝わる」を意味します。

| 書き方 | 受け取れる関数 |
|---|---|
| `fn(A) -> B` | どんなエラーと効果を持っていてもよい。それらは、受け取った関数を呼ぶ側の E と R に加わる |
| `fn(A) -> B fails {}` | 失敗しない関数だけ |
| `fn(A) -> B uses {}` | 効果を持たない関数だけ |
| `fn(A) -> B fails {} uses {}` | 純粋な関数だけ |
| `fn(A) -> B uses { R }`（R は型引数） | 効果に名前を付け、制約を掛けられる（下の「効果への制約」） |

`List.map(xs, f)` は f のエラーと効果をそのまま引き継ぐので、純粋版と効果版を2つ用意しなくて済みます。

```emela check=error
error Bad

fn apply(f: fn(Int) -> Int fails {}) -> Int { f(1) }

fn use_apply() -> Int {
  # error[E0321]: error set mismatch: expected `fails {}`, found `fails Bad`
  apply(|x| fail Bad)
}
```

関数型の uses には、エフェクトのほかに能力そのものも入ります（`fn() -> Rows uses { primary }`。下の「[能力の値の型](#能力の値の型)」）。これは推論され LSP が表示するもので、ソースには書きません。

### 節を省略したときの意味

関数型の節を省略したときの意味は、書いた位置で決まります。

| 位置 | 省略したときの意味 |
|---|---|
| 引数の型の中（どの深さでも。`f: fn(A) -> B`、`fs: List[fn(A) -> B]`） | 何でもよい。省略した節ごとに、見えない集合変数を置く。そのエラーと効果は、関数を呼んだ側に加わる |
| 戻り値の型、束縛の型注釈、無名関数の引数の型注釈 | 本体から推論する。引数の見えない集合変数を参照してよい（無名関数は汎化しないので、見えない集合変数を置けない） |
| 宣言の中（type・enum・error・handler のフィールド、エフェクトの操作、Trait の関数、const、エフェクトの型引数） | 空。失敗せず、効果を持たない関数だけ |

宣言の中で効果のある関数を持つときは、型引数で明示します。

```emela check
type Request(path: String)
type Response(body: String)

type Handler[E, R](run: fn(Request) -> Response fails E uses { R })

fn compose[A, B, C](f: fn(A) -> B, g: fn(B) -> C) -> fn(A) -> C {
  |x| g(f(x)) # 戻り値の関数は f と g のエラーと効果を持つと推論される
}

fn main() {
  inc = compose(|x: Int| x + 1, |x: Int| x * 2)
  dbg(inc(3))
  ()
}
```

- 宣言の中を空にするのは、型の名前に現れない集合変数を作らないためです。`Handler` が効果を持ちうることは、`Handler[E, R]` と型引数に現れます。
- 型引数がふつうの型か、エラーの集合か、効果の集合かは、使われた位置（`fails E`、`uses { R }`）から推論します。種を書く構文は持ちません。名前付き型の集合の型引数の位置に渡した型引数（`type Server[E](inner: Handler[E, Db])` の E）と、uses 節に書いた組み込みのエフェクトの集合の型引数の位置にある型引数（`uses { Scope[E, R] }`）も集合です。

### 集合の型引数

名前付き型の集合の型引数には集合を渡せます。書き方は fails 節（`A | B`）と uses 節（`{ A, B }`）にそろえます。

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

type Handler[E, R](run: fn(Request) -> Response fails E uses { R })

fn serve(h: Handler[NotFound | Timeout, { Db, Log }], req: Request) -> Response
  fails NotFound | Timeout
  uses { Db, Log } {
  h.run(req)
}

fn only_db(h: Handler[NotFound, Db], req: Request) -> Response fails NotFound uses { Db } {
  h.run(req)
}

fn echo() -> Handler[{}, {}] {
  Handler(run: |req| Response(body: req.path))
}
```

- `Handler[NotFound | Timeout, { Db, Log }]`、`Handler[{}, {}]`、`Handler[E | Timeout, { R, Log }]` のように書きます。
- 要素が1つなら囲まずに書けます（`Handler[NotFound, Db]`）。構文の上では型として読みます。
- 空の `{}` はエラーの集合の位置にも書けます（`fails {}` と同じ）。
- どの型引数が集合を受けるかは文法では決めず、型検査で確かめます。違う種類の集合や集合でない要素は E0323、集合でない型引数の位置の集合（`List[{}]`）は E0324 になります。
- 型引数の数が合わなければ E0304 です（`List[Int, Int]`）。

```emela check=error
type Handler[E, R](run: fn() -> Int fails E uses { R })

# error[E0323]: `E` of `Handler` is an error set, found type `Int`
fn bad(h: Handler[Int, {}]) -> Int { 1 }
```

## 宣言での注釈と推論

| 部分 | 省略したとき | 書いたとき |
|---|---|---|
| 戻り値の型 | T と E を推論する | T を検査し、E は fails 節のとおりであることを強制する |
| fails 節 | 戻り値の型があれば「エラーなし」 | ちょうどその集合であることを強制する |
| uses 節 | 常に R を推論する（戻り値の型を書いていても） | ちょうどその集合であることを強制する。引数の関数を呼んだときの効果（見えない集合変数）は足される |

- 局所の fn も同じ表に従います。その E と R は囲む本体の一部として推論し、型は汎化しません。
- 宣言した R にないエフェクトは E0402 です。診断はエフェクトごとに、それを要求した最初の式（`use` か呼び出し）を指します。

関数の宣言の戻り値の書き方で、エラーの扱いは次のように決まります。

| 書き方 | 意味 |
|---|---|
| 戻り値の型を省略 | E を推論する。エラーはそのまま伝わる |
| `-> T` | エラーなしを強制する。本体に未処理のエラーがあればエラー（E0318） |
| `-> T fails NotFound` | エラーがちょうどこの集合であることを強制する |

- 複数のエラーは縦棒で区切って並べます。エラーのタグと、エラーの集合を表す型引数を混ぜてかまいません（`fails Timeout | E`）。
- `Timeout | E` は、タグ Timeout と集合変数 E の和です。引数の関数型にこう書くと、渡された関数のエラーのうち Timeout 以外が E になります。Timeout を起こさない関数を渡してもかまいません。
- 戻り値の型を書いた関数の E は、書いた fails 節に、引数の関数を呼んだときのエラー（引数の関数型の見えない集合変数）を足したものです。見えない集合変数は書けないので、`-> T` でも引数の関数のエラーは伝わります。
- 引数の関数が受け取る関数（`f: fn(fn() -> A) -> B` の内側）の見えない集合変数は、本体から見ると中身が分かりません。そこへ失敗する関数を渡すと E0321 です。
- E0318 の診断はエラーごとに、そのエラーを起こした最初の式を指します。E にそのエラーを含む部分式を書いた順にたどり、それ以上たどれない式（`fail` か呼び出し）で止まります。

```emela check
fn twice(f: fn() -> Int) -> Int { f() + f() } # E は f のエラー。-> Int でもエラーにならない

fn main() {
  dbg(twice(|| 21))
  ()
}
```

### まとまりごとの推論と汎化

型を推論する定義は互いに参照し合うまとまりごとに、参照される側から推論します。型を推論する定義とは次のものです。

- 戻り値の型を書いていない fn
- 戻り値の型の中に節を省いた関数型がある fn
- uses 節のない fn
- 型を書いていない const

規則:

- まとまりの中では単相の型で参照し、まとまりを推論し終えてから汎化します。まとまりの中で同じ定義を別の型に使うと型が合いません（多相再帰は持ちません）。
- uses 節のない fn は、T と E が宣言のとおりで、R についてだけこの規則に従います。
- 汎化するとき、引数の関数型の E と R にあって下界も上界もない集合変数は、集合の型引数として量化します。`fn caller() { |g| g() }` は `∀ A, E. fn() -> fn(fn() -> A fails E) -> A fails E` です。
- それ以外の集合変数は制約を満たす最小の集合に決めます。
- 汎化するのはトップレベルの fn と const だけです。ブロックの中の束縛と局所の fn は汎化しません。
- 型引数が値の型（`err: E`）とエラーの集合（`fails E`）の両方に使われたとき、その型引数は1つのエラーの型として推論します。`fail` に渡した値の型がまだ決まらない型変数のときも同じで、`fn raise(err) { fail err }` の型は `∀ E, A. fn(E) -> A fails E` です。エラーでない型を `fail` に渡したとき、また1つのエラーの型の型引数をエラーでない型で具体化したときは E0319 です。Never の値を `fail` に渡しても E には何も加わりません。

```emela check
error NotFound(id: Int)

fn or_fail[A, E](opt: Option[A], err: E) -> A fails E {
  opt match {
    Some(a) -> a
    None    -> fail err
  }
}

fn find(id: Int) -> Int fails NotFound {
  or_fail(None, NotFound(id:)) # E = NotFound
}
```

### 型の表示

LSP と診断は型を次の形で表示します。

- 汎化した型引数は現れた順に `A`、`B`、…、`Z`、その後は `T26`、`T27`、… と名付けます。制約は `∀ A: Ord + Show, B. T` の形で量化子に書きます。
- 汎化した集合の型引数は `E`、`E1`、…（エラー）、`R`、`R1`、…（効果）と名付け、ふつうの型引数の後ろに並べます。
- 引数の型の中の見えない集合は、引数の名前から `E(f)`、`R(f)` と表示します。同じ引数の2つ目以降は `E(f, 2)` です。
- 空の E と R は省きます。ただし関数型の引数の型の中では、省くと「何でもよい」と読めるので `fails {}`、`uses {}` と書きます。
- uses 節の効果の集合はいつも波括弧で囲みます（`uses { A }`、`uses { A, B }`、`uses {}`）。エフェクトを先、集合の型引数を後に並べます。名前付き型の集合の型引数では、要素が1つならそのまま書きます（`Handler[E, Db]`）。
- `fails` 節の後に `uses` 節を書きます。
- 外側に節のある関数型の戻り値が関数型なら、戻り値を括弧で囲みます。
- 能力の値の型は `use Logger` と表示します。`use` は能力の値1つを、`uses` は集合を表し、入れ替えられません。
- 型の食い違いの診断にはまだ決まっていない集合変数を出しません。
- 読めなかった型や名前を解決できなかった型は `{unknown}` と表示します。この型はどの型とも一致するものとして扱い、エラーが重ならないようにします。

```emela check=error
fn now_only[R: Immediate](f: fn() -> () uses { R }) -> () uses { R } { f() }

fn pass(g: fn() -> ()) {
  # error[E0416]: effect set `R(g)` may suspend, but `R` of `now_only` must be `Immediate`
  now_only(g)
}
```

## 型付け規則

各式の T、E、R は次のとおり決まります。部分式の E と R は、特記がないかぎり親の式に合流します。

| 式 | T | E | R |
|---|---|---|---|
| リテラル、変数、const | その型 | {} | {} |
| `[e1, ..., en]` / `[e1, ..., en, ..r]` | `List[T]`（各 ei が T、r が `List[T]`） | E1 ∪ … ∪ En ∪ Er | R1 ∪ … ∪ Rn ∪ Rr |
| `f(a)` | f の戻り値の型 | Ef ∪ Ea | Rf ∪ Ra |
| `x.f(a)`（メソッド呼び出し） | 見つかった関数を `M.f(x, a)` と呼んだときの戻り値の型 | Ex ∪ Ef ∪ Ea | Rx ∪ Rf ∪ Ra |
| `C(fi: ei, ..r)` | C の型（型引数は ei と r の引き継ぐフィールドから決まる） | Ei ∪ Er | Ri ∪ Rr |
| `fail e` | Never | { e のタグ } | {} |
| `e escape { Ti -> ei }` | e の型と各腕の型の共通の型（Never は合流で消える） | (Ee ∖ {Ti}) ∪ Eei（Ti は腕が値をすべて受けるタグ。集合変数からは消さない。`_` の腕があれば Eei だけ） | Re ∪ Rei |
| `use X` | `use X` | {} | { X } |
| `with H { e }` | e の型 | Ee ∪ (init の E) ∪ (init の引数の E) | (Re ∖ 供給(H)) ∪ 依存(H) ∪ (init の引数の R) |
| `with x = E.M(a) { e }` | e の型 | Ee ∪ Ea ∪ (M の init の E) | Re ∪ { E } ∪ Ra |
| `with x = c.M(a) { e }` | e の型 | Ee ∪ Ea ∪ (M の init の E) | Re ∪ { c } ∪ Ra |
| init の中の `E.M(a)`、`c.M(a)` | `use F`（F は M が実装するエフェクト） | Ea ∪ (M の init の E) | { E } または { c } ∪ Ra |
| `\|x\| e` | `fn(..) -> T fails Ee uses { Re }`（Re は捕まえた能力を要素に残す） | {} | {} |
| `fn f(x: A) -> T { e }`（局所の fn。文） | f を `fn(A) -> T fails Ee uses { Re }` に束縛する | {} | {} |
| `if c { a } else { b }` | a と b の共通の型 | Ec ∪ Ea ∪ Eb | Rc ∪ Ra ∪ Rb |
| `e match { pi -> ei }` | 腕の共通の型 | Ee ∪ Eei | Re ∪ Rei |

補足:

- 呼び出し `f(a)` は、f の R の要素のうち引数である能力を、対応する実引数の要素に置き換えて R に足します。
- 無名関数と局所の fn は本体の E と R を関数型の中に閉じ込めます。それらが表に出るのは関数を呼んだときです。局所の fn の本体の中での自分の名前は推論中の型を持ち、汎化しません。
- Never はどの型とも共通の型を作れます。if や match の一方の分岐が fail でも、全体の型はもう一方の型になります。
- Never が他の型として扱われるのは、分岐の合流と、期待される型の位置に置かれたときの最上位だけです。`List[Never]` と `List[Int]` は一致しません。
- 期待される型がなく、分岐の型が一致しないときは、最初の分岐の型を期待する型、後の分岐の型を実際の型として E0301 を出し、最初の分岐の型を全体の型として検査を続けます。
- 呼び出しの引数は仮引数の順に検査します。期待する型がある位置（引数、戻り値の型、束縛の型注釈）では、その型をブロックの最後の式、if と match の各分岐、リストの要素、無名関数の引数と本体へ先に渡します。`List.map(users, |u| u.name)` では、u の型は先に検査した users から決まります。
- 供給(H) は H が実装するすべてのエフェクト、依存(H) は H の init、release、操作の本体の R の和です。ラベルの項目の供給と依存は下の「[ラベル](#ラベル)」にあります。

```emela check
type User(name: String)

fn names(users: List[User]) -> List[String] {
  List.map(users, |u| u.name) # u の型は users から決まる
}

fn main() {
  dbg(names([User(name: "alice")]))
  ()
}
```

### 演算子と数値

- 算術演算子（`+` `-` `*` `/` `%`）と単項マイナスは Int、Int64、Float にだけ使えます。両辺は同じ型でなければなりません（E0310）。
- `==` と `!=` は Eq を、大小比較（`<` `<=` `>` `>=`）は Ord を満たす型に使えます。両辺は同じ型です。満たさなければ E0326 です。関数型は Eq を満たさないので、関数の値の `==` もエラーです。
- 算術演算子と単項マイナスのオペランドの型が、定義の推論を終えても決まらなければ Int になります。

### フィールドの参照と部分更新

- フィールドの参照 `x.name` は、検査がそこに達した時点で x の型が名前付きの型に決まっていなければなりません。決まっていなければ E0314 です。フィールドの名前から型を逆算することはしません（行多相は持ちません）。
- フィールドを参照できるのは、type、error、フィールドのある handler の値だけです。enum の値は、バリアントが1つでも名前付きのフィールドでも `.` で参照できません（E0313）。
- 部分更新 `C(fi: ei, ..r)` を使えるのは、構成子が1つのもの（type、error、フィールドのある handler）だけです。enum のバリアントには使えません（E0222）。`..` の値がそのバリアントだと型で保証できないためです。
- `..` の後の式の型はその構成子の型でなければなりません。型引数は変わってかまいません（`Pair[Int, Bool]` から `Pair[String, Bool]` を作れる）。
- フィールドを全部書いたうえで `..` も書いたときと、1つも書かずに `..` だけを書いたときは、linter が警告します。

```emela check=error
type User(name: String)

fn main() {
  get = |u| u.name # error[E0314]: the type of this value must be known to access field `name`
  dbg(get(User(name: "a")))
}
```

```emela check=error
enum Shape {
  Circle(radius: Float)
}

fn main() {
  c = Circle(radius: 1.0)
  d = Circle(radius: 2.0, ..c) # error[E0222]: cannot update enum variant `Circle` with `..`
}
```

### メソッド呼び出し

`x.f(a1, ..., an)` は、x の型の先頭が名前付きの型 T で、x が能力の値でないときに使えます。f は次の順に探します。

1. T のフィールド
2. T を定義したモジュールの fn のうち、最初の引数の型の先頭が T のもの（そのモジュールの外では pub fn だけ）。スコープは見ません
3. T が実装する Trait のうち、呼ぶ側のモジュールから名前で見える Trait（Prelude の Trait、波括弧で名前を import した Trait、そのモジュールで定義した Trait）の、`self` を取る関数

規則:

- x の型が型引数 A なら、A の制約の Trait の関数だけを探します。
- フィールドは関数型の値として呼びます。関数は `M.f(x, a1, ..., an)` と同じ名前付き引数、評価順、E、R で呼びます。
- 候補が2つ以上あれば E0335、1つもなければ E0312（フィールドのない型なら E0313）です。フィールドと同じ名前の fn をモジュールに宣言すると E0334 なので、フィールドとモジュールの関数が両方見つかることはありません。
- 呼ばずに `x.f` と書いて f が 2 か 3 で見つかる関数なら、関数の値にはならず E0312 です。
- 検査がそこに達した時点で x の型の先頭が決まっていなければ E0314 です。型引数は、その呼び出しの最初の引数として検査します。
- 局所の fn はメソッド呼び出しでは見つかりません。

```emela check
type User(name: String, age: Int)

fn greeting(user: User, prefix: String) -> String {
  "#{prefix}, #{user.name}"
}

fn main() {
  u = User(name: "alice", age: 30)
  dbg(u.greeting("hello")) # greeting(u, "hello") と同じ
  ()
}
```

```emela check=error
type User(name: String)

fn greeting(user: User) -> String { user.name }

fn main() {
  u = User(name: "alice")
  f = u.greeting # error[E0312]: no field `greeting` for type `User`
}
```

### E の包含

部分型は持ちませんが、E にだけ包含があります。

- 関数の値の E は期待される関数型の E に含まれれば十分です。E の小さい関数を E の大きい関数として使えます。
- 分岐の合流やリストの要素で E の違う関数を並べると、E はそれらの和になります。
- 包含の向きは、関数型の引数の中で逆になり、名前付きの型の型引数の中では両方向（一致）になります。
- fails に集合の型引数が2つ以上ある関数型（`fails E1 | E2`）の引数に関数を渡すと、渡した関数のエラーのうち書き出したタグにないものは、最初の集合の型引数に入ります。これは近似で、後の検査でエラーになることがあります。uses 節（`uses { Quiet, R1, R2 }`）も同じです。
- E はタグと集合変数の和で表します。`∖ {Ti}` はタグの部分だけに作用し、集合変数はそのまま残します。集合変数が後で具体的な集合に決まっても、遡って消すことはしません（安全側に倒した近似です）。

```emela check
error Timeout
error Refused

fn run(f: fn() -> Int fails Timeout | Refused) -> Int fails Timeout | Refused { f() }

fn main() {
  n = run(|| 1) escape {
    Timeout -> 0
    Refused -> 0
  }
  dbg(n)
  ()
}
```

## 網羅性と冗長な腕

- すべての場合を覆っていない match は E0303 です。エラーには足りないパターンの例が出ます。腕のない match は、Never を含むどの型の値に対しても網羅していません。
- それより上の腕で全部覆われている腕は、到達しないので警告します（W0301）。ガードの付いた腕も、上のガードのない腕に覆われていれば W0301 です。
- ガードの付いた腕は網羅の判定に数えません。それより下の腕が冗長かどうかの判定でも、下の腕を覆いません。
- 右辺がリテラル、単項マイナスを付けた数値リテラル、構成子、タプル、リスト、同じ条件を満たす const だけでできた const は、網羅と冗長の判定でもその値として扱います。
- それ以外の const は、ガードの付いた腕と同じく網羅の判定に数えず、下の腕も覆いません。展開できない const がパターンの内側にあるとき（`Some(LIMIT)`）は、腕全体をガードの付いた腕として扱います。
- 冗長な腕の判定では Float の NaN どうしを同じ値とみなします。
- 範囲のパターン（`1..10`）は持ちません。網羅の判定が数の区間を扱わずに済むようにするためです。範囲はガードで書きます。

```emela check
const ADMIN_ID = 0

fn describe(n: Int) -> String {
  n match {
    ADMIN_ID -> "admin"
    0        -> "zero" # warning[W0301]: ADMIN_ID が 0 を覆っている
    _        -> "other"
  }
}

fn main() {
  dbg(describe(0)) # "admin"
  ()
}
```

### 束縛のパターン

束縛 `パターン = 式` の左辺と無名関数の引数のパターンには、反駁不能なパターンだけを書けます。反駁可能なパターンは E0317 です。検査は網羅性と同じで、エラーには足りないパターンが出ます。

- 反駁不能なもの: 構成子が1つの type、タプル、変数、`_`
- 反駁可能なもの: enum のバリアント、リテラル、負の数、const、要素数を決めたリスト

```emela check=error
fn main() {
  Some(x) = Some(1) # error[E0317]: refutable pattern in binding: pattern `None` not covered
}
```

## escape と with が集合変数から消さないこと

escape はエラーを、with はエフェクトを集合から取り除きます。ただし中身の分からない集合変数からは何も消しません。例外は escape の `_` の腕です。

### escape

- 腕の最上位のパターンはエラーの構成子か `_` です。エラーでない構成子は E0217、変数とガード付きの `_` は E0320 です。腕の網羅は求めません。
- 腕で受けたタグは E から消えます。受けていないタグはそのまま伝わります。
- タグが消えるのは、そのエラーのガードのない腕を合わせて、そのエラーの値をすべて受けるとき（`NotFound(_)`。`Flag(on: True)` と `Flag(on: False)` の2本でもよい）だけです。一部の値しか受けない腕（`NotFound(id: 1)`、ガード付きの腕）だけなら、タグは E に残ります。
- `_` の腕は届いたエラーをすべて受け、E からすべてのタグとすべての集合変数（中身が分かるかどうかによらず）を消します。それより下の腕は W0301 です。
- 腕の中で起きたエラーは E に加わります。
- 腕の結果は元の式と同じ型か、Never でなければなりません。元の式の型が Never のときは、腕の共通の型が全体の型になります。
- 冗長な腕は match と同じく W0301 です。元の式から起きないエラーを受ける腕は W0302 です。どちらも、元の式の E に中身の分からない集合変数がないときだけ確かめます（`_` より下の腕の W0301 は除く）。
- 式の E に中身の分からない集合変数が含まれるとき、`_` 以外の腕はその変数から何も消しません。中身の分からない集合変数とは、集合の型引数 `E`、引数の関数型の見えない集合変数、1つのエラーの型の型引数、汎化する定義の集合変数です。同じ関数の中で推論中の集合（局所の関数の E など）からは正確に消えます。
- 腕は実行時にはそのタグを受けますが、型の上では変数が残ります。型の上でも正確に消したいときは、受けたいタグを関数型に書き出します（`fails Timeout | E`）。書き出したタグは集合変数の外にあるので、escape で消えます。

```emela check=error
error Timeout

# f の E は見えない集合変数。escape しても型は変数のまま（Timeout が残りうる）
fn retry[A](f: fn() -> A) -> A {
  f() escape { Timeout -> f() }
}

fn flaky() -> Int {
  retry(|| fail Timeout) # error[E0318]: unhandled error `Timeout`
}
```

```emela check
error Timeout

# Timeout を書き出すと、1回目の呼び出しの Timeout は型からも消える
fn retry[A, E](f: fn() -> A fails Timeout | E) -> A fails Timeout | E {
  f() escape { Timeout -> f() } # escape の E は E、2回目の f() で Timeout | E
}

# _ の腕は集合変数ごと消す
fn or_else[A, E](f: fn() -> A fails E, default: A) -> A {
  f() escape { _ -> default }
}
```

呼ぶ側では集合が決まるので、日常のコードの escape はいつも正確です。差が出るのは、関数を受け取る汎用の関数の中だけです。

### with

- 供給したエフェクトは本体の R から消えます。ただし escape と同じく、中身の分からない効果の集合（引数の関数型の見えない集合など）からは消しません。
- 型の上でも正確に消したいときは、供給するエフェクトを関数型に書き出します（`uses { Logger, R }`）。書き出したエフェクトは集合変数の外にあるので、with で消えます。

```emela check=error
effect Log {
  fn info(msg: String) -> ()
}

handler QuietLog: Log {
  fn info(msg) { () }
}

fn run(f: fn() -> ()) {
  with QuietLog { f() } # R は f の効果の集合のまま
}

fn caller() -> () uses {} {
  run(|| (use Log).info("x")) # error[E0402]: Log が残る
}
```

```emela check
effect Log {
  fn info(msg: String) -> ()
}

handler QuietLog: Log {
  fn info(msg) { () }
}

fn run[R](f: fn() -> () uses { Log, R }) -> () uses { R } {
  with QuietLog { f() } # R は R だけ。Log は消える
}

fn main() {
  run(|| (use Log).info("x"))
}
```

### 能力の値の型

- E の能力の値の型は `use E` と書きます。E はエフェクト（型引数を含む）かラベルです。`use E` はふつうの型で、型を書けるところならどこにでも書けます。
- 能力の値は、ほかの値と同じく引数に渡せて、データ構造に入れられて、関数から返せます。ただし供給した with の外へは出られません（下の「[能力が with から漏れないこと](#能力が-with-から漏れないこと)」）。
- `use E` の値で呼べるのは E の操作だけで、関数の値として取り出せるのも E の操作だけです。能力の値を調べる操作はありません。`use E` はどの Trait も実装せず、`==` も使えません（E0326）。
- 複数のエフェクトの能力の型は `use E1 + ... + En` と書きます。`use F1 + ... + Fm` の引数には、どの Fi も Ej のどれかであるような能力を渡せます。その引数で呼べるのは Fi の操作だけで、ほかのエフェクトを取り戻す方法はありません。Fi のどれかを持たない能力を渡すと E0452 です。
- `use X` を含む関数の R には X が載ります。分岐の中に書いても、関数全体の R に載ります。
- `use E` で得た能力の値の操作を呼ぶと、R に E が載ります。クロージャや局所の fn が捕まえた能力の操作を呼ぶと、R にはその能力そのものが載ります（`uses { primary }`）。R の能力はそのエフェクトへ広げられます。R に `p` を含む関数は、R に p のエフェクトを含む位置で使えます。中断しうるかどうか（E0417）は能力のエフェクトで決めます。
- 操作を呼ぶと、E に操作の `fails` が載ります。
- 能力の値の操作を呼ばずに `log.info` と書くと関数の値になります。能力の値はその位置で評価され、関数の値の型には能力のエフェクトが載ります。
- R の中で同じエフェクトかどうかは、型引数まで比べます。`State[Int]` と `State[String]` は別のエフェクトです。型引数がまだ決まっていなければ単一化して比べます。R に残った型変数は汎化します（`fn peek() { modify(|x| x) }` は `∀ A. fn() -> A uses { State[A] }`）。
- with で後ろの項目が優先されるのも、型引数まで同じエフェクトのあいだだけです。
- `use Store[S]` の型引数には囲む fn の型引数を書けます。型引数は省略できません（E0423）。
- 型引数を持つエフェクトのハンドラは、具体的な型を書きます（`handler H: Store[Int]`）。どの型でも実装する汎用のハンドラはありません。

```emela check=error
effect Query {
  fn query(sql: String) -> String
}

effect Execute {
  fn execute(sql: String) -> ()
}

fn migrate(db: use Query + Execute) {
  db.execute(db.query("select 1"))
}

fn read_only(q: use Query) {
  # error[E0452]: expected `use Query + Execute`, found `use Query`, which does not have `Execute`
  migrate(q)
}
```

:::caution[今の実装との違い]
仕様には、`use E` だけが満たす組み込みの Trait `Capability` があり、`[C: Capability]` でどのエフェクトの能力でも受け取れます。0.28.0 のコンパイラはまだ `Capability` を知らず、`cannot find trait` の E0211 になります。
:::

### 能力が with から漏れないこと

能力の値と、能力を持つ値（能力を捕まえたクロージャや局所の fn、能力を含むデータ構造）は、その能力を供給した with の外へ出られません。

- コンパイラは値の型と一緒に、その値が持つ能力の集合（捕捉集合）を推論します。捕捉集合の要素は根です。根は with の項目のハンドラ、`Fiber.scope` の Scope、ハンドラの操作の中の `self` です。`use E` は、その位置で E を供給するいちばん内側の with の根を指します。
- クロージャと局所の fn は、捕まえた変数が持つものを持ちます。データ構造は要素が持つものを持ちます。呼び出しの結果は、呼ばれた側の戻り値が持つものを、引数を実引数に置き換えて持ちます。能力を含みえない型の値は何も持ちません。
- 関数の戻り値の捕捉集合は本体から推論します。本体のない宣言（エフェクトの操作、Trait の関数、`@external` fn、引数の関数型）の戻り値は、引数が持つものを持ちます。操作の戻り値はハンドラも持ちます。
- with の本体の値がその with の根を持つと、警告します（W0402）。
- 実験的な機能 `capture-checking` を有効にすると、W0402 の代わりに E0444 になります。有効にするには `Pome.toml` の `[experimental]` に `capture-checking = true` を書くか、`emela check`、`build`、`run`、`test` に `--experimental-capture-checking` を渡します。
- エラーが既定でないあいだは、実行時の検査も残ります。解放済みのハンドラの操作を呼ぶと defect です。これはフィールド、init、release のどれかを持つハンドラだけに当てはまります。
- 捕捉集合はソースに書きません。LSP が表示します。
- with の中で使い切るクロージャ（`List.map(names, |n| log.info(n))`）は問題ありません。

```emela check
effect Log {
  fn info(msg: String) -> ()
}

handler QuietLog: Log {
  fn info(msg) { () }
}

fn make_greeter() {
  with QuietLog {
    log = use Log
    || log.info("hi") # warning[W0402]: log を持ったまま with を出る
  }
}

fn main() {
  make_greeter()
  ()
}
```

```console
$ emela check --experimental-capture-checking main.emel
error[E0444]: a value that holds `log` cannot leave the `with` that provides it
    ╭─[ main.emel:12:5 ]
    │
 10 │   with QuietLog {
    │        ────┬───
    │            ╰───── `log` is released at the end of this `with`
    │
 12 │     || log.info("hi") # warning[W0402]: log を持ったまま with を出る
    │     ────────┬────────
    │             ╰────────── the value of the body holds `log`
────╯
   = note: experimental feature `capture-checking`

1 error
```

## 効果への制約

効果の集合は型引数として書けて、Trait と同じ構文で制約を掛けられます。

```emela
@external(js, "./dom.mjs", "onClick")
fn on_click[R: Immediate](id: String, callback: fn() -> () uses { R }) -> ()
```

Immediate は「中断せず、呼んだその場で完了する」ことを表す組み込みの制約です。コンパイラが宣言から自動で判定するので、実装は書きません。

- エフェクトが Immediate であるのは、suspend fn も suspend handler のハンドラメンバーも持たず、Async でもないときです。
- 効果の集合が Immediate であるのは、要素がすべて Immediate のときです。空集合は Immediate です。

この制約を要求するのは、中断されると困る場所（外部関数に渡すコールバックなど）だけです。呼び出し側に印を付ける代わりに、型検査で禁止します。

```emela check=error
effect Ticker {
  suspend fn tick() -> ()
}

fn now_only[R: Immediate](f: fn() -> () uses { R }) -> () uses { R } { f() }

fn bad() -> () uses { Ticker } {
  now_only(|| (use Ticker).tick()) # error[E0416]: Ticker は中断しうる
}
```

規則:

- Immediate を付けられるのは uses 節に書く型引数（効果の集合）だけです。ふつうの型引数やエラーの集合の型引数に付けると E0322 です。
- 効果の集合の型引数には Trait の制約を付けられません。0.28.0 では `not supported yet: trait bounds on effect sets` のエラーになります。
- `R: Immediate` の制約は、その定義（fn か構成子）を参照したところで、具体化した集合について確かめます（E0416）。診断は参照（呼ばれる側の名前）を指し、同じ参照で足りない要素は1つの診断にまとめます。型の注釈（`Ticker[Clock]`）では確かめません。値は構成子からしか作れないためです。
- 引数の型の中の見えない効果の集合は Immediate の制約を持たないので、`R: Immediate` の引数には渡せません。制約が要るときは、名前を付けた型引数に `: Immediate` を書きます。
- 外部関数の引数の型の中の見えない効果の集合は、Immediate の制約を持ちます。外部関数の宣言の引数の関数型に書いた uses 節は、Immediate でなければエラーになります。
- 型を推論する定義で、Immediate を要求する位置に渡した集合変数を汎化するときは、その型引数に Immediate の制約を付けます。
- エフェクトが Immediate かどうかは宣言だけで決まり、ハンドラにも型引数にも左右されません。ラベルが Immediate かどうかは元のエフェクトで決まります。
- fn の操作の実装と、suspend の付かないハンドラメンバーを実装するハンドラの init と release は、R が Immediate か、中断しうる呼び出しを含まないかのどちらかを満たさなければなりません（E0417）。そのため fn の操作の呼び出しと suspend の付かないハンドラメンバーを開くことは、どのハンドラに当たっても中断せず、Immediate なエフェクトの操作とハンドラメンバーが中断することはありません。

```emela check
effect Log {
  fn info(msg: String) -> ()
}

fn now_only[R: Immediate](f: fn() -> () uses { R }) -> () uses { R } { f() }

fn ok() -> () uses { Log } {
  now_only(|| (use Log).info("x")) # Log は Immediate
}
```

### 中断しうる呼び出し

E0417 の判定で、呼び出しが中断しうるかは次で決めます。

- 操作の呼び出し（`clock.now()`、`(use Clock).now()`）は、その操作の宣言で決まります。`suspend fn` なら中断しうる呼び出しです。
- 関数と関数の値の呼び出しは、呼ばれる側の型の R で決まります。R が Immediate でなければ中断しうる呼び出しです。能力を捕まえたクロージャや、値として取り出した操作（`g = clock.now`）を呼ぶのも関数の値の呼び出しです。
- `@external suspend fn` の呼び出しは中断しうる呼び出しです。
- ハンドラメンバーを開くこと（with の `x = E.M(a)`、init の中の `E.M(a)`）は、ハンドラメンバーの宣言で決まります。`suspend handler` なら中断しえます。with の項目では、開いたハンドラを解放する with の終わりも中断しえます。

本体の R が Immediate でないとき、E0417 は中断しうる呼び出しごとにその位置に出ます。無名関数の本体の中は探さず、その無名関数を呼んだところを関数の値の呼び出しとして数えます。

関数を挟むと、その関数が fn の操作しか呼ばなくても中断しうるとみなします（`fn stamp() -> Instant uses { Clock }` を呼ぶ本体は E0417）。外側の Clock の `now` と、内側の `with InstantClock` の中の `sleep` を同じ本体に混ぜた場合も、どちらの条件も満たさず E0417 です。

## suspend fn の実装

- suspend fn の実装は最後の引数に resume を受け取ります。resume の型は `fn(T) -> () fails {} uses {}` です（T は操作の戻り値の型）。
- 実装の本体の値は捨てるので、本体の型は `()` でなければなりません。
- 実装の本体で `resume` を直接呼ぶ（`resume(v)`）以外の使い方をすると、後から呼びうるとみなしてハンドラの依存に Async を足します。直接呼ぶ以外の使い方とは、変数に入れる、クロージャで捕まえる、引数に渡す、などです。この判定は構文だけで決め、安全側に倒します。

## ハンドラ

- ハンドラはコロンの後に並べたエフェクトの操作を、それぞれちょうど1回実装します（`handler SystemTx(conn: Connection): Query + Execute`）。どのエフェクトの操作も同じ `self` を共有します。
- 同じ名前の操作かハンドラメンバーを持つ2つのエフェクトを並べると E0450、同じエフェクトを2回並べると E0451 です。
- 複数のエフェクトを実装するハンドラは、with でそのすべてを供給します（供給(H)）。init と release は1回ずつ走ります。layer の E0421 では、そのハンドラが実装するエフェクトのそれぞれを供給するものとして数えます。
- with の項目 `x = H` の x は、H が供給するエフェクトの能力です。複数のエフェクトを実装するハンドラなら `use E1 + ... + En` を受け取る引数に渡せます。
- 操作の本体の E は、操作の宣言の `fails` に含まれなければなりません。release の E は空でなければなりません（E0420）。
- `self` 経由で、フィールドに持った能力の操作を呼んでも（`self.inner.read(max)`）、そのエフェクトはハンドラの依存になりません。その能力はハンドラの with を囲む with か、init で開いたハンドラメンバーのもので、どちらもハンドラより長く生きます。中断しうるかどうかの判定には数えます。release で suspend fn をそう呼ぶと、ハンドラの依存に Async を足します。

```emela check
effect Query {
  fn query(sql: String) -> String
}

effect Execute {
  fn execute(sql: String) -> ()
}

handler MemoryDb: Query + Execute {
  fn query(sql) { sql }
  fn execute(sql) { () }
}

fn copy(from: use Query, to: use Execute) {
  to.execute(from.query("select 1"))
}

fn migrate(db: use Query + Execute) {
  copy(db, db) # 少ないエフェクトの能力として渡せる
}

fn main() {
  with db = MemoryDb {
    migrate(db)
  }
}
```

### ハンドラメンバー

エフェクトはハンドラメンバー（`handler Open(path: String): ReadFile`）を宣言できます。ハンドラメンバーは操作ではなく、そのエフェクトのどのハンドラも供給するハンドラに名前を付けたものです。

- 引数はそのハンドラの init の引数、`fails` はその init の E です。コロンの後のエフェクトは、そのハンドラが実装するエフェクトです。
- エフェクトのハンドラは、ハンドラメンバーごとに同じ名前の内側のハンドラで実装します。その init はハンドラメンバーと同じ名前と型の引数を取ります。足りなければ操作と同じく E0404 です。
- 内側のハンドラの init、release、操作の本体で使うエフェクトは、外側のハンドラの依存です。
- `x = E.M(a)` は、その位置で E を供給するいちばん内側のハンドラの M の init を呼び、E を要求します。`x = c.M(a)` は能力 c を供給するハンドラの M を開き、c を要求します。内側のハンドラの依存は要求しません。
- ハンドラメンバーの項目が供給するエフェクトは、`use` で名前から取り出せません。束縛した能力からだけ使えます。
- `suspend handler` と宣言したハンドラメンバーは、開くときと解放するときに中断しえます。これを持つエフェクトは Immediate ではありません。

```emela check
effect ReadFile {
  fn read(max: Int) -> String
}

effect Files {
  handler Open(path: String): ReadFile
}

handler MemoryFiles: Files {
  handler Open(path: String): ReadFile {
    init(path: String) { Self(path:) }

    fn read(max) { self.path }
  }
}

fn main() {
  with MemoryFiles {
    with f = Files.Open("a.txt") { # R に Files が載る
      dbg(f.read(10))
    }
  }
  ()
}
```

## ラベル

`effect L of E` の L をラベル、E を元のエフェクトと呼びます。

- R の中では L と E は別のエフェクトです。`use L` で得た能力の値の操作は E の操作で、呼ぶと R に L が載ります。
- L は E のハンドラメンバーも持ちます。with の `x = L.M(a)` は L を供給するハンドラの M を開き、L を要求します。
- 元のエフェクトは、操作かハンドラメンバーを持つ利用者のエフェクトでなければなりません。ラベルや、Async や Scope のような組み込みのエフェクトを書くと E0429 です。元のエフェクトが常に1段で決まり、`default` の意味も1通りで済むようにするためです。中身を分けたいときは、平たく `effect Nested of Console` と宣言し、`with Nested by AuditLog` で差し込みます。
- 型引数を持つエフェクトのラベルは、元のエフェクトの型引数を書きます（`effect Hits of State[Int]`）。ラベル自身は型引数を持ちません。
- ラベルにハンドラを書くと E0433 です。元のエフェクトのハンドラを `by` で差し込みます。

```emela check=error
import Std.Console.{Console}

effect AuditLog of Console
effect Nested of AuditLog
# error[E0429]: label `Nested` cannot stand for `AuditLog`: `AuditLog` is a label
#   = help: write `effect Nested of Console`; `AuditLog` can still be plugged into it with `with Nested by AuditLog`
```

with のラベルの項目の供給と依存は次のとおりです。

| 項目 | 供給 | 依存 |
|---|---|---|
| `L` | E | L |
| `L by P` | L | P がハンドラならその依存、エフェクトなら P |

- `L by P` の P は E のハンドラ、E 自身、E の別のラベルのどれかです。ほかのエフェクトを担うものなら E0431 です。P が複数のエフェクトを実装するハンドラなら、そのうち L の元のエフェクトとして L を担います。元のエフェクトがなければ E0431 です。
- ラベルでないエフェクトを with や `by` の左に書くと E0430、同じ with で同じラベルに `by` を2回書くと E0432 です。

`default` のラベル:

- E を担う項目（ハンドラでも、`M` のようなラベルの項目でもよい）に `L by E` を暗黙に足すのと同じです。同じ with に `L by P` があれば、順序によらずそちらが優先します。
- default の供給で消えるのは本体の R からだけです。同じ with のほかのハンドラの依存は満たしません。
- 見えない集合（引数の関数型の R など）の中の L は、default の供給でも消しません。

default のないラベルを供給しないと、main とテストで R が空にならず E0402 です。

本体の R にも、同じ with のほかの項目の依存にも現れないラベルの項目は警告します（W0401）。本体の R が見えない集合を含むときは警告しません。

## Trait と導出

- Trait の関数は既定で純粋です。宣言に `fails E` や `uses { R }` があれば、実装はその範囲のエラーと効果を持てます。宣言の範囲を超えられません。そのため `[A: Decode]` を使う関数の E と R は、Trait の宣言だけで決まります。
- 制約は `[A: Ord]`、複数なら `[A: Ord + Show]` と書きます。制約は上位の Trait を含みます。`[A: Ord]` の関数の中では `A` の値に `==` を使えます。
- 制約のある型引数を持つ定義を参照したところで、具体化した型が制約を満たすか確かめます。満たさなければ参照の位置で E0326 です。呼ばずに値として参照したときも同じです。
- 引数に Self がなく、戻り値の型だけに Self がある関数（`Parse.parse(s)`）は、結果の型から impl を選びます。結果の型は関数の中での使われ方から推論してよく、関数の中で決まらなければ E0333 です。既定の型は選びません。
- 1つの型と Trait の組に、impl はプログラム全体で1つだけです（2つ目は E0330）。impl を書けるのは、型を定義したモジュールか Trait を定義したモジュールだけです（E0331）。impl の頭には型の名前と、互いに違う型引数の並びだけを書けます（E0328）。
- `impl A: B` を書くと、そこで `B` の impl があるかを確かめます（なければ E0326）。

### derive

- derive に並べた Trait の実装を、コンパイラが型の構造から生成します。生成するのはふつうの impl です。各フィールドは、そのフィールドの型の実装を通します。
- 導出できるのは、Prelude の Eq、Ord、Show、`Std.Dynamic` の Encode、Decode、ObjectKey、`Std.Shape` の Shaped だけで、導出規則はコンパイラが持ちます。ほかの Trait を derive に書くと E0326 です（同じ名前の利用者の Trait も含む）。
- 同じ型と Trait の組に、derive と手書きの impl の両方があると E0330 です。derive に同じ Trait を2回書いても E0330 です。
- フィールドの型が Trait を満たさなければ導出できません（E0326）。Float のフィールドを持つ型には Ord を導出できません。
- 上位の Trait は暗黙に導出しません。`derive Ord` には Eq の derive か impl が要ります（E0326）。
- 型引数を持つ型への導出は、すべての型引数に同じ制約を付けた impl を生成します（`enum Tree[A] { ... } derive Eq` は `impl Tree[A: Eq]: Eq`）。
- 導出した Ord は、バリアントを宣言順に小さいものから並べ、同じバリアントではフィールドを前から比べます。
- ObjectKey を導出できるのは、どのバリアントも中身を持たない enum と、フィールドがちょうど1つの type だけです。それ以外は E0339 です。
- opaque な型には Decode と ObjectKey を導出できません（E0336）。フィールドのない `@external type` には Encode、Decode、ObjectKey、Shaped のどれも導出できません（E0336）。
- pub でない型に導出した実装がプログラムのどこでも要求されなければ W0303 です。

導出には次の3種類があります。利用者の Trait の作者が導出規則を書く仕組みはまだありません。

| 導出の型 | 形 | 導出できる Trait |
|---|---|---|
| 畳み込み | 値を1つ受け取り、フィールドごとの結果をまとめる | Show、Encode、Shaped、ObjectKey の `to_key` |
| 突き合わせ | 値を2つ受け取り、フィールドごとに比べる | Eq、Ord |
| 組み立て | フィールドごとの生成結果から値を作る | Decode、ObjectKey の `from_key` |

### 組み込みの Trait

| Trait | 用途 | 利用者の impl |
|---|---|---|
| Eq | `==` `!=` | 書ける |
| Ord | `<` `<=` `>` `>=` | 書ける |
| Show | 文字列の補間 | 書ける |
| Immediate | 効果が中断しない（上の「効果への制約」） | 書けない（自動で判定） |
| Capability | 型が能力の型 `use E` である | 書けない（自動で判定） |

- 関数型は Eq、Ord、Show のどれも満たしません。
- Int、Int64、String、Bool は Eq、Ord、Show を満たします。Float は Eq と Show を満たし、Ord は満たしません。Float の大小比較は Ord を通らない組み込みの演算子です。
- タプル、List、Option は、要素の型が満たすときにその Trait を満たします。Ord は辞書式に比べます。
- それ以外の型は、derive か impl を書かないかぎり Eq、Ord、Show のどれも満たしません。暗黙には導出しません。
- Capability は `use E` だけが満たします。能力の型を含む型（`List[use Db]`）や関数型は満たしません。Capability を付けられるのはふつうの型引数だけです。0.28.0 では未実装です（上の「[能力の値の型](#能力の値の型)」）。

### Show の形

- 導出した Show は、ソースでその値を作る形で表します（`Circle(radius: 1.0)`、`Rect(1.0, 2.0)`、`Empty`、`(1, "a")`、`[1, 2, 3]`、`()`）。
- Bool の Show は `True` / `False`（構成子の名前）です。
- 補間で引用符を付けずに埋め込むのは最上位の String だけです。リストや構成子の中の String と、inspect の String は `"` で囲みます。
- 囲むときは `\"`、`\\`、`\n`、`\t`、`\r` と、`#{` の前の `\#` でエスケープします。それ以外の制御文字（U+0000〜U+001F、U+007F）は `\u{...}` と出します。
- 値を表示できるのは、型が Show を満たすときだけです。inspect も Show を要求します。dbg だけは Show を要求せず、どの型の値も表示します。Show を満たさない型は導出した Show と同じ形で表し、関数の値は `<fn>` と出します。

## 持たないもの

部分型（E の包含を除く）、一般の union 型と intersection 型、高カインド型、null、暗黙の型変換、動的型は持ちません。エラーの集合は、言語の中で union が現れる唯一の場所です。値として扱えるのは1つのエラーの型だけで、「NotFound か DbError のどちらか」という値の型は作れません。

- 型は名前で区別します（nominal）。無名のレコード型はありません。
- 数値の型を抽象する型引数はありません。
- 利用者が定義した型に演算子は定義できません（演算子の多重定義はない）。
- Trait は関連型、高カインド型の上の Trait、実行時の動的ディスパッチ、演算子に対応する Trait を持ちません。
- 利用者が定義する自動判定の Trait はありません。
