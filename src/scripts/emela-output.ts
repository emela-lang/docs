// Renders a run into an output element, the way a terminal shows `emela run`: diagnostics
// first, then standard output and standard error in the order they were written. Shared by the
// inline Run buttons and the Playground.
import type { Chunk, RunResult } from './emela-runner';

function part(el: HTMLElement, kind: string, text: string): void {
  const node = document.createElement('div');
  node.className = `emela-out-part emela-out-${kind}`;
  node.textContent = text;
  el.appendChild(node);
}

/** Clears `el` for a new run. */
export function startOutput(el: HTMLElement): void {
  el.hidden = false;
  el.textContent = '';
  el.dataset.state = 'running';
}

/** Appends one write of the running program. */
export function appendChunk(el: HTMLElement, chunk: Chunk): void {
  // Each write is one line; the element already breaks the line.
  part(el, chunk.fd === 2 ? 'err' : 'out', chunk.text.replace(/\n$/, ''));
}

/** Shows the whole result, replacing what streamed in. */
export function renderResult(el: HTMLElement, result: RunResult): void {
  el.textContent = '';
  const failed = !result.compiled || result.timedOut || (result.exitCode ?? 0) !== 0;
  el.dataset.state = failed ? 'error' : 'ok';
  if (result.diagnostics) part(el, 'diag', result.diagnostics.trimEnd());
  if (!result.compiled) return;
  for (const chunk of result.output) appendChunk(el, chunk);
  if (result.timedOut) {
    part(el, 'err', '10 秒たっても終わらないので止めました。');
  } else if (result.output.length === 0) {
    part(el, 'muted', '（出力なし）');
  }
  if (result.exitCode != null && result.exitCode !== 0) part(el, 'muted', `終了コード ${result.exitCode}`);
}

export function renderError(el: HTMLElement, message: string): void {
  el.textContent = '';
  el.dataset.state = 'error';
  part(el, 'diag', message);
}
