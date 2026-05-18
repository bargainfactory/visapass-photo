/**
 * Canvas compositor — assembles the final passport/visa photo.
 *
 * Stages:
 *   1. Load source image at full resolution.
 *   2. Receive a background-removed RGBA mask layer (from the worker).
 *   3. Apply solid background color (country spec).
 *   4. Crop to the calculated rect.
 *   5. Resize to print-ready dimensions (mm → px at target DPI).
 *   6. Apply optional brightness/contrast tweaks.
 *   7. Export JPEG @ Q=0.95 and a print sheet (4-up or 8-up) for $0.10/2c/etc print runs.
 */
import { mmToPx } from './utils';
import type { CropRect } from './crop-calculator';
import type { DocumentSpec } from './countries';

export interface CompositeOptions {
  /** Source photo as ImageBitmap (full resolution). */
  source: ImageBitmap | HTMLImageElement;
  /** Background-removed RGBA blob (transparent background). Optional — composite the source if absent. */
  cutoutBlob?: Blob | null;
  doc: DocumentSpec;
  crop: CropRect;
  /** -100..100 */
  brightness?: number;
  /** -100..100 */
  contrast?: number;
  /** Force background hex (overrides doc.background). */
  backgroundHex?: string;
}

export interface CompositeResult {
  /** Final compliant photo as a JPEG data URL. */
  dataUrl: string;
  /** Print-sheet (4-up) as a JPEG data URL — 4×6 inch @ 300DPI. */
  printSheetDataUrl: string;
  /** Pixel dimensions of the final compliant photo. */
  pixelWidth: number;
  pixelHeight: number;
}

async function blobToImageBitmap(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob);
}

function applyFilters(ctx: CanvasRenderingContext2D, brightness = 0, contrast = 0) {
  // CSS-style filter: brightness(1.0±) contrast(1.0±). Range -100..100 maps to 0.5..1.5.
  const b = 1 + brightness / 200;
  const c = 1 + contrast / 200;
  ctx.filter = `brightness(${b}) contrast(${c})`;
}

export async function composeFinal({
  source,
  cutoutBlob,
  doc,
  crop,
  brightness = 0,
  contrast = 0,
  backgroundHex,
}: CompositeOptions): Promise<CompositeResult> {
  const bg = backgroundHex ?? doc.background;
  const outW = mmToPx(doc.widthMm, doc.dpi);
  const outH = mmToPx(doc.heightMm, doc.dpi);

  // Step 1: build a high-res working canvas at crop dimensions so we can resize cleanly.
  const work = document.createElement('canvas');
  work.width = Math.round(crop.width);
  work.height = Math.round(crop.height);
  const wctx = work.getContext('2d', { willReadFrequently: false })!;

  // Background fill first.
  wctx.fillStyle = bg;
  wctx.fillRect(0, 0, work.width, work.height);

  applyFilters(wctx, brightness, contrast);

  if (cutoutBlob) {
    // Draw the cut-out subject (transparent background already removed).
    const cutout = await blobToImageBitmap(cutoutBlob);
    wctx.drawImage(
      cutout,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      work.width,
      work.height
    );
  } else {
    // Fallback — composite raw source.
    wctx.drawImage(
      source,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      work.width,
      work.height
    );
  }
  wctx.filter = 'none';

  // Step 2: downscale to final compliant dimensions with high-quality smoothing.
  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;
  const octx = out.getContext('2d')!;
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(work, 0, 0, outW, outH);
  const dataUrl = out.toDataURL('image/jpeg', 0.95);

  // Step 3: build a 4×6 print sheet at 300 DPI with multiple copies arranged in a grid.
  const sheetW = mmToPx(152.4, doc.dpi); // 6 inch
  const sheetH = mmToPx(101.6, doc.dpi); // 4 inch
  const sheet = document.createElement('canvas');
  sheet.width = sheetW;
  sheet.height = sheetH;
  const sctx = sheet.getContext('2d')!;
  sctx.fillStyle = '#FFFFFF';
  sctx.fillRect(0, 0, sheetW, sheetH);
  // Center photos with 4mm bleed/margins.
  const margin = mmToPx(4, doc.dpi);
  const cols = Math.max(1, Math.floor((sheetW - margin) / (outW + margin)));
  const rows = Math.max(1, Math.floor((sheetH - margin) / (outH + margin)));
  const totalW = cols * outW + (cols - 1) * margin;
  const totalH = rows * outH + (rows - 1) * margin;
  const startX = Math.round((sheetW - totalW) / 2);
  const startY = Math.round((sheetH - totalH) / 2);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      sctx.drawImage(out, startX + c * (outW + margin), startY + r * (outH + margin));
    }
  }
  // Faint crop guides for cutting.
  sctx.strokeStyle = 'rgba(150,150,150,0.35)';
  sctx.lineWidth = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      sctx.strokeRect(startX + c * (outW + margin), startY + r * (outH + margin), outW, outH);
    }
  }
  const printSheetDataUrl = sheet.toDataURL('image/jpeg', 0.95);

  return { dataUrl, printSheetDataUrl, pixelWidth: outW, pixelHeight: outH };
}
