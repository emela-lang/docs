// The Emela editor of the playground and the tour: CodeMirror with the language server of
// `emela lsp`, which runs in the compiler worker (lspTransport in emela-runner.ts). The server
// gives diagnostics, completion, hover, signature help and formatting; the editor colors the
// text with a small tokenizer of its own.

import { LSPClient, languageServerExtensions } from '@codemirror/lsp-client';
import {
  HighlightStyle,
  StreamLanguage,
  bracketMatching,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
  type StreamParser,
  type StringStream,
} from '@codemirror/language';
import { EditorState, type Extension } from '@codemirror/state';
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { tags } from '@lezer/highlight';
import { lspTransport } from './emela-runner';

/** The one file of the playground, as the language server knows it. */
const URI = 'file:///playground/main.emel';

// ── Coloring ────────────────────────────────────────────────────────────────

const CONTROL = new Set(['if', 'else', 'match', 'assert']);
const ERROR = new Set(['fail', 'escape']);
const DECLARATION = new Set(['fn', 'type', 'enum', 'error', 'const', 'trait', 'impl', 'effect', 'handler', 'layer', 'import']);
const MODIFIER = new Set(['pub', 'opaque', 'suspend']);
const OTHER = new Set(['use', 'with', 'fails', 'uses', 'derive', 'init', 'release', 'of', 'by', 'default']);

interface State {
  /** What encloses the position, innermost last: a string, or an interpolation's braces. */
  stack: ({ kind: 'string'; triple: boolean } | { kind: 'code'; depth: number })[];
}

/** Reads string text up to an interpolation, the closing quote or the end of the line. */
function inString(stream: StringStream, state: State, triple: boolean): string {
  while (!stream.eol()) {
    if (stream.match('#{', false)) return 'string';
    if (triple ? stream.match('"""') : stream.eat('"')) {
      state.stack.pop();
      return 'string';
    }
    if (stream.next() === '\\') stream.next();
  }
  // A string in double quotes does not continue on the next line.
  if (!triple) state.stack.pop();
  return 'string';
}

const emela: StreamParser<State> = {
  name: 'emela',
  startState: () => ({ stack: [] }),
  copyState: (state) => ({ stack: state.stack.map((frame) => ({ ...frame })) }),
  token(stream, state) {
    const top = state.stack[state.stack.length - 1];
    if (top?.kind === 'string') {
      if (stream.match('#{')) {
        state.stack.push({ kind: 'code', depth: 0 });
        return 'meta';
      }
      return inString(stream, state, top.triple);
    }
    if (stream.eatSpace()) return null;
    if (top?.kind === 'code') {
      if (stream.peek() === '{') top.depth++;
      if (stream.peek() === '}' && top.depth-- === 0) {
        stream.next();
        state.stack.pop();
        return 'meta';
      }
    }
    if (stream.match('##')) {
      stream.skipToEnd();
      return 'docComment';
    }
    if (stream.peek() === '#') {
      stream.skipToEnd();
      return 'comment';
    }
    if (stream.match('"""')) {
      state.stack.push({ kind: 'string', triple: true });
      return inString(stream, state, true);
    }
    if (stream.eat('"')) {
      state.stack.push({ kind: 'string', triple: false });
      return inString(stream, state, false);
    }
    if (stream.match(/^(0x[0-9a-fA-F_]+|0b[01_]+|[0-9][0-9_]*(\.[0-9][0-9_]*([eE][+-]?[0-9_]+)?)?)/)) return 'number';
    if (stream.match(/^@[a-z_][A-Za-z0-9_]*/)) return 'meta';
    const word = stream.match(/^[A-Za-z_][A-Za-z0-9_]*/) as RegExpMatchArray | null;
    if (word) {
      const name = word[0];
      if (name === 'True' || name === 'False') return 'bool';
      if (name === 'self') return 'self';
      if (CONTROL.has(name)) return 'controlKeyword';
      if (ERROR.has(name)) return 'controlKeyword';
      if (DECLARATION.has(name)) return 'definitionKeyword';
      if (MODIFIER.has(name)) return 'modifier';
      if (OTHER.has(name)) return 'keyword';
      if (/^[A-Z]/.test(name)) return /^[A-Z][A-Z0-9_]*$/.test(name) && name.length > 1 ? 'constant' : 'typeName';
      if (stream.match(/^\s*\(/, false)) return 'function';
      return 'variableName';
    }
    if (stream.match(/^(->|\|>|==|!=|<=|>=|&&|\|\||\.\.|[-+*/%<>=!|])/)) return 'operator';
    stream.next();
    return 'punctuation';
  },
  tokenTable: {
    function: tags.function(tags.variableName),
    constant: tags.constant(tags.variableName),
    docComment: tags.docComment,
  },
  languageData: { commentTokens: { line: '#' }, closeBrackets: { brackets: ['(', '[', '{', '"'] } },
};

// Colors from beryl.vim (src/themes/beryl.json and beryl-light.json), set per mode in custom.css
// through these class names.
const highlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.definitionKeyword, tags.modifier], class: 'em-keyword' },
  { tag: tags.controlKeyword, class: 'em-keyword' },
  { tag: [tags.typeName], class: 'em-type' },
  { tag: [tags.number, tags.bool, tags.constant(tags.variableName)], class: 'em-number' },
  { tag: tags.string, class: 'em-string' },
  { tag: tags.meta, class: 'em-meta' },
  { tag: tags.function(tags.variableName), class: 'em-function' },
  { tag: tags.self, class: 'em-self' },
  { tag: tags.comment, class: 'em-comment' },
  { tag: tags.docComment, class: 'em-doc' },
  { tag: [tags.operator], class: 'em-operator' },
  { tag: tags.punctuation, class: 'em-punctuation' },
]);

// The tooltips of the language server (hover, completion, signature help) in the site's colors.
// A theme rather than custom.css, so it comes after CodeMirror's own base theme.
const tooltips = EditorView.theme({
  '.cm-tooltip': {
    fontFamily: 'var(--emela-mono)',
    fontSize: 'var(--sl-text-xs)',
    color: 'var(--sl-color-text)',
    backgroundColor: 'var(--sl-color-gray-6, var(--sl-color-black))',
    border: '1px solid var(--sl-color-gray-5)',
    borderRadius: '0.4rem',
    overflow: 'hidden',
  },
  '.cm-tooltip-section, .cm-lsp-documentation': { padding: '0.3rem 0.6rem', maxWidth: '40rem' },
  '.cm-tooltip pre, .cm-tooltip code': {
    margin: '0',
    fontFamily: 'var(--emela-mono)',
    background: 'transparent',
    whiteSpace: 'pre-wrap',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul': { fontFamily: 'var(--emela-mono)' },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li': { padding: '0.15rem 0.6rem' },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    color: 'var(--sl-color-text)',
    background: 'color-mix(in srgb, var(--sl-color-accent) 30%, transparent)',
  },
  '.cm-completionDetail': { color: 'var(--sl-color-gray-3)', marginLeft: '1em' },
  '.cm-completionMatchedText': { textDecoration: 'none', color: 'var(--sl-color-accent)' },
});

// ── The editor ──────────────────────────────────────────────────────────────

let client: LSPClient | null = null;

/** One client for the page: the server in the worker holds one session. */
function lspClient(): LSPClient {
  client ??= new LSPClient({ extensions: languageServerExtensions() }).connect(lspTransport());
  return client;
}

export interface EditorOptions {
  /** Called on Ctrl / ⌘ + Enter. */
  onRun?: () => void;
  /** Connect to the language server; without it the editor colors the text only. */
  lsp?: boolean;
}

export function createEditor(parent: HTMLElement, doc: string, options: EditorOptions = {}): EditorView {
  const extensions: Extension[] = [
    lineNumbers(),
    highlightActiveLineGutter(),
    history(),
    drawSelection(),
    indentOnInput(),
    indentUnit.of('  '),
    EditorState.tabSize.of(2),
    bracketMatching(),
    closeBrackets(),
    highlightActiveLine(),
    StreamLanguage.define(emela),
    syntaxHighlighting(highlight),
    tooltips,
    keymap.of([
      { key: 'Mod-Enter', run: () => (options.onRun?.(), true) },
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...historyKeymap,
      ...completionKeymap,
      indentWithTab,
    ]),
  ];
  if (options.lsp) extensions.push(lspClient().plugin(URI, 'emela'));
  return new EditorView({ parent, state: EditorState.create({ doc, extensions }) });
}

/** Replaces the whole text, as one undoable change. */
export function setText(view: EditorView, text: string): void {
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
}
