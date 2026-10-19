---
title: Http
description: HTTP のクライアント Std.Http の型、エラー、send の上の関数、SystemHttp と TestHttp
---

`Std.Http` は HTTP のクライアントです。操作は `send` の1つだけで、要求と応答はただの値です。要求を組み立てる処理はハンドラなしでテストでき、送る部分は TestHttp に差し替えればネットワークなしでテストできます。

```emela check
import Std.Http
import Std.Http.{Http, Get, Request, ConnectionFailed, UnexpectedStatus, TestHttp, TestServer}
import Std.State.{State}

const BASE: String = "https://search.example.com"

fn search_request(query: String, page: Int) -> Request {
  query_string = Http.encode_query([("q", query), ("page", Int.to_string(page))])
  Http.request(Get, "#{BASE}/search?#{query_string}") |> Http.add_header("accept", "text/plain")
}

fn first_result(query: String) {
  res = (use Http).send(search_request(query, 1)) |> Http.require_ok
  Option.or(List.head(String.split(res.body, "\n")), "")
}

@test
fn the_query_is_encoded() {
  req = search_request("東京", 2)
  assert req.url == "https://search.example.com/search?q=%E6%9D%B1%E4%BA%AC&page=2"
}

@test
fn a_404_is_not_a_failure_until_require_ok() {
  server = TestServer(respond: fn(req, n) { Some(Http.response(404, "")) }, sent: [])
  (text, after) = State.run(server, fn() {
    with TestHttp {
      first_result("x") escape {
        UnexpectedStatus(status:, body: _) -> "status #{status}"
        ConnectionFailed(url: _, message:) -> "unreachable: #{message}"
      }
    }
  })
  assert text == "status 404"
  assert List.length(after.sent) == 1
}
```

## 型

```emela
pub enum Method { Get, Head, Post, Put, Patch, Delete, Options }
pub type Request(method: Method, url: String, headers: List[(String, String)], body: String)
pub type Response(status: Int, headers: List[(String, String)], body: String)
```

| 型 | 説明 |
|---|---|
| `Method` | 送れるメソッド。一覧にないメソッドは送れない |
| `Request` | 要求。ヘッダは書いた順に送る。本文は UTF-8 で送る |
| `Response` | 応答。`status` は状態コード、`body` は本文のテキスト |

構成子とフィールドは公開されているので、`Request(body: text, ..Http.request(Post, url))` のように更新の構文で作り変えられます。

## エラー

| error | 意味 |
|---|---|
| `InvalidUrl(url: String)` | URL として読めない。scheme が `http:` と `https:` 以外のものも |
| `ConnectionFailed(url: String, message: String)` | 応答を受け取れなかった（名前解決、接続、TLS、リダイレクトの回数超え）。`message` に理由 |
| `ResponseNotText(url: String)` | 応答の本文が UTF-8 として読めない |
| `UnexpectedStatus(status: Int, body: String)` | `require_ok` で、状態コードが 2xx でない |

## エフェクト

```emela
pub effect Http {
  suspend fn send(request: Request) -> Response
    fails InvalidUrl | ConnectionFailed | ResponseNotText
}
```

ハンドラを書く人が実装するのは `send` だけです。よく使う形は `send` の上のふつうの関数にしてあります。

## 関数

| 関数 | シグネチャ | 説明 |
|---|---|---|
| `request` | `request(method: Method, url: String) -> Request` | ヘッダなし、本文なしの要求 |
| `add_header` | `add_header(req: Request, name: String, value: String) -> Request` | ヘッダを末尾に足す |
| `get` | `get(url: String) -> Response fails InvalidUrl \| ConnectionFailed \| ResponseNotText use Http` | GET を送る |
| `post` | `post(url: String, body: String) -> Response fails InvalidUrl \| ConnectionFailed \| ResponseNotText use Http` | 本文つきの POST を送る |
| `header` | `header(res: Response, name: String) -> Option[String]` | 名前の合う最初のヘッダの値 |
| `headers` | `headers(res: Response, name: String) -> List[String]` | 名前の合うすべてのヘッダの値を順に |
| `encode_query` | `encode_query(pairs: List[(String, String)]) -> String` | 各部分をパーセント符号化したクエリ（`q=%E6%9D%B1&page=2`） |
| `require_ok` | `require_ok(res: Response) -> Response fails UnexpectedStatus` | 2xx ならそのまま返し、それ以外は fail する |
| `response` | `response(status: Int, body: String) -> Response` | ヘッダなしの応答。TestServer で使う |

`header` と `headers` は名前を ASCII の範囲で大文字小文字を区別せずに比べます。`encode_query` は JS の `encodeURIComponent` を純粋な外部関数として呼びます。URL を部品に分ける型はありません。

## 振る舞い

- 本文はテキストだけを扱います。送るときは UTF-8 にし、受けるときは UTF-8 として読み、読めなければ ResponseNotText です。本文の先頭の BOM は取り除きます。本文は全部を読み込んでから返します（ストリームは後の版）。
- content-type を書かなければ `text/plain;charset=UTF-8` で送ります。
- ヘッダは `List[(String, String)]` で持ちます。Map が 0.21 なのと、同じ名前のヘッダが複数並ぶためです。応答のヘッダは名前を小文字にして名前の順に並べ、同じ名前の値は `, ` でつなぎます。`set-cookie` だけは1つずつ別の組にします。
- 4xx と 5xx は失敗にせず、`status` で返します。404 や 409 を見て分けたい場面が多いからで、失敗にしたいときは `require_ok` を挟みます。
- 失敗にするのは応答を受け取れなかったときだけで、名前解決、接続、TLS、リダイレクトの回数超えはどれも ConnectionFailed にまとめます。リダイレクトは自動で辿ります。
- GET と HEAD の空の本文は本文なしで送ります。GET と HEAD に空でない本文を書いたときと、正しくないヘッダは ConnectionFailed です。
- タイムアウトの設定はありません。`Fiber.timeout` か `Fiber.race` で書きます。`send` を待っている fiber が中断されると、通信を止めます（AbortSignal）。

`Fiber.timeout` で包んだ `Http.get` のエラーを escape で受けるときも、腕にはエラーの構成子を書きます。`_` で全部は受けられません。

```emela check=error
import Std.Clock.{Clock}
import Std.Fiber
import Std.Http
import Std.Http.{Http}

fn fetch_with_deadline(url: String) -> Option[String] use { Http, Clock, Async } {
  Fiber.timeout(2000, fn() { Http.get(url).body }) escape {
    _ -> None
  }
}
```

```text
escape arms must match an error constructor
```

受けるエラーを並べて書きます。

```emela check
import Std.Clock.{Clock}
import Std.Fiber
import Std.Http
import Std.Http.{Http, InvalidUrl, ConnectionFailed, ResponseNotText}

## 2秒で間に合わなければ None。
fn fetch_with_deadline(url: String) -> Option[String] use { Http, Clock, Async } {
  Fiber.timeout(2000, fn() { Http.get(url).body }) escape {
    InvalidUrl(..)       -> None
    ConnectionFailed(..) -> None
    ResponseNotText(..)  -> None
  }
}
```

## SystemHttp

`SystemHttp` は JS の `fetch` を使う本物のハンドラで、Platform に入っています。

Async に依存し、状態を持ちません。Cookie を覚えず、プロキシの環境変数も使いません。C のターゲットの実装はまだなく、`--target c` で `send` に届くコードをビルドするとコンパイルのエラーになります。

```emela check
import Std.Platform.{Platform}
import Std.Console.{Console}
import Std.Http
import Std.Http.{Http, InvalidUrl, ConnectionFailed, ResponseNotText}

fn status_of(url: String) -> String use Http {
  "#{Http.get(url).status}" escape {
    InvalidUrl(url:)                   -> "InvalidUrl(#{url})"
    ConnectionFailed(url: _, message:) -> "ConnectionFailed(#{message})"
    ResponseNotText(url:)              -> "ResponseNotText(#{url})"
  }
}

fn main() {
  with Platform {
    console = use Console
    console.print_line(status_of("ftp://example.com/"))
    console.print_line(status_of("http://127.0.0.1:1/"))
  }
}
```

```console
$ emela run main.emel
InvalidUrl(ftp://example.com/)
ConnectionFailed(fetch failed: bad port)
```

## TestHttp と TestServer

`TestHttp` はテスト用のハンドラです。相手のサーバーを `State[TestServer]` に置き、その場で再開します。

```emela
pub type TestServer(respond: fn(Request, Int) -> Option[Response], sent: List[Request])
```

- `respond` は、要求と、それより前に送られた要求の数（0 から）を受けて応答を返す純粋な関数です。`None` を返すと ConnectionFailed になります。
- `sent` に、送られた要求を順に足します。`State.run` が返す最後の状態で確かめます。
- InvalidUrl と ResponseNotText は起こせません。
- 遅い応答は作れません。時間の絡むテストは [TestClock](/std/platform/) で書きます。

```emela check
import Std.Http
import Std.Http.{Http, Post, Request, Response, ConnectionFailed, UnexpectedStatus, TestHttp, TestServer}
import Std.State.{State}

const API: String = "https://api.example.com"

## todo を作り、新しいリソースの URL を返す。
fn create_todo(title: String) {
  req = Request(body: title, ..Http.request(Post, "#{API}/todos"))
    |> Http.add_header("content-type", "text/plain")
  res = (use Http).send(req) |> Http.require_ok
  Option.or(Http.header(res, "Location"), "")
}

fn created(req: Request, n: Int) -> Option[Response] {
  Some(Response(status: 201, headers: [("location", "#{API}/todos/#{n + 1}")], body: ""))
}

@test
fn returns_the_location() {
  server = TestServer(respond: created, sent: [])
  (url, after) = State.run(server, fn() { with TestHttp { create_todo("buy milk") } })
  assert url == "https://api.example.com/todos/1"
  assert List.map(after.sent, fn(r) { r.body }) == ["buy milk"]
}

@test
fn a_500_fails_with_unexpected_status() {
  server = TestServer(respond: fn(req, n) { Some(Http.response(500, "oops")) }, sent: [])
  (result, _) = State.run(server, fn() {
    with TestHttp {
      create_todo("x") escape {
        UnexpectedStatus(status:, body: _) -> "status #{status}"
      }
    }
  })
  assert result == "status 500"
}

@test
fn no_answer_is_connection_failed() {
  server = TestServer(respond: fn(req, n) { None }, sent: [])
  (result, _) = State.run(server, fn() {
    with TestHttp {
      create_todo("x") escape {
        ConnectionFailed(url: _, message:) -> message
        UnexpectedStatus(..)               -> "status"
      }
    }
  })
  assert result == "TestServer returned no response"
}
```

`main` で `with Platform, TestHttp { ... }` と書けば、Platform の SystemHttp だけを TestHttp に置き換えられます（`State.run` の中で）。

:::caution[0.21 で入る予定]
Http のサーバーは 0.21 で、fiber の上に作ります。同時に走る数の上限（`Semaphore`）も 0.21 です。0.20 の `Std.Http` はクライアントだけです。
:::
