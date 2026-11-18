// Web Worker that hosts the Emela compiler for the browser (emela-playground of the emela
// repository). It loads the wasm once and answers `check`, `format` and `compile` requests,
// each with the JSON object the compiler returns.
//
// emela_playground.js and emela_playground_bg.wasm come from the emela release in
// .emela-version (scripts/fetch-playground.sh); they are not committed.
import init, { check, format, compile } from './emela_playground.js';

const ops = { check, format, compile };
let ready;

self.onmessage = async (event) => {
  const { id, op, source } = event.data ?? {};
  try {
    ready ??= init();
    await ready;
    const run = ops[op];
    if (!run) throw new Error(`unknown operation: ${op}`);
    self.postMessage({ id, ok: true, result: JSON.parse(run(source ?? '')) });
  } catch (error) {
    self.postMessage({ id, ok: false, error: String(error?.message ?? error) });
  }
};
