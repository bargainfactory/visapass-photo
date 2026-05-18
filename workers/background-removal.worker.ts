/// <reference lib="webworker" />
/**
 * Web Worker — runs @imgly/background-removal off the main thread so the
 * MediaPipe inference and UI remain responsive even on mid-tier hardware.
 *
 * We bump the model up to "general" quality with high-res output, then return
 * the result as a Blob that the host thread can downscale and composite onto
 * a country-specific background color.
 */
import { removeBackground, type Config } from '@imgly/background-removal';

const ctx: DedicatedWorkerGlobalScope = self as any;

ctx.onmessage = async (e: MessageEvent) => {
  const { id, type, input } = e.data as { id: number; type: string; input: Blob };
  if (type !== 'remove') return;

  try {
    const config: Config = {
      output: { format: 'image/png', quality: 1 },
      model: 'isnet',
      progress: (key, current, total) => {
        ctx.postMessage({ id, type: 'progress', key, current, total });
      },
    };
    const blob = await removeBackground(input, config);
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
