// Web Worker that hosts the Emela compiler/runtime wasm.
//
// It loads emela_wasm.js (the wasm-bindgen `--target web` glue) once, then runs
// sources on demand off the main thread. `run(source)` compiles with the
// wasm-wasi backend and executes in-process via the embedded wasmi interpreter,
// returning a JSON string { ok, stdout, stderr, exit_code, trap, error }.
//
// Lives under public/ (served verbatim at /wasm/emela/), so it is a plain
// hand-written ES module, not bundled by Astro. init() resolves the .wasm
// relative to import.meta.url, i.e. this same directory.
import init, { run } from './emela_wasm.js';

let ready;
function ensureReady() {
  if (!ready) ready = init();
  return ready;
}

self.onmessage = async (event) => {
  const { id, source } = event.data || {};
  try {
    await ensureReady();
    const result = JSON.parse(run(source ?? ''));
    self.postMessage({ id, ok: true, result });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
  }
};
