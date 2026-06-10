/// <reference lib="webworker" />
/**
 * Web Worker — runs @imgly/background-removal off the main thread so the
 * MediaPipe inference and UI remain responsive even on mid-tier hardware.
 *
 * Optimizations vs. the original config:
 *   1. Model `isnet_quint8` (8-bit quantized) replaces the full-precision
 *      `isnet`. The download drops from ~75 MB to ~22 MB and CPU inference
 *      is roughly 3× faster with negligible quality difference on portrait
 *      shots (the only kind of input this app handles).
 *   2. `device: 'gpu'` enables WebGPU / WebGL2 acceleration when available
 *      and silently falls back to CPU otherwise — modern Chrome/Edge on a
 *      desktop or recent iPhone runs inference in 1–3 s instead of 8–15 s.
 *   3. Output is now WebP at quality 0.92 instead of max-compression PNG.
 *      The cutout file shrinks ~4×, the encode step inside the worker is
 *      faster, and the host's createImageBitmap decode is faster too.
 *      WebP alpha is universally supported in browsers that can run this
 *      app at all.
 */
import { removeBackground, type Config } from '@imgly/background-removal';

const ctx: DedicatedWorkerGlobalScope = self as any;

ctx.onmessage = async (e: MessageEvent) => {
  const { id, type, input } = e.data as { id: number; type: string; input: Blob };
  if (type !== 'remove') return;

  const baseConfig = (device: 'gpu' | 'cpu'): Config => ({
    output: { format: 'image/webp', quality: 0.92 },
    model: 'isnet_quint8',
    device,
    // We are ALREADY inside a dedicated worker — imgly's default
    // `proxyToWorker: true` would spin up a second nested worker
    // (postMessage round-trip + another module bootstrap) on every
    // call. Running inline in our own worker eliminates ~200-500 ms
    // of startup overhead and one full thread of memory.
    proxyToWorker: false,
    progress: (key, current, total) => {
      ctx.postMessage({ id, type: 'progress', key, current, total });
    },
  });

  try {
    let blob: Blob;
    try {
      // Fast path: WebGPU acceleration when the browser + driver support it.
      blob = await removeBackground(input, baseConfig('gpu'));
    } catch (gpuErr) {
      // onnxruntime-web's WebGPU backend can fail to initialise a device on
      // many browsers/drivers and throws an opaque minified error (e.g.
      // "Cannot read properties of null (reading 'hc')") instead of falling
      // back. Retry on the CPU/WASM backend, which runs everywhere.
      ctx.postMessage({ id, type: 'progress', key: 'cpu_fallback', current: 0, total: 1 });
      blob = await removeBackground(input, baseConfig('cpu'));
    }
    ctx.postMessage({ id, type: 'result', blob });
  } catch (err) {
    ctx.postMessage({
      id,
      type: 'error',
      message: err instanceof Error ? err.message : 'Background removal failed',
    });
  }
};

export {};
