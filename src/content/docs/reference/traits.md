---
title: トレイト
description: trait・impl・境界・孤児規則・演算子・Monoid・単相化
---

型が満たす **特性（trait）** を宣言し、その実装 `impl` を与え、ジェネリック関数に **境界（bound）**
として要求します。trait・impl・境界はすべて **単相化で静的に discharge** され、typed IR には
型変数・trait・辞書が一切現れません（[エフェクトの handler](/reference/effects/#handlerdischargeerasure) と同じ erasure）。

## 用語

| 用語 | 定義 |
|---|---|
| **trait** | 型が提供すべきメソッド（関連関数）のシグネチャの集合。 |
| **`Self`** | trait / impl の内側でのみ有効な予約型名。「この trait を実装する型」を指す。 |
| **impl** | `impl Trait for Type { ... }`。ある型が trait を満たすことと、その実装本体。 |
| **境界（bound）** | `<T: Trait>`。型パラメータに要求する trait 制約。 |
| **引数ディスパッチ** | `Self` がパラメータ型に現れるメソッド。実装を実引数の型から決める。 |
| **戻り値ディスパッチ** | `Self` が戻り値型にのみ現れるメソッド。実装を呼び出し位置の期待型から決める。 |
| **孤児規則** | impl を書ける場所の制限。(trait, 型) ごとに実装を大域一意にする。 |
| **レシーバ構文** | `x.f(args)` ≡ `f(x, args)`。糖衣。 |

## trait 宣言

```emela
trait Add {
    fn add(a: Self, b: Self) -> Self uses {}
}

trait Eq {
    fn eq(a: Self, b: Self) -> Bool uses {}
    fn neq(a: Self, b: Self) -> Bool uses {} { if eq(a, b) { false } else { true } }  -- default
}
```

- `Self` は trait / impl の内側でのみ有効な予約型名です。外で用いてはなりません。
- **ディスパッチ可能性**：各メソッドは `Self` を **パラメータ型または戻り値型** の少なくとも一方に含まなければなりません。
  - `Self` がいずれかのパラメータ型に現れる → **引数ディスパッチ**（実装は実引数の型から一意に決まる）。
  - `Self` が戻り値型にのみ現れる → **戻り値ディスパッチ**（後述）。
  - `Self` がどこにも現れないメソッドは宣言できません。
- trait メソッドは完全な関数型であり、[`uses`](/reference/effects/)と [`throws`](/reference/errors/)を宣言できます。
- メソッドは本体（デフォルト実装）を持ってよく、`impl` はそれを省略できます。

## impl 宣言

```emela
impl Add for Vec2 {
    fn add(a: Vec2, b: Vec2) -> Vec2 uses {} {
        Vec2 { x: a.x + b.x, y: a.y + b.y }
    }
}
```

- **シグネチャ一致**：impl 内の各メソッドは、trait 宣言に `Self := 対象型` を代入したものと **厳密に一致** しなければなりません（引数型・戻り値型・`uses`・`throws` すべて）。impl 内では `Self` と対象型名のどちらで書いてもよいです。
- **網羅性**：デフォルトを持たない全メソッドに本体を与えなければなりません。
- **余剰・重複**：trait に無いメソッドの定義・同一メソッドの二重定義は禁止です。
- **対象型の形**：名前付き型（`record` / `enum`）、組み込み型（`Int` / `Float` / `String` / `Char` / `Bool`）、型構築子に型パラメータを適用した形（`Array<T>`）。最後の形では impl 自身が型パラメータと境界を持てます（**パラメータ付き instance**、例 `impl<T: Show> Show for Array<T>`）。

## 境界（bounds）

ジェネリック関数の型パラメータに `: Trait` の形で境界を付けます。

```emela
fn print_line<T: Show>(value: T) -> Unit uses { Io } {
    Io.print(to_string(value) ++ "\n")   -- to_string は Show、Self=T を引数から推論
}
```

- **構文**：`<T: Trait>`。複数境界は `+` で連結（`<T: Add + Show>`）。複数の型パラメータはそれぞれに境界を付けられます。
- **不透明性の緩和**：境界 `T: Trait` の下では、`T` 型の値に対して汎用操作に加えて、`Trait` のメソッド呼び出しだけが許されます。境界に無い操作（算術・比較・`match`・フィールドアクセス）はコンパイルエラーです。
- **メソッドの呼び出し形**：trait メソッドは自由関数名で裸に呼びます（`add(acc, x)`、`to_string(v)`）。`Self` に当たる具体型は実引数型から決まります。メソッド名が in-scope の複数 trait で衝突するときは曖昧エラーとし、`Trait.method`（2セグメントパス）で明示解決します。
- **境界の伝播**：境界付き関数が別の境界付き関数を呼ぶとき、呼び先の境界は呼び元の境界から満たされていなければなりません。
- **discharge**：推論が `T = C`（具体型）を定めた後、各境界について `impl Trait for C` が in-scope に存在するか検査します。無ければエラーです。

## レシーバ構文

`recv.method(args)` は `method(recv, args)` への糖衣です（UFCS）。実装は `recv` の型から選びます。

- `recv.to_string()` ≡ `to_string(recv)`、`v.add(w)` ≡ `add(v, w)`。
- ドット左辺が **値（in-scope の束縛）** のときレシーバ呼び出しになり、左辺がモジュール・trait 名のとき（`std.int.to_string`、`Show.to_string`）は[修飾パス](/reference/modules/#名前解決順位)として解釈されます。enum variant は `::` の型パスなので競合しません。
- 糖衣であって Core Semantics に影響しません。

## コヒーレンス（孤児規則）

- **孤児規則**：`impl Trait for Type` を書けるのは、**`Trait` を定義したモジュール**、または **`Type` を定義したモジュール** のいずれかに限ります。どちらでもないモジュールでの impl はコンパイルエラー（孤児 impl）です。組み込み型の所有モジュールは std の該当モジュール（`Int` は `std.int` など）と規定します。
- **大域一意**：帰結として、(trait, 型) ごとに実装は高々1つです。型が決まれば実装は一意で、instance 選択に曖昧は生じません。
- **可視性**：impl は必ず「trait のモジュール」か「型のモジュール」に住むので、**その trait とその型が両方 in-scope なら impl も自動的に in-scope** です。利用者は trait と型を import すれば、impl のための追加 import を要しません。

## 演算子のトレイト化

次の演算子は、対応する組み込み trait のメソッドへの糖衣です（規範）。

| 演算子 | trait | メソッド | シグネチャ |
|---|---|---|---|
| `+` | `Add` | `add` | `(Self, Self) -> Self` |
| `-` | `Sub` | `sub` | `(Self, Self) -> Self` |
| `*` | `Mul` | `mul` | `(Self, Self) -> Self` |
| `/` | `Div` | `div` | `(Self, Self) -> Self` |
| `%` | `Rem` | `rem` | `(Self, Self) -> Self` |
| `++` | `Concat` | `concat` | `(Self, Self) -> Self` |
| `==` | `Eq` | `eq` | `(Self, Self) -> Bool` |
| `<` | `Ord` | `lt` | `(Self, Self) -> Bool` |

- 式 `a ⊕ b` は対応する trait メソッド呼び出しへ desugar されます（`a + b` ≡ `Add.add(a, b)`）。
- **組み込み型の instance**：`Int` / `Float` / `String` に対する演算子 trait の実装は、コンパイラが直接持つのではなく [Core Prelude](/reference/runtime-boundary/#core-prelude) の Emela `impl` として与え、本体が対応する [`intrinsic fn`](/reference/runtime-boundary/#intrinsic純粋演算) を呼びます。適用範囲は `Add`/`Sub`/`Mul`/`Div`：`Int`,`Float`／`Rem`：`Int`／`Concat`：`String`／`Eq`/`Ord`：`Int`,`Float`。
- **暗黙の可視性**：演算子 trait と上記組み込み instance は、明示 import なしに常に in-scope です（`1 + 2` が import 無しで動く後方互換）。
- ユーザー型に `impl Add for Vec2` を与えると、その型に `+` が使えるようになります。

## 戻り値ディスパッチと Monoid

`Self` が戻り値型にのみ現れるメソッド（`fn empty() -> Self` など）は、`Self` を **呼び出し位置の期待型** から解決します。新構文は導入しません。

- **期待型の供給元**：束縛の型注釈（`let x: Money = empty()`）、関数引数位置のパラメータ型、関数の戻り値型、`match` / `if` の他分岐の型、同一式中で `Self` を共有する隣接オペランドの型。
- **generic 文脈**：期待型が境界付き型変数 `T`（`T: Monoid` が in-scope）のとき `Self := T` とし、境界で discharge 済みとみなします。
- **解決不能はエラー**：期待型から `Self` を一意に確定できなければコンパイルエラーです。文脈皆無の `let x = empty()` はこれに該当します。

`Monoid` は Core Prelude が宣言する組み込み trait です。

```emela
trait Monoid {
    fn combine(a: Self, b: Self) -> Self uses {}   -- 引数ディスパッチ
    fn empty() -> Self uses {}                     -- 戻り値ディスパッチ
}
```

- 法則（結合律・単位元）は実装が満たすべきですが、コンパイラは検査しません。
- `Monoid` は **いずれの演算子にも desugar しません**。総称関数の境界としてのみ用います（`sum<T: Monoid>`）。
- **組み込み instance**：`String`（`combine = string_concat`, `empty = ""`）のみ提供します。`Int` / `Float` は加法・乗法どちらを正準とするか曖昧なため提供しません。
- **HKT を導入しません**。`Monoid` は kind `*` の単一型 `Self` を抽象化する通常の trait です。

```emela
fn sum<T: Monoid>(xs: Array<T>) -> T uses {} {
    fold_combine(xs, empty())     -- empty() の Self は戻り値位置 T（sum の戻り値）から解決
}
```

## 解決の限界

境界は **単相化により静的に discharge できるもの** に限ります。次は辞書渡し / 実行時ディスパッチを要するため扱いません。

- **trait object / 存在型**（`Array<dyn Show>`、実行時 vtable）：構文を導入しません。
- **発散する多相再帰**（有限個の特殊化に展開できない）：エラー。
- **境界付きジェネリック関数の第一級化**（値として束縛・受け渡し）：禁止。

**erasure（IR 不変条件）**：trait / impl / 境界は IR 化の前に完全に消去されます。typed IR には型変数・trait・辞書は現れず、backend は具体型の直接 call だけを受け取ります。特殊化した trait メソッドは `Trait__Type__method`（例 `Add__Int__add`、`Monoid__Money__empty`）にマングルされます。
