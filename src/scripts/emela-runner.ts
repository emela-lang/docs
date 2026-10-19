// Shared client-side helper: runs Emela source through the wasm worker.
//
// A single module worker (public/wasm/emela/emela-worker.js) is created lazily
// on the first run and reused. Requests are correlated by id so several code
// blocks can share the one worker. A stuck run (e.g. an infinite loop) is
// bounded by a timeout that terminates and resets the worker.

/** The parsed result of `emela::run` (see crates/emela-wasm/src/lib.rs). */
export interface RunResult {
  /** `false` on a compile / type error; `true` even if the program trapped. */
  ok: boolean;
  stdout: string;
  stderr: string;
  /** Exit code when the program exited cleanly, else `null`. */
  exit_code: number | null;
  /** Runtime trap message (`panic` / `unreachable`), else `null`. */
  trap: string | null;
  /** Rendered compile / type diagnostic, else `null`. */
  error: string | null;
}

// Resolve under Astro's configured base so the Playground works both at the
// site root in dev and under `base` when one is configured. BASE_URL may
// or may not carry a trailing slash depending on config, so strip any and join
// with exactly one.
const WORKER_URL = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/wasm/emela/emela-worker.js`;

interface Pending {
  resolve: (r: RunResult) => void;
  reject: (e: Error) => void;
}

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, Pending>();

function getWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(WORKER_URL, { type: 'module' });
  w.onmessage = (event: MessageEvent) => {
    const { id, ok, result, error } = event.data || {};
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);
    if (ok) entry.resolve(result as RunResult);
    else entry.reject(new Error(error || 'worker error'));
  };
  w.onerror = (event) => {
    killWorker(new Error(event.message || 'worker crashed'));
  };
  worker = w;
  return w;
}

/** Terminate the worker and fail every in-flight request. */
function killWorker(err: Error): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  for (const { reject } of pending.values()) reject(err);
  pending.clear();
}

/** Compile and run `source`, resolving with its captured output. */
export function runEmela(source: string, timeoutMs = 10_000): Promise<RunResult> {
  const w = getWorker();
  const id = ++seq;
  return new Promise<RunResult>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (!pending.has(id)) return;
      pending.delete(id);
      killWorker(new Error('timeout'));
      reject(
        new Error(
          `実行がタイムアウトしました（${timeoutMs / 1000}s）。無限ループの可能性があります。`,
        ),
      );
    }, timeoutMs);
    pending.set(id, {
      resolve: (r) => {
        clearTimeout(timer);
        resolve(r);
      },
      reject: (e) => {
        clearTimeout(timer);
        reject(e);
      },
    });
    w.postMessage({ id, source });
  });
}
