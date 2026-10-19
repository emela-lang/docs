---
title: FileSystem と Path
description: テキストのファイルを読み書きする FileSystem エフェクトと、そのハンドラ、パスを組み立てる Std.Path
---

`Std.FileSystem` はファイルとディレクトリをテキスト（UTF-8）で扱うエフェクトです。操作はどれも `suspend fn` で、操作ごとに起こりうるエラーだけを `fails` に書いているので、escape で受けたエラーは型から消えます。パスの文字列は `Std.Path` の純粋な関数で組み立てます。

```emela check
import Std.Platform.{Platform}
import Std.Console.{Console}
import Std.FileSystem.{FileSystem, FileNotFound}
import Std.Path

const DIR: String = "notes"

## `notes/<day>.txt` に1行足し、ファイルの行数を返す。
fn note(day: String, text: String) {
  fs = use FileSystem
  fs.create_directory(DIR)
  path = Path.join(DIR, "#{day}.txt")
  fs.append_text(path, "#{text}\n")
  String.split(fs.read_text(path), "\n") |> List.filter(fn(l) { l != "" }) |> List.length
}

## `notes/<day>.txt` の中身。なければその旨を返す。
fn show(day: String) {
  (use FileSystem).read_text(Path.join(DIR, "#{day}.txt")) escape {
    FileNotFound(path:) -> "no notes in #{path}"
  }
}

fn main() {
  with Platform {
    console = use Console
    console.print_line(String.trim(show("monday")))
    n = note("monday", "buy milk")
    console.print_line("#{n} note(s)")
    console.print_line("#{(use FileSystem).list_directory(DIR)}")
  }
}
```

```console
$ emela run main.emel
no notes in notes/monday.txt
1 note(s)
["monday.txt"]
```

`note` の推論される型は `fails FileNotFound | FileAccessDenied | NotADirectory | IsADirectory | InvalidText | FileSystemFailure use FileSystem` です。`show` は FileNotFound を escape で受けるので、残りの4つ（FileAccessDenied、IsADirectory、InvalidText、FileSystemFailure）だけが残ります。

## エフェクト

```emela
pub effect FileSystem {
  suspend fn read_text(path: String) -> String
    fails FileNotFound | FileAccessDenied | IsADirectory | InvalidText | FileSystemFailure
  suspend fn write_text(path: String, text: String) -> ()
    fails FileNotFound | FileAccessDenied | IsADirectory | FileSystemFailure
  suspend fn append_text(path: String, text: String) -> ()
    fails FileNotFound | FileAccessDenied | IsADirectory | FileSystemFailure
  suspend fn exists(path: String) -> Bool
  suspend fn is_directory(path: String) -> Bool
  suspend fn list_directory(path: String) -> List[String]
    fails FileNotFound | FileAccessDenied | NotADirectory | FileSystemFailure
  suspend fn create_directory(path: String) -> ()
    fails FileAccessDenied | NotADirectory | FileSystemFailure
  suspend fn remove(path: String) -> ()
    fails FileNotFound | FileAccessDenied | DirectoryNotEmpty | FileSystemFailure
}
```

| 操作 | 説明 |
|---|---|
| `read_text(path)` | ファイルの中身を読む |
| `write_text(path, text)` | ファイルを作るか、中身を置き換える |
| `append_text(path, text)` | ファイルの末尾に足す。なければ作る |
| `exists(path)` | パスにファイルかディレクトリがあるか。失敗しない |
| `is_directory(path)` | パスがディレクトリか。失敗しない |
| `list_directory(path)` | ディレクトリの中の名前を、名前の順に返す |
| `create_directory(path)` | ディレクトリを、親もまとめて作る |
| `remove(path)` | ファイルか空のディレクトリを消す |

操作をすべて `suspend fn` にしているのは、同期の API だと読み書きの間すべての fiber が止まるからです。そのため外部関数のコールバックの中では FileSystem を使えません。コールバックからは [Deferred](/std/state-fiber/) で fiber に合図を送り、fiber の側でファイルを扱います。Bytes の型がまだないので、バイナリは扱えません。

## エラー

| error | 意味 |
|---|---|
| `FileNotFound(path: String)` | ファイルかディレクトリがない。書くときは親のディレクトリがない |
| `FileAccessDenied(path: String)` | 権限がない |
| `NotADirectory(path: String)` | ディレクトリであるべき場所にファイルがある |
| `IsADirectory(path: String)` | ファイルであるべき場所にディレクトリがある |
| `DirectoryNotEmpty(path: String)` | 空でないディレクトリを消そうとした |
| `InvalidText(path: String)` | UTF-8 として読めない |
| `FileSystemFailure(path: String, message: String)` | それ以外のホストのエラー。`message` はホストの説明 |

どれも `pub error` なので、import して escape で受けられます（`import Std.FileSystem.{FileNotFound}`）。種類ごとに別の error にしてあるので、escape で受けたものは `fails` から消えます。1つの error に種類のフィールドを持たせると、一部の値だけを受ける腕になって `fails` に残ります。名前に `File` などを付けているのは、自分で書く `NotFound` とぶつからないようにするためです。escape の規則は [エラー](/guide/errors/) にあります。

## 振る舞い

- `write_text` はファイルを作るか上書きします。`append_text` はファイルがなければ作ります。どちらも親のディレクトリがなければ FileNotFound です。
- `create_directory` は親もまとめて作り、既にあれば何もしません。そのパスか途中にファイルがあれば NotADirectory です。
- `remove` はファイルか空のディレクトリを消します。中身ごと消す操作はありません。
- `exists` と `is_directory` は失敗しません。権限で見えないときも False です。
- `list_directory` はパスでなく名前だけを、名前の順（コードポイントの辞書順）に並べて返します。
- UTF-8 として読めないファイルは、置換文字に置き換えずに InvalidText で失敗します。読んで書き戻したときに中身が壊れないようにするためです。先頭の BOM は取り除かずに残します。
- 相対パスはプロセスの現在のディレクトリから解きます。
- パスは String のままです。正規化（`..` の解決）、絶対パスへの変換、`~` の展開はしません。

実際に SystemFileSystem で試すと、次のようになります。

```emela check
import Std.Platform.{Platform}
import Std.Console.{Console}
import Std.FileSystem.{
  FileSystem,
  FileNotFound,
  FileAccessDenied,
  NotADirectory,
  IsADirectory,
  DirectoryNotEmpty,
  FileSystemFailure,
}

fn attempt(f: fn() -> String fails FileNotFound | FileAccessDenied | NotADirectory | IsADirectory | DirectoryNotEmpty | FileSystemFailure use FileSystem) -> String use FileSystem {
  f() escape {
    FileNotFound(path:)      -> "FileNotFound(#{path})"
    NotADirectory(path:)     -> "NotADirectory(#{path})"
    IsADirectory(path:)      -> "IsADirectory(#{path})"
    DirectoryNotEmpty(path:) -> "DirectoryNotEmpty(#{path})"
    FileAccessDenied(path:)  -> "FileAccessDenied(#{path})"
    FileSystemFailure(path:, message:) -> "FileSystemFailure(#{path}, #{message})"
  }
}

fn main() {
  with Platform {
    say = (use Console).print_line
    fs = use FileSystem
    say(attempt(fn() {
      fs.write_text("missing/a.txt", "x")
      "written"
    }))
    say(attempt(fn() {
      fs.create_directory("out/sub/deep")
      fs.create_directory("out/sub/deep")
      fs.write_text("out/b.txt", "b")
      fs.write_text("out/a.txt", "a")
      "#{fs.list_directory("out")}"
    }))
    say(attempt(fn() {
      fs.create_directory("out/a.txt/x")
      "created"
    }))
    say(attempt(fn() {
      fs.remove("out/sub")
      "removed"
    }))
    say("#{fs.exists("out")} #{fs.is_directory("out/a.txt")} #{fs.exists("nothing")}")
  }
}
```

```console
$ emela run main.emel
FileNotFound(missing/a.txt)
["a.txt", "b.txt", "sub"]
NotADirectory(out/a.txt/x)
DirectoryNotEmpty(out/sub)
True False False
```

## SystemFileSystem

`SystemFileSystem` はホストのファイルシステムを使う本物のハンドラで、Platform に入っています。

| ターゲット | 実装 |
|---|---|
| JS | `node:fs/promises` |
| C | POSIX の関数を外部関数の中で同期に呼び、その場で完了する（読み書きの間はほかの fiber も止まる） |

Async に依存し、状態を持ちません。C では U+0000 を含むファイルを C の文字列で渡せないので、読むと FileSystemFailure になります。FileSystemFailure の `message` の文言はターゲットで違います。

## TestFileSystem と TestFiles

`TestFileSystem` はテスト用のハンドラです。ファイルとディレクトリを `State[TestFiles]` に置き、その場で再開するので、ディスクに触れずにテストできます。

```emela
pub type TestFiles(files: List[(String, String)], directories: List[String])
```

- `files` は、パスと中身の組をパスの順に並べたものです。書くと、この順を保って入ります。
- ディレクトリは `directories` にあるものと、`files` と `directories` にあるパスの祖先です。`a/b/c.txt` があれば `a` と `a/b` はディレクトリです。
- パスは文字列のまま比べます。`a/b` と `./a/b` は別のパスです。
- エラーは SystemFileSystem と同じ規則で起こします。FileAccessDenied、InvalidText、FileSystemFailure は起こせないので、それを試すときは小さなハンドラを自分で書きます。

```emela check
import Std.FileSystem.{FileSystem, FileNotFound, TestFileSystem, TestFiles}
import Std.State.{State}

## `from` を `to` に写し、行数を返す。
fn copy(from: String, to: String) {
  fs = use FileSystem
  text = fs.read_text(from)
  fs.write_text(to, text)
  String.split(text, "\n") |> List.length
}

@test
fn copies_a_file() {
  start = TestFiles(files: [("in/a.txt", "x\ny")], directories: ["out"])
  (n, TestFiles(files:, directories:)) = State.run(start, fn() {
    with TestFileSystem { copy("in/a.txt", "out/a.txt") }
  })
  assert n == 2
  assert files == [("in/a.txt", "x\ny"), ("out/a.txt", "x\ny")]
  assert directories == ["out"]
}

@test
fn a_missing_file_is_reported() {
  start = TestFiles(files: [], directories: [])
  (result, _) = State.run(start, fn() {
    with TestFileSystem {
      Some(copy("in/a.txt", "out/a.txt")) escape { FileNotFound(..) -> None }
    }
  })
  assert result == None
}
```

State と `State.run` は [State・Fiber・Deferred](/std/state-fiber/) に、テストの書き方は [テスト](/guide/testing/) にあります。

## Std.Path

`Std.Path` はパスの文字列を組み立てる純粋な関数を持ち、ファイルシステムには触れません。`import Std.Path` の後に `Path.join(dir, "notes.txt")` と書きます。

| 関数 | シグネチャ | 説明 |
|---|---|---|
| `join` | `join(a: String, b: String) -> String` | `a` の下の `b`。間に `/` を1つ挟む。`b` が `/` で始まれば `b` そのもの。片方が空ならもう片方 |
| `parent` | `parent(path: String) -> Option[String]` | 最後の要素を除いたパス。要素が1つのとき、`/`、空文字列は `None` |
| `file_name` | `file_name(path: String) -> Option[String]` | 最後の要素。`/`、空文字列、`.` か `..` で終わるものは `None` |
| `extension` | `extension(path: String) -> Option[String]` | ファイル名の最後の `.` より後（`.` は含まない）。`.` がないもの、先頭の `.` だけのもの（`.bashrc`）、`.` で終わるものは `None` |

- 区切りは `/` だけを扱います。Node は Windows でも `/` を受け付けます。
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
