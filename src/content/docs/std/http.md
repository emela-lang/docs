---
title: Http
description: HTTP のクライアント（Http エフェクト、SystemHttp と TestHttp）と、HTTP サービスの入口 Http.serve
---

`Std.Http` は HTTP のクライアントと、HTTP サービスの入口 `Http.serve` を持ちます。要求（`Std.Http.Request`）と応答（`Std.Http.Response`）はただの値で、クライアントの操作は `send` の1つだけです。要求を組み立てる処理はハンドラなしでテストでき、送る部分は TestHttp に差し替えればネットワークなしでテストできます。

```emela check
import Std.Http
import Std.Http.{Http, ConnectionFailed, TestHttp, TestServer}
import Std.Http.Request
import Std.Http.Request.{Request, Get}
import Std.Http.Response
import Std.Http.Response.{UnexpectedStatus}
import Std.State.{State}

const BASE: String = "https://search.example.com"

fn search_request(query: String, page: Int) -> Request {
  query_string = Request.encode_query([("q", query), ("page", Int.to_string(page))])
  Request.new(Get, "#{BASE}/search?#{query_string}") |> Request.add_header("accept", "text/plain")
}

fn first_result(query: String) {
  http <- Http
  res = http.send(search_request(query, 1)) |> Response.require_ok
  Option.or(List.head(String.split(res.body, "\n")), "")
}

@test
fn the_query_is_encoded() {
  req = search_request("東京", 2)
  assert req.url == "https://search.example.com/search?q=%E6%9D%B1%E4%BA%AC&page=2"
}

@test
fn a_404_is_not_a_failure_until_require_ok() {
  server = TestServer(respond: |_, _| Some(Response.new(404, "")), sent: [])
  (text, after) = State.run(server, || {
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

型と関数の一覧は API リファレンスの [Std.Http](/std/api/std-http/)、[Std.Http.Request](/std/api/std-http-request/)、[Std.Http.Response](/std/api/std-http-response/) にあります。

## 要求と応答

```emela
pub enum Method { Get, Head, Post, Put, Patch, Delete, Options }
pub type Request(method: Method, url: String, headers: List[(String, String)], body: String)
pub type Response(status: Int, headers: List[(String, String)], body: String)
```

`Request.new(method, url)` と `Response.new(status, body)` が、ヘッダも本文もない値を作ります。構成子とフィールドは公開されているので、`Request(body: text, ..Request.new(Post, url))` のように更新の構文で作り変えられます。

- 本文はテキストだけです。送るときは UTF-8 にし、受けるときは UTF-8 として読みます。本文の先頭の BOM は取り除きます。本文は全部を読み込んでから返します。
- ヘッダは同じ名前が並びうるので `List[(String, String)]` で持ちます。受けた応答のヘッダは名前を小文字にして名前の順に並べ、同じ名前の値は `, ` でつなぎます（`set-cookie` だけは1つずつ別の組）。`header` と `header_values` は名前を ASCII の範囲で大文字小文字を区別せずに比べます。
- `Request.encode_query` と `Request.decode_query` は、クエリ文字列とその組の並びを変換します。受けた要求の URL は `Request.path`、`Request.segments`、`Request.query` で分けて読めます。

`Std.Http` にある `Http.request`、`Http.add_header`、`Http.header`、`Http.headers`、`Http.encode_query`、`Http.require_ok`、`Http.response` は移行のために残している古い名前で、いずれ取り除かれます。`Request` と `Response` のモジュールの関数を使います。

## クライアント

```emela
pub effect Http {
  suspend fn send(request: Request) -> Response
    fails InvalidUrl | ConnectionFailed | ResponseNotText
}
```

ハンドラを書く人が実装するのは `send` だけです。よく使う形は `send` の上のふつうの関数（`Http.get(url)`、`Http.post(url, body)`）にしてあります。

- 4xx と 5xx は失敗にせず、`status` で返します。404 や 409 を見て分けたい場面が多いからで、失敗にしたいときは `Response.require_ok` を挟みます。`require_ok` は 2xx 以外を `UnexpectedStatus` にします。
- `send` が失敗するのは応答を受け取れなかったときだけです。`http:` と `https:` 以外の URL は InvalidUrl、名前解決、接続、TLS、リダイレクトの回数超えは ConnectionFailed、UTF-8 として読めない本文は ResponseNotText です。リダイレクトは自動で辿ります。
- タイムアウトの設定はありません。`Task.timeout` か `Task.race` で書きます。`send` を待っているタスクが中断されると、通信を止めます。

```emela check
import Std.Clock.{Clock}
import Std.Http
import Std.Http.{Http, InvalidUrl, ConnectionFailed, ResponseNotText}
import Std.Task

## 2秒で間に合わなければ None。
fn fetch_with_deadline(url: String) -> Option[String] uses { Http, Clock, Async } {
  Task.timeout(2000, || Http.get(url).body) escape {
    InvalidUrl(..)       -> None
    ConnectionFailed(..) -> None
    ResponseNotText(..)  -> None
  }
}
```

どのエラーも同じ値にするなら、`_` の腕1つで全部を受けられます。

### SystemHttp と TestHttp

`SystemHttp` は JS の `fetch` を使う本物のハンドラで、Platform に入っています。Async に依存し、状態を持ちません。Cookie を覚えず、プロキシの環境変数も使いません。ネイティブと WASM のターゲットにはまだ実装がなく、`send` に届くコードをそのターゲットでビルドするとコンパイルのエラーになります。

`TestHttp` はテスト用のハンドラで、`State[TestServer]` を使います。`TestServer(respond:, sent:)` の `respond` は、要求と、それより前に送った要求の数（0 から）を受けて応答を返す純粋な関数です。`None` を返すと ConnectionFailed になります。送った要求は `sent` に順に足されます。

## HTTP サービス

関数に `@entry(Http.serve)` を付けると、そのプログラムは HTTP サービスになります。ホストは要求を受けるたびにその関数を1回呼び、返した `Response` を送ります。

```emela check
import Std.Http.{Http}
import Std.Http.Request
import Std.Http.Request.{Request, Get}
import Std.Http.Response
import Std.Http.Response.{Response}

@entry(Http.serve)
pub fn app(request: Request) -> Response {
  Request.segments(request) match {
    ["hello", name] -> Response.new(200, "Hello, #{name}!")
    _               -> Response.new(404, "not found")
  }
}

@test
fn says_hello() {
  res = app(Request.new(Get, "http://localhost/hello/ada"))
  assert res.status == 200
  assert res.body == "Hello, ada!"
}
```

```console no-check
$ PORT=3000 emela run main.emel
listening on http://127.0.0.1:3000
$ curl localhost:3000/hello/ada
Hello, ada!
```

- `emela run` は既定で `127.0.0.1:8080` で待ちます。環境変数 `HOST` と `PORT` で変えられます。
- 要求ごとの呼び出しは状態を共有しません。関数の中の `with` は要求ごとに初期化と後片付けをします。
- 関数がエラーか defect で終わると、原因を標準エラーに1行書き、500 を返します。原因は応答に入りません。
- `Method` にないメソッドには 405、UTF-8 でない本文や `%` の形の誤った URL には 400 を、関数を呼ばずに返します。
- HTTP サービスはプロセスで動くので、関数の中で `with Process { ... }` を書けます。
- JS と WASM のターゲットで動きます。ネイティブのターゲットではまだ使えません。

関数は `Request` を受けて `Response` を返すふつうの関数なので、上の `says_hello` のようにテストから直接呼べます。

### 応答の後に続ける仕事

監査のログのように、応答を待たせずに続けたい仕事は `Spawn` で始めます。`Http.serve` は要求ごとに [Task.Background](/guide/concurrency/#taskbackground) を作って `Spawn` を名前で供給し、その中で関数を呼びます。

```emela check
import Std.Console.{Console}
import Std.Http.{Http}
import Std.Http.Request
import Std.Http.Request.{Request}
import Std.Http.Response
import Std.Http.Response.{Response}
import Std.Platform.{Platform}
import Std.Task.{Spawn}

fn audit(request: Request) -> () {
  console <- Console
  with Platform {
    console.print_error_line("served #{Request.path(request)}")
  }
}

@entry(Http.serve)
pub fn app(request: Request) -> Response uses { Spawn[{}, { Async }] } {
  spawn <- Spawn
  spawn.start(|| audit(request))
  Response.new(200, "ok")
}
```

- 関数が返ると、応答はすぐにホストへ渡ります。要求の処理は、background の release が仕事を待ち終えたところで終わります。
- 始めた仕事が、関数が返った後にさらに仕事を始めてもかまいません。release はそれも待ちます。
- 仕事が失敗すると、原因（`Cause.to_string`）を標準エラーに1行書きます。応答は変わりません。
- 関数の R には、ホストのエフェクト（Async と ProcessHost）のほかに Spawn を残せます。`Spawn[{}, { Async }]` は、失敗しない（E が空の）仕事を、Async だけを使って始められることを表します。仕事の中で使うハンドラは、仕事の中の with で供給します。
- Cloudflare Workers のように要求ごとの寿命を延ばす手段（`waitUntil`）があるホストでは、要求の処理の終わりをそこへ渡します。
