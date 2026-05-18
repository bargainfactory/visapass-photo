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
