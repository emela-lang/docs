---
title: JSON と Dynamic
description: 形式に依らない値 Dynamic と Encode・Decode の導出、Std.Json での読み書き、型の形を表す Std.Shape
---

プログラムの外から来る値と外へ出す値は、形式に依らない値 `Dynamic`（`Std.Dynamic`）を通して変換します。Encode は値を Dynamic にし、Decode は Dynamic から値を作ります。どちらも `derive` で導出できます。`Std.Json` は JSON の文字列と Dynamic の間だけを受け持ちます。

```emela check
import Std.Json
import Std.Json.{SyntaxError}
import Std.Dynamic.{Encode, Decode, DecodeError}

enum Status {
  Active
  Suspended(reason: String)
} derive Eq, Encode, Decode

type Account(id: Int, @key("display_name") name: String, email: Option[String], status: Status)
  derive Eq, Encode, Decode

fn read_account(text: String) -> Option[Account] {
  Some(Json.decode(text)) escape {
    DecodeError(..) -> None
    SyntaxError(..) -> None
  }
}

fn main() {
  ada = Account(id: 1, name: "Ada", email: None, status: Suspended(reason: "spam"))
  text = Json.encode(ada)
  dbg(text)
  dbg(read_account(text) == Some(ada)) # True
  bob = read_account(
    """
    {"id": 2, "display_name": "Bob", "email": "bob@example.com", "status": {"tag": "Active"}}
    """,
  )
  _ = dbg(bob)
}
```

```console
$ emela run main.emel
"{\"display_name\":\"Ada\",\"id\":1,\"status\":{\"tag\":\"Suspended\",\"value\":{\"reason\":\"spam\"}}}"
True
Some(Account(id: 2, name: "Bob", email: Some("bob@example.com"), status: Active))
```

`Json.decode` の型引数は、結果を受ける側の型（ここでは `read_account` の返り値の `Option[Account]`）から決まります。型と関数の一覧は API リファレンスの [Std.Json](/std/api/std-json/)、[Std.Dynamic](/std/api/std-dynamic/)、[Std.Shape](/std/api/std-shape/) にあります。

## Dynamic

```emela
pub enum Dynamic {
  Null
  Bool(Bool)
  Number(Number)
  Text(String)
  Items(List[Dynamic])
  Fields(Map[String, Dynamic])
  Binary(Bytes)
}
```

- `Number` は `Std.Dynamic.Number` の値で、整数と小数をまとめて持ちます。Int や Float への変換で範囲を確かめます。
- `Fields` は Map なので、キーの順は Map の順（キーの昇順）です。`Json.encode` が書くオブジェクトのキーも昇順に並びます。
- JSON にはバイト列がないので、`Binary` は Base64 の文字列として書きます。読むと `Text` になります。

## 導出される形

`derive Encode, Decode` は、型の構造から次の形を作ります。

| Emela の値 | Dynamic（JSON） |
|---|---|
| フィールドを持つ型 | フィールド名をキーにしたオブジェクト |
| 中身のない enum の値 | `{"tag": "Active"}` |
| 名前付きのフィールドを持つ enum の値 | `{"tag": "Suspended", "value": {"reason": "spam"}}` |
| 位置のフィールドを持つ enum の値 | `{"tag": "Pair", "value": [1, 2]}` |
| `Option` のフィールド | `None` ならキーを書かない。読むときはキーがないか `null` なら `None` |
| `List`、`Array`、`Set` | 配列 |
| `Map[K, V]` | オブジェクト。キーの型は `ObjectKey` を持つ（`String` と、`derive ObjectKey` した中身のない enum など） |
| NaN と ±Infinity の Float | `null` |

- フィールドに `@key("display_name")` を付けると、その名前をキーにします。enum の値に `@tag("...")` を付けると、`tag` の値を変えます。
- 読むときは、型にないキーを無視します。
- opaque な型には Decode を導出できません。導出した Decode は、モジュールの関数を通らずに値を作ってしまうからです。opaque な型には `impl` を手で書きます（後述）。

## 読むときのエラー

`Json.decode` は最初の誤りで止まり、`DecodeError` で失敗します。`Json.decode_all` は全部のフィールドを読んで、誤りをまとめた `DecodeErrors` で失敗します。入力に返すエラーの文面を作るときは `decode_all` を使います。JSON として読めない入力は、どちらも `SyntaxError` です。

```emela check
import Std.Json
import Std.Json.{SyntaxError}
import Std.Dynamic.{Decode, DecodeError, DecodeErrors}

type Signup(name: String, age: Int, newsletter: Bool) derive Decode

fn validate(text: String) -> List[String] fails DecodeErrors | SyntaxError {
  _: Signup = Json.decode_all(text)
  []
}

fn problems(text: String) -> List[String] {
  validate(text) escape {
    DecodeErrors(errors:)          -> List.map(errors, |e| "#{e}")
    SyntaxError(message:, offset:) -> ["#{message} at #{offset}"]
  }
}

fn main() {
  dbg(problems("{\"name\": 7, \"age\": \"x\", \"newsletter\": true}"))
  dbg(problems("{\"name\": \"ada\", \"age\": 36, \"newsletter\": false}"))
  _ = dbg(problems("{\"name\": "))
}
```

```console
$ emela run main.emel
["expected: text, actual: number at .name", "expected: number, actual: text at .age"]
[]
["unexpected end of input at 9"]
```

`DecodeError(expected:, actual:, path:)` の `path` は、誤りのある場所までのキーと位置の並びです。表示は `actual` の中身でなく種類だけを書くので、入力をそのままログに出しません。

## 手で読む、手で書く

型に合わない形の入力は、`Json.parse` で Dynamic にしてから、`Std.Dynamic` の関数で読みます。`Dynamic.field(value, name, decoder)` はオブジェクトのキーを読み、`Dynamic.list`、`Dynamic.optional`、`Dynamic.dict` は要素を読む関数から、並びや Option や Map を読む関数を作ります。

`impl` で Decode を手で書けば、opaque な型も `Json.decode` で読めます。

```emela check
import Std.Json
import Std.Json.{SyntaxError}
import Std.Dynamic
import Std.Dynamic.{Dynamic, Decode, DecodeError}

## 1 以上の数量。
pub opaque type Quantity(count: Int)

impl Quantity: Decode {
  fn from_dynamic(d) {
    n = Dynamic.int(d)
    if n < 1 { fail DecodeError(expected: "a positive number", actual: d, path: []) }
    Quantity(count: n)
  }
}

type Line(item: String, quantity: Quantity) derive Decode

fn total(text: String) -> Int fails DecodeError | SyntaxError {
  lines: List[Line] = Json.decode(text)
  List.fold(lines, from: 0, f: |sum, line| sum + line.quantity.count)
}

fn tags(text: String) -> List[String] fails DecodeError | SyntaxError {
  Dynamic.field(Json.parse(text), "tags", Dynamic.list(Dynamic.string))
}

fn main() {
  dbg(total("[{\"item\": \"pen\", \"quantity\": 2}, {\"item\": \"ink\", \"quantity\": 3}]")) # 5
  zero = "[{\"item\": \"pen\", \"quantity\": 0}]"
  message = "#{total(zero)}" escape {
    DecodeError(expected:, actual: _, path:) -> "expected #{expected} at #{path}"
    SyntaxError(..)                          -> "not JSON"
  }
  dbg(message) # "expected a positive number at [Index(0), Key(\"quantity\")]"
  _ = dbg(tags("{\"tags\": [\"a\", \"b\"], \"other\": 1}")) # ["a", "b"]
}
```

書く側は `Encode` の `to_dynamic` を手で実装し、`Dynamic.object([("key", value)])` などで Dynamic を組み立てます。`Json.to_string` は Dynamic を JSON の文字列にします。

## Std.Shape

`Std.Shape` は、値がなくても型のすべての値を表す「形」です。フィールド、enum の値、中に入る型を持ちます。`derive Shaped` で導出でき、`Shape.of_value(value)` や `Shape.of_parameter(f)` で取り出します。JSON Schema のような説明を作るときや、ルーターが関数の入力の型を読むときに使います。

```emela check
import Std.Shape
import Std.Shape.{Shaped}

type Point(x: Int, y: Option[Int]) derive Shaped

fn main() {
  _ = dbg(Shape.of_value(Point(x: 1, y: None)))
}
```

```console
$ emela run main.emel
Record(name: "Point", fields: [Field(name: "x", shape: Int), Field(name: "y", shape: Option(Int))])
```

形には読む側への注記（`Shape.description`、`Shape.minimum` など）を付けられます。読む側は、知らない注記をそのまま渡します。
