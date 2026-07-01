/**
 * Web Worker wrapper for @imgly/background-removal.
 *
 * The worker is constructed lazily and reused across calls; the model only
 * downloads once. The host thread sends an ImageBitmap (or Blob) and receives
 * an RGBA cutout Blob. The worker handles its own progress reporting via
 * postMessage so the UI can show "Refining hair edges…" etc.
 */
'use client';

type WorkerResponse =
  | { type: 'progress'; key: string; current: number; total: number }
  | { type: 'result'; blob: Blob }
  | { type: 'error'; message: string };

let workerInstance: Worker | null = null;
let pendingCounter = 0;
const pending = new Map<
  number,
  { resolve: (blob: Blob) => void; reject: (e: Error) => void; onProgress?: (label: string, ratio: number) => void }
>();

function ensureWorker(): Worker {
  if (workerInstance) return workerInstance;
  workerInstance = new Worker(new URL('../workers/background-removal.worker.ts', import.meta.url), {
    type: 'module',
  });
  workerInstance.onmessage = (e: MessageEvent<WorkerResponse & { id: number }>) => {
    const { id, ...data } = e.data;
    const entry = pending.get(id);
    if (!entry) return;
    if (data.type === 'progress') {
      entry.onProgress?.(data.key, data.total ? data.current / data.total : 0);
    } else if (data.type === 'result') {
      entry.resolve(data.blob);
      pending.delete(id);
    } else if (data.type === 'error') {
      entry.reject(new Error(data.message));
      pending.delete(id);
    }
  };
  // If the worker script itself fails to load/parse (bundler regression, CSP,
  // a throw outside the onmessage try/catch), `onmessage` never fires and every
  // pending promise would hang the editor at "Processing background…" forever.
  // Reject all in-flight calls and tear down so the next call retries clean.
  const fail = (message: string) => {
    for (const [id, entry] of pending) {
      entry.reject(new Error(message));
      pending.delete(id);
    }
    try {
      workerInstance?.terminate();
    } catch {
      /* ignore */
    }
    workerInstance = null;
  };
  workerInstance.onerror = (e) => fail(e.message || 'Background-removal worker crashed');
  workerInstance.onmessageerror = () => fail('Background-removal worker message error');
  return workerInstance;
}

export function removeBackground(
  input: Blob,
  onProgress?: (label: string, ratio: number) => void
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const id = ++pendingCounter;
    pending.set(id, { resolve, reject, onProgress });
    const w = ensureWorker();
    w.postMessage({ id, type: 'remove', input });
  });
}

let warmed = false;
/**
 * Force the ~22 MB background-removal model + wasm to download early (during
 * country selection) by running the pipeline on a throwaway 1×1 pixel. The
 * model download dominates; inference on one pixel is instant. Best-effort and
 * idempotent — failures are swallowed so warmup never blocks the real flow.
 */
export async function warmupBackgroundRemoval(): Promise<void> {
  if (warmed || typeof document === 'undefined') return;
  warmed = true;
  try {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    const blob: Blob | null = await new Promise((res) => c.toBlob((b) => res(b), 'image/png'));
    if (blob) await removeBackground(blob);
  } catch {
    warmed = false; // allow a later retry if warmup failed
  }
}
