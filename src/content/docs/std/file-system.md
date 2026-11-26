---
title: FileSystem と Path
description: テキストのファイルを読み書きする FileSystem エフェクトとそのハンドラ、パスを組み立てる Std.Path
---

`Std.FileSystem` は、ファイルとディレクトリをテキスト（UTF-8）で扱うエフェクトです。操作はどれも `suspend fn` で、操作ごとに起こりうるエラーだけを `fails` に書いているので、escape で受けたエラーは型から消えます。パスの文字列は `Std.Path` の純粋な関数で組み立てます。

```emela check
import Std.Process.{Process}
import Std.Console.{Console}
import Std.FileSystem.{FileSystem, FileNotFound}
import Std.Path

const DIR: String = "notes"

## `notes/<day>.txt` に1行足し、ファイルの行数を返す。
fn note(day: String, text: String) {
  fs <- FileSystem
  fs.create_directory(DIR)
  path = Path.join(DIR, "#{day}.txt")
  fs.append_text(path, "#{text}\n")
  String.split(fs.read_text(path), "\n") |> List.filter(|l| l != "") |> List.length
}

## `notes/<day>.txt` の中身。なければその旨を返す。
fn show(day: String) {
  fs <- FileSystem
  fs.read_text(Path.join(DIR, "#{day}.txt")) escape {
    FileNotFound(path:) -> "no notes in #{path}"
  }
}

fn main() {
  with Process {
    console <- Console
    fs <- FileSystem
    console.print_line(String.trim(show("monday")))
    n = note("monday", "buy milk")
    console.print_line("#{n} note(s)")
    console.print_line("#{fs.list_directory(DIR)}")
  }
}
```

```console
$ emela run main.emel
no notes in notes/monday.txt
1 note(s)
["monday.txt"]
```

`note` の推論される型は `fails FileNotFound | FileAccessDenied | NotADirectory | IsADirectory | InvalidText | FileSystemFailure uses { FileSystem }` です。`show` は FileNotFound を escape で受けるので、残りの4つ（FileAccessDenied、IsADirectory、InvalidText、FileSystemFailure）だけが残ります。

操作とエラーの一覧は API リファレンスの [Std.FileSystem](/std/api/std-filesystem/) と [Std.Path](/std/api/std-path/) にあります。

## 操作

| 操作 | 説明 |
|---|---|
| `read_text(path)` | ファイルの中身を読む |
| `write_text(path, text)` | ファイルを作るか、中身を置き換える |
| `append_text(path, text)` | ファイルの末尾に足す。なければ作る |
| `exists(path)`、`is_directory(path)` | パスにあるか、ディレクトリか。失敗しない |
| `list_directory(path)` | ディレクトリの中の名前を、名前の順に返す |
| `create_directory(path)` | ディレクトリを、親もまとめて作る。既にあれば何もしない |
| `remove(path)` | ファイルか空のディレクトリを消す。中身ごと消す操作はない |

- `write_text` と `append_text` は、親のディレクトリがなければ FileNotFound です。
- `exists` と `is_directory` は、権限で見えないときも False を返します。
- UTF-8 として読めないファイルは、置換文字に置き換えずに InvalidText で失敗します。読んで書き戻したときに中身が壊れないようにするためです。先頭の BOM は残します。
- 相対パスはプロセスの現在のディレクトリから解きます。正規化（`..` の解決）、絶対パスへの変換、`~` の展開はしません。

操作がすべて `suspend fn` なのは、同期の API だと読み書きの間すべてのタスクが止まるからです。そのため外部関数のコールバックの中では FileSystem を使えません。コールバックからは Deferred でタスクに合図を送り、タスクの側でファイルを扱います（[State と Task](/std/state-task/)）。

## エラー

| error | 意味 |
|---|---|
| `FileNotFound(path:)` | ファイルかディレクトリがない。書くときは親のディレクトリがない |
| `FileAccessDenied(path:)` | 権限がない |
| `NotADirectory(path:)` | ディレクトリであるべき場所にファイルがある |
| `IsADirectory(path:)` | ファイルであるべき場所にディレクトリがある |
| `DirectoryNotEmpty(path:)` | 空でないディレクトリを消そうとした |
| `InvalidText(path:)` | UTF-8 として読めない |
| `FileSystemFailure(path:, message:)` | それ以外のホストのエラー。`message` はホストの説明 |

種類ごとに別の error にしてあるので、escape で受けたものは `fails` から消えます。1つの error に種類のフィールドを持たせると、一部の値だけを受ける腕になって `fails` に残ります。名前に `File` などを付けているのは、自分で書く `NotFound` とぶつからないようにするためです。escape の規則は [エラー](/guide/errors/) にあります。

## ハンドラ

`SystemFileSystem` はホストのファイルシステムを使う本物のハンドラで、`Std.Process` の `Process` に入っています。Async と ProcessHost に依存し、状態を持ちません。FileSystemFailure の `message` の文言はターゲットで違います。

`TestFileSystem` はテスト用のハンドラで、ファイルとディレクトリを `State[TestFiles]` に置き、その場で再開します。ディスクに触れずにテストできます。

- `TestFiles(files:, directories:)` の `files` は、パスと中身の組をパスの順に並べたものです。
- `directories` にあるものと、`files` と `directories` のパスの祖先がディレクトリです。`a/b/c.txt` があれば `a` と `a/b` はディレクトリです。
- パスは文字列のまま比べます。`a/b` と `./a/b` は別のパスです。
- エラーは SystemFileSystem と同じ規則で起こします。FileAccessDenied、InvalidText、FileSystemFailure は起こせないので、それを試すときは小さなハンドラを自分で書きます。

```emela check
import Std.FileSystem.{FileSystem, FileNotFound, TestFileSystem, TestFiles}
import Std.State.{State}

## `from` を `to` に写し、行数を返す。
fn copy(from: String, to: String) {
  fs <- FileSystem
  text = fs.read_text(from)
  fs.write_text(to, text)
  String.split(text, "\n") |> List.length
}

@test
fn copies_a_file() {
  start = TestFiles(files: [("in/a.txt", "x\ny")], directories: ["out"])
  (n, TestFiles(files:, directories:)) = State.run(start, || {
    with TestFileSystem { copy("in/a.txt", "out/a.txt") }
  })
  assert n == 2
  assert files == [("in/a.txt", "x\ny"), ("out/a.txt", "x\ny")]
  assert directories == ["out"]
}

@test
fn a_missing_file_is_reported() {
  start = TestFiles(files: [], directories: [])
  (result, _) = State.run(start, || {
    with TestFileSystem {
      Some(copy("in/a.txt", "out/a.txt")) escape { FileNotFound(..) -> None }
    }
  })
  assert result == None
}
```

State と `State.run` は [State と Task](/std/state-task/) に、テストの書き方は [テスト](/guide/testing/) にあります。

## Std.Path

`Std.Path` はパスの文字列を組み立てる純粋な関数（`join`、`parent`、`file_name`、`extension`）を持ち、ファイルシステムには触れません。

- 区切りは `/` だけを扱います。JS のホストは Windows でも `/` を区切りとして受け付けます。
- 正規化しません。`..` は解決せず、絶対パスにもしません。
- 末尾の `/` と、続けて書いた `/` は数えません。`a/b/` は `a/b` と同じです。

```emela check
import Std.Path

@test
fn builds_paths() {
  assert Path.join("notes", "a.txt") == "notes/a.txt"
  assert Path.join("notes/", "a.txt") == "notes/a.txt"
  assert Path.join("notes", "/etc/hosts") == "/etc/hosts"
  assert Path.parent("a/b.txt") == Some("a")
  assert Path.parent("/a") == Some("/")
  assert Path.parent("a.txt") == None
  assert Path.file_name("a/b/") == Some("b")
  assert Path.file_name("a/..") == None
  assert Path.extension("a/b.tar.gz") == Some("gz")
  assert Path.extension(".bashrc") == None
  assert Path.extension("b.") == None
}
```
