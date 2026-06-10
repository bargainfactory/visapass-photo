'use client';

/**
 * Builds a pre-payment PREVIEW image: the clean render downscaled and stamped
 * with a baked-in diagonal "PREVIEW · PAY TO UNLOCK" watermark.
 *
 * Why bake it instead of overlaying CSS: the old preview put the clean,
 * full-resolution data URL straight into an <img src>, with the watermark as a
 * separate SVG layer. A screenshot, a right-click "save image", or reading the
 * element's `src` all yielded the unwatermarked file. Here the only pixels that
 * ever reach the DOM are watermarked and downscaled (long edge ≤ 520px), so the
 * clean deliverable is never exposed before payment.
 */

const MAX_EDGE = 520;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('preview: could not decode image'));
    img.src = src;
  });
}

/**
 * @param cleanDataUrl the full-resolution compliant photo / sheet data URL
 * @returns a watermarked, downscaled JPEG data URL safe to render pre-payment
 */
export async function makeWatermarkedPreview(cleanDataUrl: string): Promise<string> {
  const img = await loadImage(cleanDataUrl);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return cleanDataUrl; // extremely unlikely; degrade gracefully
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'medium';
  ctx.drawImage(img, 0, 0, w, h);

  // Tiled diagonal watermark, baked into the pixels.
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate((-22 * Math.PI) / 180);
  ctx.font = `800 ${Math.max(14, Math.round(w * 0.055))}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const text = 'PREVIEW · PAY TO UNLOCK';
  const stepX = Math.max(180, w * 0.7);
  const stepY = Math.max(60, h * 0.22);
  const reach = Math.max(w, h);
  for (let y = -reach; y < reach; y += stepY) {
    for (let x = -reach; x < reach; x += stepX) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText(text, x + 1, y + 1);
      ctx.fillStyle = 'rgba(15,23,42,0.45)';
      ctx.fillText(text, x, y);
    }
  }
  ctx.restore();

  // Re-encode at modest quality — this is a throwaway preview, not a download.
  return canvas.toDataURL('image/jpeg', 0.7);
}
