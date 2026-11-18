// Client-side helpers that check, format and run Emela source in the browser.
//
// The compiler (public/wasm/emela/compiler-worker.js) is one worker, created on first use and
// kept. Each run gets a fresh run worker (run-worker.js) that is terminated when the program
// ends or the timeout passes, so an endless program never blocks the page or the compiler.

const BASE = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/wasm/emela`;

/** One write of the program, in the order it happened. */
export interface Chunk {
  fd: 1 | 2;
  text: string;
}

export interface RunResult {
  /** Rendered diagnostics as `emela check` prints them; empty when there are none. */
  diagnostics: string;
  /** `false` when compiling failed: nothing ran. */
  compiled: boolean;
  output: Chunk[];
  /** The exit code as `emela run` gives it, or `null` when the run was stopped. */
  exitCode: number | null;
  /** Set when the run was stopped by the timeout. */
  timedOut: boolean;
}

interface Checked {
  ok: boolean;
  diagnostics: string;
}

interface Formatted extends Checked {
  source: string;
}

interface Compiled extends Checked {
  entry: string;
  files: { path: string; text: string }[];
}

let compiler: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();

function compilerWorker(): Worker {
  if (compiler) return compiler;
  const worker = new Worker(`${BASE}/compiler-worker.js`, { type: 'module' });
  worker.onmessage = (event: MessageEvent) => {
    const { id, ok, result, error } = event.data ?? {};
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);
    if (ok) entry.resolve(result);
    else entry.reject(new Error(error ?? 'compiler error'));
  };
  worker.onerror = (event) => {
    compiler = null;
    worker.terminate();
    for (const { reject } of pending.values()) reject(new Error(event.message || 'the compiler stopped'));
    pending.clear();
  };
  compiler = worker;
  return worker;
}

function request<T>(op: 'check' | 'format' | 'compile', source: string): Promise<T> {
  const worker = compilerWorker();
  const id = ++seq;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
    worker.postMessage({ id, op, source });
  });
}

/** Diagnostics of `source`, as `emela check main.emel`. */
export function checkEmela(source: string): Promise<Checked> {
  return request<Checked>('check', source);
}

/** `source` formatted as `emela fmt` does; unchanged, with diagnostics, on a syntax error. */
export function formatEmela(source: string): Promise<Formatted> {
  return request<Formatted>('format', source);
}

/**
 * Compiles `source` and runs it, as `emela run main.emel`. `onChunk` sees each write as it
 * happens; the returned result has all of them.
 */
export async function runEmela(
  source: string,
  { timeoutMs = 10_000, onChunk }: { timeoutMs?: number; onChunk?: (chunk: Chunk) => void } = {},
): Promise<RunResult> {
  const compiled = await request<Compiled>('compile', source);
  const result: RunResult = {
    diagnostics: compiled.diagnostics,
    compiled: compiled.ok,
    output: [],
    exitCode: null,
    timedOut: false,
  };
  if (!compiled.ok) return result;

  const worker = new Worker(`${BASE}/run-worker.js`, { type: 'module' });
  return new Promise<RunResult>((resolve) => {
    const done = () => {
      clearTimeout(timer);
      worker.terminate();
      resolve(result);
    };
    const timer = setTimeout(() => {
      result.timedOut = true;
      done();
    }, timeoutMs);
    worker.onmessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'out') {
        const chunk = { fd: message.fd, text: message.text } as Chunk;
        result.output.push(chunk);
        onChunk?.(chunk);
      } else if (message.type === 'exit') {
        result.exitCode = message.code;
        done();
      }
    };
    worker.onerror = (event) => {
      result.output.push({ fd: 2, text: `${event.message}\n` });
      result.exitCode = 1;
      done();
    };
    worker.postMessage({ files: compiled.files, entry: compiled.entry });
  });
}
