#!/usr/bin/env bash
# Puts the compiler for the browser (emela_playground.js and emela_playground_bg.wasm, built by
# emela's scripts/build-playground.sh) under public/wasm/emela/, next to the workers that load it.
#
# By default it downloads emela-playground-v<version>.tar.gz from the emela release named in
# .emela-version, so the playground runs the compiler the docs describe. Set
# EMELA_PLAYGROUND_DIR to a directory with the two files (a local build) to copy them instead.
#
# The deploy workflow gets the same files from emela-lang/setup-emela (`playground: true`); this
# script is for building and previewing the site locally.
#
# Usage: pnpm fetch:playground
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out="$root/public/wasm/emela"
files=(emela_playground.js emela_playground_bg.wasm)

if [ -n "${EMELA_PLAYGROUND_DIR:-}" ]; then
  for file in "${files[@]}"; do cp "$EMELA_PLAYGROUND_DIR/$file" "$out/"; done
  echo "copied the playground compiler from $EMELA_PLAYGROUND_DIR"
  exit 0
fi

version="$(tr -d '[:space:]' < "$root/.emela-version")"
tag="v${version#v}"
url="https://github.com/emela-lang/emela/releases/download/$tag/emela-playground-$tag.tar.gz"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
curl -fsSL "$url" -o "$tmp/playground.tar.gz"
tar xzf "$tmp/playground.tar.gz" -C "$tmp"
for file in "${files[@]}"; do cp "$tmp/$file" "$out/"; done
echo "fetched the playground compiler of emela $tag"
