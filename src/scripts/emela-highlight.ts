// Lazily highlights Emela source with Shiki, reusing the SAME TextMate grammar
// and Night Owl themes as the site's ```emela code blocks, so the Playground
// editor and the docs code blocks look identical.
//
// Uses Shiki's fine-grained core + the pure-JS regex engine (no wasm) and imports
// ONLY the two Night Owl themes, so the bundle stays small — the full `shiki`
// entry would pull in every bundled language/theme. Everything is dynamically
// imported on first use, keeping Shiki out of the initial page JS.
import emelaGrammar from '../grammars/emela.tmLanguage.json';

type Highlighter = { codeToHtml: (code: string, options: unknown) => string };

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = (async () => {
      const [{ createHighlighterCore }, { createJavaScriptRegexEngine }, nightOwl, nightOwlLight] =
        await Promise.all([
          import('shiki/core'),
          import('shiki/engine/javascript'),
          import('@shikijs/themes/night-owl'),
          import('@shikijs/themes/night-owl-light'),
        ]);
      return createHighlighterCore({
        themes: [nightOwl.default, nightOwlLight.default],
        // The grammar object registers under its own `name` ("emela").
        langs: [emelaGrammar as never],
        engine: createJavaScriptRegexEngine(),
      });
    })();
  }
  return highlighterPromise;
}

/**
 * Renders `code` as highlighted HTML into `el`. Dual-theme (`--shiki-dark` /
 * `--shiki-light` CSS vars); custom.css picks the color per `data-theme`.
 * Resolves once the highlight has been written.
 */
export async function highlightInto(el: HTMLElement, code: string): Promise<void> {
  const highlighter = await getHighlighter();
  el.innerHTML = highlighter.codeToHtml(code, {
    lang: 'emela',
    themes: { dark: 'night-owl', light: 'night-owl-light' },
    defaultColor: false,
  });
}
