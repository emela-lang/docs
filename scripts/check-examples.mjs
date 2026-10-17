#!/usr/bin/env node
// Checks the Emela examples in the docs with a real compiler.
//
// A code block opts in with the `check` meta (```emela check). Each such block
// is written to its own directory as a standalone `main.emel` and passed to
// `emela check`; the script fails if any block has a diagnostic error.
// Blocks marked `check=error` must instead be rejected by the compiler (for
// examples of code that does not compile).
//
// Usage: node scripts/check-examples.mjs [files...]
//   EMELA=/path/to/emela overrides the `emela` on PATH.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

const EMELA = process.env.EMELA ?? 'emela';
const ROOT = new URL('..', import.meta.url).pathname;
const DOCS = join(ROOT, 'src/content/docs');

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.mdx?$/.test(name) ? [path] : [];
  });
}

// Returns the ```emela blocks of a Markdown file with their meta and line.
function blocks(text) {
  const found = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const open = lines[i].match(/^(\s*)(`{3,})emela\b(.*)$/);
    if (!open) continue;
    const [, indent, fence, meta] = open;
    const body = [];
    let j = i + 1;
    for (; j < lines.length && !lines[j].startsWith(indent + fence); j++) {
      body.push(lines[j].slice(indent.length));
    }
    found.push({ line: i + 1, meta: meta.trim(), source: body.join('\n') + '\n' });
    i = j;
  }
  return found;
}

const files = process.argv.length > 2 ? process.argv.slice(2) : walk(DOCS);
const work = mkdtempSync(join(tmpdir(), 'emela-docs-'));
let checked = 0;
const failures = [];

for (const file of files) {
  for (const block of blocks(readFileSync(file, 'utf-8'))) {
    const mode = block.meta.match(/\bcheck(?:=(\w+))?\b/);
    if (!mode) continue;
    const expectError = mode[1] === 'error';
    const dir = join(work, String(checked++));
    mkdirSync(dir);
    const entry = join(dir, 'main.emel');
    writeFileSync(entry, block.source);
    let output = '';
    let ok = true;
    try {
      execFileSync(EMELA, ['check', entry], { stdio: 'pipe', env: { ...process.env, NO_COLOR: '1' } });
    } catch (e) {
      ok = false;
      output = `${e.stdout ?? ''}${e.stderr ?? ''}`;
    }
    const where = `${relative(ROOT, file)}:${block.line}`;
    if (ok === expectError) {
      failures.push({ where, output: expectError ? 'expected a compile error, but it checked' : output });
    }
  }
}

for (const { where, output } of failures) {
  console.error(`✗ ${where}\n${output.replaceAll(work, '<tmp>')}`);
}
console.log(`${checked} examples checked, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
