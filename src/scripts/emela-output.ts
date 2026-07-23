// Renders a RunResult (or an error) into an output element. Shared by the
// inline Run buttons and the Playground so they present output identically.
import type { RunResult } from './emela-runner';

interface Part {
  label?: string;
  text: string;
  kind: 'out' | 'err' | 'diag' | 'muted';
}

export function renderResult(el: HTMLElement, result: RunResult): void {
  el.textContent = '';
  el.dataset.state = result.error || result.trap ? 'error' : 'ok';

  const parts: Part[] = [];
  if (result.error) {
    // A compile / type error: no program ran.
    parts.push({ text: result.error, kind: 'diag' });
  } else {
    if (result.stdout) parts.push({ text: result.stdout, kind: 'out' });
    if (result.stderr) parts.push({ label: 'stderr', text: result.stderr, kind: 'err' });
    if (result.trap) parts.push({ label: 'trap', text: result.trap, kind: 'err' });
    if (!result.stdout && !result.stderr && !result.trap) {
      parts.push({ text: '(出力なし)', kind: 'muted' });
    }
    if (result.exit_code != null && result.exit_code !== 0) {
      parts.push({ label: 'exit code', text: String(result.exit_code), kind: 'err' });
    }
  }

  for (const part of parts) {
    const line = document.createElement('div');
    line.className = `emela-out-part emela-out-${part.kind}`;
    if (part.label) {
      const tag = document.createElement('span');
      tag.className = 'emela-out-label';
      tag.textContent = `${part.label}: `;
      line.appendChild(tag);
    }
    line.appendChild(document.createTextNode(part.text));
    el.appendChild(line);
  }
}

export function renderError(el: HTMLElement, message: string): void {
  el.textContent = '';
  el.dataset.state = 'error';
  const line = document.createElement('div');
  line.className = 'emela-out-part emela-out-diag';
  line.textContent = message;
  el.appendChild(line);
}
