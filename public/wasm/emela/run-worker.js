// Web Worker that runs one compiled program, then is thrown away (a stuck program is stopped
// by terminating the worker).
//
// It receives `{ files, entry }` from `compile` (paths relative to the output directory),
// imports the entry and calls `main` as `emela run` does, and posts what the program writes:
//
//   { type: 'out', fd: 1 | 2, text }   a line of standard output or standard error
//   { type: 'exit', code }             0, 1 (an error reached main), 101 (defect), 130 (interrupted)
//
// Without `process`, the runtime writes through `console.log` and `console.error`, one call per
// line without its `\n`, so those two are the program's output here.

const post = (message) => self.postMessage(message);
console.log = (...parts) => post({ type: 'out', fd: 1, text: `${parts.join(' ')}\n` });
console.error = (...parts) => post({ type: 'out', fd: 2, text: `${parts.join(' ')}\n` });

// The output files import each other with relative specifiers ("./emela_runtime.mjs"). A blob
// URL has no directory to resolve them against, so each file's specifiers are replaced with the
// blob URLs of the files they name, dependencies first.
function link(files) {
  const texts = new Map(files.map((file) => [file.path, file.text]));
  const urls = new Map();
  const resolve = (from, specifier) => new URL(specifier, `file:///${from}`).pathname.slice(1);
  const visit = (path, seen) => {
    if (urls.has(path)) return urls.get(path);
    if (seen.has(path)) throw new Error(`import cycle through ${path}`);
    seen.add(path);
    const text = texts.get(path);
    if (text === undefined) throw new Error(`the output has no ${path}`);
    const linked = text.replace(
      /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])(\.{1,2}\/[^"']+)\2/g,
      (_, head, quote, specifier) => `${head}${quote}${visit(resolve(path, specifier), seen)}${quote}`,
    );
    const url = URL.createObjectURL(new Blob([linked], { type: 'text/javascript' }));
    urls.set(path, url);
    return url;
  };
  return (path) => visit(path, new Set());
}

let over = false;

function line(text) {
  const output = globalThis[Symbol.for('emela.output')];
  if (output) output.write(2, text);
  else post({ type: 'out', fd: 2, text });
}

function stop(code, text) {
  if (over) return;
  over = true;
  if (text) line(text);
  post({ type: 'exit', code });
}

function finish(value) {
  const show = value?.[Symbol.for('emela.fail')];
  if (typeof show === 'function') stop(1, `error: ${show.call(value)}\n`);
  else stop(0);
}

function crash(error) {
  if (error instanceof Error && error.name === 'Interrupted') stop(130, 'interrupted\n');
  else if (error instanceof Error && error.name === 'Defect') stop(101, `defect: ${error.message}\n`);
  else stop(1, `${error?.stack ?? String(error)}\n`);
}

self.addEventListener('error', (event) => {
  event.preventDefault();
  crash(event.error ?? event.message);
});
self.addEventListener('unhandledrejection', (event) => {
  event.preventDefault();
  crash(event.reason);
});

self.onmessage = async (event) => {
  const { files, entry } = event.data;
  globalThis[Symbol.for('emela.args')] = [];
  try {
    const module = await import(link(files)(entry));
    if (typeof module.main !== 'function') return stop(0);
    const value = module.main();
    if (typeof module.$start === 'function' && Object.prototype.toString.call(value) === '[object Generator]') {
      module.$start(value, (ok, result) => (ok ? finish(result) : crash(result)));
    } else {
      finish(value);
    }
  } catch (error) {
    crash(error);
  }
};
