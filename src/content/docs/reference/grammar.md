---
title: 文法
description: Emela 0.20 の EBNF。字句、モジュールと宣言、型、式、パターンと、文法の外で課す制約
---

Emela の構文を EBNF で書いたものです。仕様の決定をそのまま EBNF に落とした初版で、formatter の実装で曖昧さを洗い出し、適合テストとともに確定させていきます。

字句の細かな規則（名前のクラス、エスケープ、行の継続）は [字句と予約語](/reference/lexical/) にあります。

## 記法

- `{ x }` は0回以上の繰り返し、`[ x ]` は省略可能、`|` は選択を表します。引用符で囲んだものは終端記号です。
- `NL` は、文の区切りとして働く改行です（[字句と予約語](/reference/lexical/) の行の継続規則）。継続と判定された改行、`(` `[` の内側の改行、効果の集合（`use { ... }`）の波括弧の内側の改行は、字句解析の段階で取り除かれます。
- 並びの末尾のカンマはどこでも許されます。規則では省略しています。

括弧の役割は種類ごとに決まっています。`xs[0]` のような添字の構文はありません。

| 括弧 | 役割 |
|---|---|
| `( )` | 値の世界: 関数の呼び出し、構築、パターン、フィールドの宣言、タプル |
| `[ ]` | 型引数とリストリテラル |
| `{ }` | ブロックと宣言の本体 |

```emela check
type Point(
  x: Int,
  y: Int,      # 末尾のカンマ
)

fn main() {
  xs = [1, 2, 3,]
  dbg(Point(x: 1, y: 2,))
  dbg(xs)
}
```

## 字句

字句は最長一致で切ります。`""""` は `"""` と `"` であり、空の文字列 `""` を2つ並べたものとは読みません。

```ebnf
lower_name = ( "a".."z" | "_" ) { letter | digit | "_" }      (* 予約語を除く *)
type_name  = "A".."Z" { letter | digit }                      (* 小文字を1つ以上含む *)
upper_name = "A".."Z" { "A".."Z" | digit | "_" }

dec_lit    = digit { digit | "_" }
int_lit    = dec_lit
           | "0x" hex_digit { hex_digit | "_" }
           | "0b" ( "0" | "1" ) { "0" | "1" | "_" }
float_lit  = dec_lit "." dec_lit [ ( "e" | "E" ) [ "+" | "-" ] dec_lit ]
string_lit = '"' { char | escape | "#{" expr "}" } '"'
           | '"""' NEWLINE { line } '"""'                (* 複数行。インデントの規則は「字句と予約語」 *)
escape     = '\\' ( '"' | '\\' | "n" | "t" | "r" | "#" | "u{" hex_digit { hex_digit } "}" )
literal    = int_lit | float_lit | string_lit
```

- `letter` と `digit` は ASCII に限ります。
- `char` は `"`、`\`、改行を除く文字です。`hex_digit` は `0`〜`9`、`a`〜`f`、`A`〜`F` です。
- `1..2` は `dec_lit ".." dec_lit`、`1.x` は `dec_lit "." lower_name` と読みます。小数点の後に数字がなければ浮動小数点にしません。

## モジュールと宣言

```ebnf
module       = { import NL } { decl NL }

import       = "import" module_path [ "." "{" import_item { "," import_item } "}" ]
module_path  = type_name { "." type_name }
import_item  = lower_name | type_name | upper_name

decl         = { annotation NL } [ "pub" [ "opaque" ] ] item
             | impl_decl
item         = fn_decl | type_decl | enum_decl | error_decl | const_decl
             | effect_decl | handler_decl | layer_decl | trait_decl

annotation   = "@" lower_name [ "(" annot_arg { "," annot_arg } ")" ]
annot_arg    = lower_name | literal | lower_name ":" literal

fn_decl      = [ "suspend" ] "fn" lower_name [ type_params ]
               "(" [ params ] ")" [ signature ] [ block ]
signature    = [ "->" type [ "fails" error_set ] ] [ "use" effect_set ]
params       = param { "," param }
param        = "self" | lower_name [ ":" type ]

type_params  = "[" type_param { "," type_param } "]"
type_param   = ( upper_name | type_name ) [ ":" bound { "+" bound } ]
bound        = type_ref

type_decl    = "type" type_name [ type_params ] [ "(" [ fields ] ")" ] [ derive ]
enum_decl    = "enum" type_name [ type_params ] "{" variant { sep variant } "}" [ derive ]
variant      = type_name [ "(" ( fields | type { "," type } ) ")" ]
error_decl   = "error" type_name [ "(" [ fields ] ")" ]
fields       = field { "," field }
field        = { annotation } lower_name ":" type
derive       = "derive" type_ref { "," type_ref }
sep          = "," | NL

const_decl   = "const" upper_name [ ":" type ] "=" expr

effect_decl  = "effect" type_name [ type_params ] "{" { op_sig NL } "}"
             | "effect" type_name "of" type_ref [ "default" ]      (* ラベル *)
op_sig       = [ "suspend" ] "fn" lower_name [ type_params ] "(" [ params ] ")"
               "->" type [ "fails" error_set ]     (* type_params は組み込みのエフェクトだけ *)

handler_decl = "handler" type_name [ "(" [ fields ] ")" ]
               "implements" type_ref [ "[" type { "," type } "]" ] "{" { handler_item NL } "}"
handler_item = "init" block
             | "release" block
             | [ "suspend" ] "fn" lower_name "(" [ lower_name { "," lower_name } ] ")" block

layer_decl   = "layer" type_name "{" type_ref { sep type_ref } "}"

trait_decl   = "trait" type_name [ ":" bound { "+" bound } ] "{" { trait_item NL } "}"
trait_item   = "fn" lower_name "(" [ params ] ")" [ signature ] [ block ]
             | derive_rule                                    (* 構文は未確定 *)

impl_decl    = "impl" type_ref "for" type "{" { impl_item NL } "}"
impl_item    = "fn" lower_name "(" [ params ] ")" block
```

宣言を一通り並べると、次のようになります。

```emela check
import Std.Console.{Console, SystemConsole}

error NotFound(id: Int)

enum Shape {
  Circle(radius: Float)
  Rect(Float, Float)
}

const LIMIT = 10

effect Counter {
  fn next() -> Int
}

handler FixedCounter implements Counter {
  fn next() { LIMIT }
}

layer AppTest {
  FixedCounter
  SystemConsole
}

pub fn area(s: Shape) -> Float {
  s match {
    Circle(radius:) -> 3.14 * radius * radius
    Rect(w, h) -> w * h
  }
}

fn main() {
  with AppTest {
    n = (use Counter).next()
    (use Console).print_line("#{n} #{area(Rect(2.0, 3.0))}")
  }
}
```

### 宣言についての文法の外の制約

- import は宣言より前に置きます。宣言より後ろの import は E0127 です（コメントは数えません）。
- type_decl は型と同じ名前の構成子を1つ定義します。バリアントが1つの enum と同じものです。
- 1つのバリアントの中で、名前のないフィールドと名前付きのフィールドは混ぜられません（E0128）。
- 本体のない fn_decl と、トップレベルの suspend fn は、`@external` が付いている場合にだけ許されます（E0130）。trait_item の fn は既定の実装を持たなくてよく、この制約は掛かりません。
- `opaque` は type と enum にだけ付けられます（E0131）。
- フィールドのない type_decl は、`@external` が付いている場合にだけ許されます（E0130）。
- enum_decl は1つ以上のバリアントを持ちます（E0132）。値を持たない型は Never だけです。
- type_decl と enum_decl の直後の改行に `derive` が続くとき、その改行は区切りにならず、derive は宣言の続きになります。間の空行とコメントだけの行は飛ばします（行の継続の判定と同じ）。`derive` は文脈依存の語なので、字句の継続規則には入れず、宣言の位置でだけ扱います。

```emela check=error
fn host_now() -> Int    # error[E0130]: 本体のない fn には @external が要る
```

```emela check=error
enum Empty {}           # バリアントが1つもない
```

## 型

```ebnf
type       = type_ref [ "[" type_arg { "," type_arg } "]" ]
           | upper_name                                       (* 型引数 *)
                                                              (* 型名の型引数は type_ref の形で書き、名前解決で区別する *)
           | "Self"
           | "(" ")"                                          (* Unit *)
           | "(" type ")"                                     (* 括弧 *)
           | "(" type "," type { "," type } ")"               (* タプル *)
           | "fn" "(" [ type { "," type } ] ")" "->" type
             [ "fails" error_set ] [ "use" effect_set ]
type_ref   = [ module_path "." ] type_name

type_arg   = type
           | "{" [ effect_item { "," effect_item } ] "}"          (* 効果の集合。{} は空の集合 *)
           | error_item "|" error_item { "|" error_item }          (* エラーの集合 *)

error_set  = "{" "}" | error_item { "|" error_item }
error_item = type_ref | upper_name                            (* エラーのタグか、集合の型引数。混ぜてよい *)
effect_set = "{" [ effect_item { "," effect_item } ] "}" | type_ref | upper_name
effect_item = type_ref [ "[" type { "," type } "]" ] | upper_name   (* エフェクト（型引数つきでよい）か、集合の型引数。混ぜてよい *)
```

```emela check
error Timeout

effect Log {
  fn info(msg: String) -> ()
}

type Job[E, R](run: fn() -> Int fails E use R)

fn twice[E](f: fn() -> Int fails Timeout | E) -> Int fails Timeout | E {
  f() + f()
}

fn start(job: Job[Timeout, { Log }]) -> Int fails Timeout use { Log } {
  job.run()
}

fn pair() -> (Int, fn(Int) -> Int fails {} use {}) {
  (1, fn(x) { x + 1 })
}
```

要素1個のタプルはありません。型の `(T)` はただの括弧です。

集合の型引数の扱い（どの型引数が集合を受けるか）は文法では決めず、型検査で確かめます（[型と効果の体系](/reference/type-system/)）。

## 式

```ebnf
block      = "{" { stmt NL } "}"
stmt       = binding | expr
binding    = pattern [ ":" type ] "=" expr

expr       = "fail" expr
           | "assert" expr
           | pipe_expr { ( "escape" | "match" ) "{" { arm NL } "}" }

pipe_expr  = or_expr  { "|>" or_expr }
or_expr    = and_expr { "||" and_expr }
and_expr   = cmp_expr { "&&" cmp_expr }
cmp_expr   = add_expr [ ( "==" | "!=" | "<" | "<=" | ">" | ">=" ) add_expr ]
add_expr   = mul_expr { ( "+" | "-" ) mul_expr }
mul_expr   = unary    { ( "*" | "/" | "%" ) unary }
unary      = ( "!" | "-" ) unary
           | "use" type_ref [ "[" type { "," type } "]" ]
           | postfix
postfix    = primary { "(" [ args ] ")" | "." lower_name }

primary    = literal | lower_name | upper_name | type_ref | "self"
           | "(" ")"
           | "(" expr ")"
           | "(" expr "," expr { "," expr } ")"
           | "[" [ expr { "," expr } [ "," ".." expr ] ] "]"
           | block | if_expr | with_expr | lambda

args       = arg { "," arg } [ "," ".." expr ]
           | ".." expr
arg        = expr | lower_name ":" [ expr ]

if_expr    = "if" expr block [ "else" ( block | if_expr ) ]
arm        = pattern [ "if" expr ] "->" expr
with_expr  = "with" with_item { "," with_item } block
with_item  = type_ref [ "by" type_ref [ "[" type { "," type } "]" ] ]   (* by はラベル *)
lambda     = "fn" "(" [ params ] ")" block
```

`cmp_expr` は比較演算子を1つしか持てないので、`a < b < c` は書けません（E0119）。比較のほかの二項演算子と `|>` は左結合です。`escape` と `match` は後置で、続けて何度でも書けます。

```emela check
error NotFound(id: Int)

type User(id: Int, name: String)

fn find(id: Int) -> User fails NotFound {
  if id == 1 { User(id: 1, name: "alice") } else { fail NotFound(id:) }
}

fn main() {
  user = find(2) escape {
    NotFound(id:) -> User(id:, name: "guest")
  }
  renamed = User(name: "bob", ..user)    # 部分更新
  xs = [1, 2, ..[3, 4]]
  label = renamed.id match {
    n if n > 1 -> "many"
    _ -> "one"
  }
  dbg((renamed, xs, label))
}
```

### 式についての文法の外の制約

- ブロックの最後の文が式のとき、その値がブロックの値になります。最後が束縛のとき、ブロックの値は `()` です。
- 文が束縛か式かは、パターンとして読める並びの直後に `=` または `:` があるかで区別します。左辺がパターンとして読めなければ E0125 です。
- `use X` の操作をその場で呼ぶときは、`(use X).op(...)` と括弧で囲みます（E0121）。
- 引数の並びでは名前付き引数の後に位置引数を書けません（E0120）。
- 引数の並びの末尾の `..式` は、構成子の部分更新です（[データ](/guide/data/)）。関数の呼び出しに書くとエラーになります。部分更新で変えるフィールドは名前付きで書き、位置では書けません（E0223）。
- 式の `(x)` はただの括弧で、要素1個のタプルにはなりません。
- リストのリテラルの `..式` は末尾に1回だけ書けます。`[x, y, ..rest]` は `rest` の前に `x`、`y` を付けたリストです。`..` の後は名前に限らず任意の式でよく（`[x, ..List.tail(xs)]`）、要素なしの `[..rest]`（E0115）と、途中や複数の `..`（`[..a, ..b]`）は書けません。

```emela check=error
fn main() {
  a = [1]
  b = [..a]      # error[E0115]: .. の前に要素が要る
}
```

```emela check=error
fn connect(host: String, port: Int) -> String { host }

fn main() {
  connect(host: "localhost", 8080)    # error[E0120]: 名前付きの後に位置引数
}
```

## パターン

```ebnf
pattern  = "_"
         | lower_name
         | literal
         | "-" ( int_lit | float_lit )      (* 負の数。パターンだけ *)
         | upper_name
         | type_ref [ "(" pat_args ")" ]
         | "(" ")"
         | "(" pattern "," pattern { "," pattern } ")"
         | "[" "]"
         | "[" pattern { "," pattern } [ "," ".." [ lower_name ] ] "]"

pat_args = ".."
         | pat_arg { "," pat_arg } [ "," ".." ]
pat_arg  = pattern | lower_name ":" [ pattern ]
```

```emela check
const ZERO = 0

type User(id: Int, name: String, admin: Bool)

fn sign(n: Int) -> String {
  n match {
    ZERO -> "zero"
    -1 -> "minus one"
    _ -> "other"
  }
}

fn describe(xs: List[Int]) -> String {
  xs match {
    [] -> "empty"
    [x] -> "one: #{x}"
    [x, ..rest] -> "first #{x}, then #{rest}"
  }
}

fn is_admin(u: User) -> Bool {
  u match {
    User(admin: True, ..) -> True
    User(..) -> False
  }
}

fn main() {
  dbg((sign(-1), describe([1, 2]), is_admin(User(id: 1, name: "a", admin: True))))
}
```

- パターンの `(a)` は書けません。要素1個のタプルはありません。
- 1つのパターンか引数の並びで、同じ名前を2回束縛すると E0220 です。
- パターンの文字列に補間は書けません（E0117）。
- パターンの `..` は最後に置きます（E0114）。
- 名前付きフィールドの構成子のパターンで、`..` を書かずにフィールドを省くことはできません（E0308）。
