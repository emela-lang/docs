// Web Worker that hosts the Emela compiler for the browser (emela-playground of the emela
// repository). It loads the wasm once and answers `check`, `format` and `compile` requests,
// each with the JSON object the compiler returns.
//
// It also hosts the language server of `emela lsp` (LspSession) for the editor: a message
// `{ lsp }` carries one LSP message as JSON text, and every message the server sends back is
// posted as `{ lsp }` too, in order. Releases before the one with emela-lang/emela#681 have no
// LspSession; the operation `lspAvailable` tells the page whether this one has it.
//
// emela_playground.js and emela_playground_bg.wasm come from the emela release in
// .emela-version (scripts/fetch-playground.sh); they are not committed.
// A namespace import, so that a release without LspSession still loads.
import init, * as compiler from './emela_playground.js';

const { check, format, compile, LspSession } = compiler;
const ops = { check, format, compile, lspAvailable: () => JSON.stringify(typeof LspSession === 'function') };
let ready;
let session;

self.onmessage = async (event) => {
  const { id, op, source, lsp } = event.data ?? {};
  if (typeof lsp === 'string') {
    ready ??= init();
    await ready;
    session ??= new LspSession();
    for (const reply of JSON.parse(session.send(lsp))) self.postMessage({ lsp: JSON.stringify(reply) });
    return;
  }
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
