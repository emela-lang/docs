#!/usr/bin/env node
// Checks the Emela examples in the docs with a real compiler.
//
// A code block opts in with the `check` meta (```emela check). Each such block
// is written to its own directory as a standalone `main.emel` and passed to
// `emela check`; the script fails if any block has a diagnostic error.
// Blocks marked `check=error` must instead be rejected by the compiler (for
// examples of code that does not compile).
//
// When a `check` block is followed directly (only blank lines between) by a
// ```console block, every `$ command` line in it is run with `sh` in the
// block's directory, and what the command prints (stdout and stderr) must
// equal the lines below it up to the next `$` line. Trailing whitespace and
// trailing blank lines are ignored, and so is the ``running `...` `` line that
// `emela run` prints; the exit status is not checked. A console
// block marked `no-check` is not run.
//
// Usage: node scripts/check-examples.mjs [files...]
//   EMELA=/path/to/emela overrides the `emela` on PATH, for `emela check` and
//   for the `emela` in console commands.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, relative, resolve } from 'node:path';

const EMELA = process.env.EMELA ?? 'emela';
const ROOT = new URL('..', import.meta.url).pathname;
const DOCS = join(ROOT, 'src/content/docs');
const SPLIT = '--- emela-docs: end of command ---';

// Console commands call `emela` by name, so an explicit EMELA goes first on PATH.
const ENV = { ...process.env, NO_COLOR: '1' };
// `emela test` switches to a terse reporter under a coding agent; the docs show the plain one.
delete ENV.AI_AGENT;
delete ENV.CLAUDECODE;
if (EMELA.includes('/')) ENV.PATH = dirname(resolve(EMELA)) + delimiter + ENV.PATH;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.mdx?$/.test(name) ? [path] : [];
  });
}

// Returns the fenced blocks of a Markdown file with their language, meta, line,
// and whether only blank lines separate them from the previous block.
function blocks(text) {
  const found = [];
  const lines = text.split('\n');
  let lastEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    const open = lines[i].match(/^(\s*)(`{3,})(\w*)(.*)$/);
    if (!open) continue;
    const [, indent, fence, lang, meta] = open;
    const body = [];
    let j = i + 1;
    for (; j < lines.length && !lines[j].startsWith(indent + fence); j++) {
      body.push(lines[j].slice(indent.length));
    }
    const adjacent = lastEnd >= 0 && lines.slice(lastEnd + 1, i).every((l) => l.trim() === '');
    found.push({ lang, line: i + 1, meta: meta.trim(), body, adjacent });
    lastEnd = j;
    i = j;
  }
  return found;
}

// Splits a console block into commands and the output each is expected to print.
function commands(body) {
  const runs = [];
  for (const line of body) {
    if (line.startsWith('$ ')) runs.push({ command: line.slice(2), expected: [] });
    else if (runs.length) runs.at(-1).expected.push(line);
  }
  return runs;
}

function normalize(lines) {
  const out = lines.map((l) => l.trimEnd());
  while (out.length && out.at(-1) === '') out.pop();
  return out.join('\n');
}

const files = process.argv.length > 2 ? process.argv.slice(2) : walk(DOCS);
const work = mkdtempSync(join(tmpdir(), 'emela-docs-'));
let checked = 0;
let ran = 0;
const failures = [];

for (const file of files) {
  const found = blocks(readFileSync(file, 'utf-8'));
  for (const [k, block] of found.entries()) {
    if (block.lang !== 'emela') continue;
    const mode = block.meta.match(/\bcheck(?:=(\w+))?\b/);
    if (!mode) continue;
    const expectError = mode[1] === 'error';
    const dir = join(work, String(checked++));
    mkdirSync(dir);
    const entry = join(dir, 'main.emel');
    writeFileSync(entry, block.body.join('\n') + '\n');
    const where = `${relative(ROOT, file)}:${block.line}`;

    let output = '';
    let ok = true;
    try {
      execFileSync(EMELA, ['check', entry], { stdio: 'pipe', env: ENV });
    } catch (e) {
      ok = false;
      output = `${e.stdout ?? ''}${e.stderr ?? ''}`;
    }
    if (ok === expectError) {
      failures.push({ where, output: expectError ? 'expected a compile error, but it checked' : output });
      continue;
    }
    if (expectError) continue;

    const next = found[k + 1];
    if (!next || !next.adjacent || next.lang !== 'console' || /\bno-check\b/.test(next.meta)) continue;
    // One shell runs all the commands of the block, so a later `echo $?` sees
    // the status of the command before it. A marker line splits the outputs.
    const runs = commands(next.body);
    const script = runs
      .map(({ command }) => `{ ${command}\n} 2>&1; __status=$?; printf '\\n${SPLIT}\\n'; (exit $__status)`)
      .join('\n');
    const result = spawnSync('sh', ['-c', script], { cwd: dir, env: ENV, encoding: 'utf-8', timeout: 60_000 });
    const outputs = (result.stdout ?? '').split(`\n${SPLIT}\n`);
    for (const [n, { command, expected }] of runs.entries()) {
      ran++;
      // `emela run` prints the command it runs (with a temporary absolute path) to stderr; the
      // docs leave that line out.
      const actual = normalize((outputs[n] ?? '').split('\n').filter((line) => !line.startsWith('running `')));
      const want = normalize(expected);
      if (result.error || actual !== want) {
        const why = result.error ? `${result.error.message}\n` : '';
        failures.push({
          where: `${relative(ROOT, file)}:${next.line}`,
          output: `${why}$ ${command}\n--- expected\n${want}\n--- actual\n${actual}\n`,
        });
      }
    }
  }
}

for (const { where, output } of failures) {
  console.error(`✗ ${where}\n${output.replaceAll(work, '<tmp>')}`);
}
console.log(`${checked} examples checked, ${ran} commands run, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
