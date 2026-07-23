#!/usr/bin/env bash
#
# Build the Emela compiler/runtime (../emela crates/emela-wasm) to WebAssembly
# and vendor it into this docs site, so the Playground "Run" buttons run Emela
# entirely client-side as a static page (no server, no temp files).
#
# The produced files are committed under public/wasm/emela/, so building the
# site itself needs no Rust/Nix toolchain — only regenerating the wasm does.
#
# IMPORTANT: the committed wasm was built with a small patch applied to `emela`
# (a `run` export + a getrandom `js` feature). This project keeps the `emela`
# repo untouched, so that patch is NOT upstream — the pristine `emela` tree does
# not build the playground wasm. Apply it first: see emela-playground-patch.md.
#
# Requirements to (re)generate:
#   - the emela-playground-patch.md changes applied to $EMELA_DIR
#   - a Rust toolchain with the wasm32-unknown-unknown target
#       rustup target add wasm32-unknown-unknown
#   - Nix, for the pinned wasm-bindgen CLI. Its version MUST match the
#     wasm-bindgen crate pinned in ../emela/crates/emela-wasm/Cargo.toml
#     (currently 0.2.121); `nix run nixpkgs#wasm-bindgen-cli` provides it.
#   - Optional: Nix binaryen (wasm-opt) to shrink the module; skipped if absent.
#
# Usage: pnpm run build:wasm   (or: bash scripts/build-wasm.sh)
set -euo pipefail

DOCS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EMELA_DIR="$(cd "$DOCS_DIR/../emela" && pwd)"
OUT_DIR="$DOCS_DIR/public/wasm/emela"

# Guard: the pristine emela tree lacks the playground `run` export, so bail early
# with a pointer to the patch rather than a confusing deep compile error.
if ! grep -qR "pub fn run_source" "$EMELA_DIR/crates/emela/src/"; then
	echo "error: $EMELA_DIR is missing the playground patch (emela::run_source)." >&2
	echo "       Apply scripts/emela-playground-patch.md to it first." >&2
	exit 1
fi

echo "==> cargo build (emela-wasm, wasm32-unknown-unknown, release)"
cargo build --manifest-path "$EMELA_DIR/Cargo.toml" \
	-p emela-wasm --target wasm32-unknown-unknown --release

WASM="$EMELA_DIR/target/wasm32-unknown-unknown/release/emela_wasm.wasm"

echo "==> wasm-bindgen (--target web) -> $OUT_DIR"
mkdir -p "$OUT_DIR"
nix run nixpkgs#wasm-bindgen-cli -- \
	--target web --no-typescript \
	--out-dir "$OUT_DIR" --out-name emela_wasm \
	"$WASM"

# Optional size pass. Non-fatal: the module works without it.
if command -v wasm-opt >/dev/null 2>&1; then
	echo "==> wasm-opt -Oz"
	wasm-opt -Oz "$OUT_DIR/emela_wasm_bg.wasm" -o "$OUT_DIR/emela_wasm_bg.wasm"
elif command -v nix >/dev/null 2>&1; then
	echo "==> wasm-opt -Oz (via nix binaryen)"
	nix shell nixpkgs#binaryen -c wasm-opt -Oz \
		"$OUT_DIR/emela_wasm_bg.wasm" -o "$OUT_DIR/emela_wasm_bg.wasm" || \
		echo "   (wasm-opt skipped)"
fi

echo "==> done. Vendored into $OUT_DIR:"
ls -la "$OUT_DIR"
