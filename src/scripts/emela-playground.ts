// Wires an Emela playground: the /playground page (Playground.astro) and the lessons of the tour
// (src/pages/tour/). The page renders the source in a textarea inside `.emela-pg-editor-wrap`,
// with Run, Format and (optionally) Reset buttons and an output panel; this replaces the
// textarea with the editor (emela-editor.ts) and makes the buttons work.

import { appendChunk, renderError, renderResult, startOutput } from './emela-output';
import { formatEmela, lspAvailable, runEmela } from './emela-runner';

export async function mountPlayground(root: HTMLElement): Promise<void> {
  if (root.dataset.wired === 'yes') return;
  const wrap = root.querySelector<HTMLElement>('.emela-pg-editor-wrap');
  const textarea = wrap?.querySelector<HTMLTextAreaElement>('textarea');
  const button = root.querySelector<HTMLButtonElement>('.emela-pg-run');
  const formatButton = root.querySelector<HTMLButtonElement>('.emela-pg-format');
  const resetButton = root.querySelector<HTMLButtonElement>('.emela-pg-reset');
  const output = root.querySelector<HTMLElement>('.emela-pg-output');
  if (!wrap || !textarea || !button || !formatButton || !output) return;
  root.dataset.wired = 'yes';
  const original = textarea.value;

  // CodeMirror and the language server client load with the editor, not with the page.
  const [{ createEditor, setText }, lsp] = await Promise.all([import('./emela-editor'), lspAvailable()]);
  const view = createEditor(wrap, original, { onRun: () => void run(), lsp });
  textarea.remove();
  wrap.dataset.editor = 'yes';

  async function run(): Promise<void> {
    button!.disabled = true;
    startOutput(output!);
    try {
      const source = view.state.doc.toString();
      renderResult(output!, await runEmela(source, { onChunk: (chunk) => appendChunk(output!, chunk) }));
    } catch (err) {
      renderError(output!, String((err as Error)?.message || err));
    } finally {
      button!.disabled = false;
    }
  }

  async function format(): Promise<void> {
    formatButton!.disabled = true;
    try {
      const result = await formatEmela(view.state.doc.toString());
      if (result.ok) {
        setText(view, result.source);
      } else {
        output!.hidden = false;
        renderError(output!, result.diagnostics.trimEnd());
      }
    } catch (err) {
      output!.hidden = false;
      renderError(output!, String((err as Error)?.message || err));
    } finally {
      formatButton!.disabled = false;
    }
  }

  button.addEventListener('click', () => void run());
  formatButton.addEventListener('click', () => void format());
  resetButton?.addEventListener('click', () => {
    setText(view, original);
    output.hidden = true;
  });
}
