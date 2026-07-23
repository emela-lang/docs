# Emela playground wasm — required `emela` patch

The committed playground wasm under `public/wasm/emela/` was built from the
`emela-wasm` crate **with the small patch below applied to a checkout of
`../emela`**. That patch is intentionally **not** committed to the `emela` repo
(this project keeps the compiler repo untouched — see the project memory
"Docs reflect spec, not impl"), so the pristine `emela` tree does **not** build
the playground wasm as-is.

Keep this file as the source of truth for how the committed binary was produced.
To regenerate the wasm (see `build-wasm.sh`), apply these four changes to a
copy/checkout of `emela` first, then run the build.

Without this patch the wasm build fails two ways:
1. `emela-wasm` has no `run` export and `emela` has no public `run_source`, so
   the Playground's "Run" (compile + execute, capturing stdout) does not exist.
2. On `wasm32-unknown-unknown`, `getrandom` 0.2 (pulled in by `emela`'s `run`
   feature) fails to compile without its `js` backend.

---

## 1. `crates/emela/src/api.rs`

Append after `compile_source`:

```rust
/// The captured result of compiling and running `source` in-process — the
/// playground's "Run" button. Mirrors `emela run`: the source is compiled with
/// the `wasm-wasi` backend and executed via the embedded `wasmi` interpreter,
/// with stdout/stderr captured into strings instead of written to the process
/// streams (so it works inside a wasm build, where there are no process
/// streams).
#[cfg(feature = "run")]
#[derive(Debug, Default)]
pub struct RunOutput {
    /// Everything the program wrote to stdout.
    pub stdout: String,
    /// Everything the program wrote to stderr.
    pub stderr: String,
    /// The process exit code, when the program exited cleanly via `proc_exit`.
    pub exit_code: Option<i32>,
    /// A runtime trap message (`panic`/`unreachable`), when execution trapped
    /// instead of exiting cleanly.
    pub trap: Option<String>,
}

/// Compiles `source` with the `wasm-wasi` backend and runs it in-process,
/// returning its captured output.
///
/// A compile or type error surfaces as `Err`; a program that runs but traps
/// returns `Ok` with [`RunOutput::trap`] set. Networking (sockets / HTTP) is
/// linked but non-functional under a `wasm32-unknown-unknown` host, so programs
/// that use it trap at run time.
#[cfg(feature = "run")]
pub fn run_source(label: &str, source: &str) -> Result<RunOutput> {
    use crate::run::{Captured, RunOutcome};

    let artifact = driver::compile_source(label, source, "wasm-wasi", EmitMode::Default)?;
    let (outcome, Captured { stdout, stderr }) = crate::run::execute_captured(&artifact.bytes)?;
    let (exit_code, trap) = match outcome {
        RunOutcome::Exit(code) => (Some(code), None),
        RunOutcome::Trap(message) => (None, Some(message)),
    };
    Ok(RunOutput {
        stdout: String::from_utf8_lossy(&stdout).into_owned(),
        stderr: String::from_utf8_lossy(&stderr).into_owned(),
        exit_code,
        trap,
    })
}
```

## 2. `crates/emela/src/lib.rs`

Add the re-export right after the existing `pub use api::{…};`:

```rust
pub use api::{check_source, compile_source, ir_source};
#[cfg(feature = "run")]
pub use api::{run_source, RunOutput};
```

## 3. `crates/emela-wasm/src/lib.rs`

The crate already has a private `fn run(source, target) -> CompileResult` used by
`compile`. Rename it to `dispatch` (and update the one call site inside
`compile`) to free the name, then add the public `run` export:

```rust
// in `pub fn compile`:
    let result = dispatch(source, target);

// rename the helper:
fn dispatch(source: &str, target: &str) -> CompileResult {
    // …unchanged body…
}
```

Add after the `emit` helper:

```rust
/// The shape returned to JavaScript by [`run`] (as JSON).
#[derive(Serialize)]
struct RunResult {
    /// Whether compilation succeeded (execution was attempted). A compile or
    /// type error sets this to `false`; a program that runs but traps is still
    /// `true` (see `trap`).
    ok: bool,
    /// Everything the program wrote to stdout.
    stdout: String,
    /// Everything the program wrote to stderr.
    stderr: String,
    /// The process exit code, when the program exited cleanly.
    exit_code: Option<i32>,
    /// A runtime trap message (`panic` / `unreachable`), or `null`.
    trap: Option<String>,
    /// The rendered compile / type diagnostic, or `null` on success.
    error: Option<String>,
}

/// Compiles `source` with the `wasm-wasi` backend and runs it in-process via
/// the embedded `wasmi` interpreter — the playground's "Run" button — returning
/// a JSON [`RunResult`] with the captured stdout/stderr.
///
/// This mirrors `emela run`. Compile / type errors populate `error`; a program
/// that runs but traps populates `trap`. Networking is unavailable in the
/// browser, so programs that use sockets / HTTP trap at run time.
#[wasm_bindgen]
pub fn run(source: &str) -> String {
    install_panic_hook();
    let result = match emela::run_source(LABEL, source) {
        Ok(out) => RunResult {
            ok: true,
            stdout: out.stdout,
            stderr: out.stderr,
            exit_code: out.exit_code,
            trap: out.trap,
            error: None,
        },
        Err(err) => RunResult {
            ok: false,
            stdout: String::new(),
            stderr: String::new(),
            exit_code: None,
            trap: None,
            error: Some(err.to_string()),
        },
    };
    serde_json::to_string(&result).unwrap_or_else(|err| {
        format!(
            "{{\"ok\":false,\"stdout\":\"\",\"stderr\":\"\",\"exit_code\":null,\"trap\":null,\"error\":\"failed to serialize result: {err}\"}}"
        )
    })
}
```

## 4. `crates/emela-wasm/Cargo.toml`

Add to `[dependencies]`:

```toml
# `emela`'s `run` feature pulls in getrandom 0.2 (for the `random` capability).
# On `wasm32-unknown-unknown` getrandom needs its `js` backend to compile at all
# (it uses `crypto.getRandomValues`); enabling it here turns it on for the whole
# wasm build, since Cargo features are additive.
getrandom = { version = "0.2", features = ["js"] }
```

---

## Verifying the built wasm (no browser needed)

With `public/wasm/emela/` regenerated, this Node smoke test exercises the whole
compile → wasmi-execute → capture-stdout path (the `--target web` glue lets you
pass the wasm bytes to `init()` directly, skipping the browser `fetch`):

```js
import { readFileSync } from 'node:fs';
import init, { run } from './public/wasm/emela/emela_wasm.js';
await init(readFileSync('./public/wasm/emela/emela_wasm_bg.wasm'));
console.log(run('import std.io\n\nfn main() -> Unit uses { Io } {\n  Io.print("Hello!\\n")\n}\n'));
// -> {"ok":true,"stdout":"Hello!\n","stderr":"","exit_code":0,"trap":null,"error":null}
```
