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
  /**
   * Pre-decoded cutout ImageBitmap. Preferred over cutoutBlob because the
   * editor cache it once after background removal — every subsequent slider
   * tick reuses the same bitmap instead of paying the blob → bitmap decode
   * cost (~50-150 ms) on each recompose.
   */
  cutout?: ImageBitmap | null;
  doc: DocumentSpec;
  crop: CropRect;
  /** -50..50 — maps linearly to a brightness multiplier of 0.5×..1.5×. */
  brightness?: number;
  /** -50..50 — maps linearly to a contrast multiplier of 0.5×..1.5×. */
  contrast?: number;
  /**
   * -50..50 — Photoshop-inspired "Shadow" tone slider.
   *   · positive = crush shadows (raise the black point — dark areas
   *                become darker, similar to PS Levels' left-input arrow)
   *   · negative = lift shadows  (push the floor up — dark areas become
   *                brighter, similar to PS Curves dragging the bottom-left
   *                anchor upward)
   * Applied per-pixel after the brightness/contrast filter so the curve
   * acts on the already-tone-adjusted image.
   */
  shadow?: number;
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
  // Slider range ±50 maps to a CSS-style filter multiplier of 0.5×..1.5× —
  // i.e. brightness=+50 → +50% brighter, brightness=-50 → 50% darker. The
  // previous /200 mapping was too subtle (only ±25%) so users couldn't see
  // their adjustments; /100 gives a clearly visible delta on every tick.
  const b = 1 + brightness / 100;
  const c = 1 + contrast / 100;
  ctx.filter = `brightness(${b}) contrast(${c})`;
}

/**
 * Photoshop-style "Shadow" tone adjustment, run as a per-pixel pass on the
 * already-rendered output canvas. Slider range −50..+50.
 *
 *   · positive (crush)  raises the black point. Values below `bp` clip to 0,
 *                       the rest is remapped linearly to [0, 255]. Mirrors
 *                       what the left-input arrow in Photoshop Levels does.
 *   · negative (lift)   pushes the dark floor upward while leaving highlights
 *                       untouched: `out = in + lift * (1 - in/255)`. Closely
 *                       matches dragging the bottom-left anchor of the
 *                       Curves tool up.
 *   · zero              no-op (and we early-return without touching ImageData
 *                       for performance).
 *
 * The RGBA loop is the right tool here — there's no canvas `filter` value
 * for a clip/lift curve, and the same effect via SVG `feComponentTransfer`
 * would need a hidden filter element and a `filter: url()` reference. A
 * straight ImageData pass at 600×600 is < 5 ms on any modern laptop.
 */
function applyShadow(canvas: HTMLCanvasElement, shadow = 0) {
  if (!shadow) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;

  if (shadow > 0) {
    // Crush shadows: raise the black point to `bp` and remap [bp..255] to [0..255].
    const bp = (shadow / 100) * 255 * 0.6; // slider 50 → bp ≈ 76 (≈30% black point)
    const range = 255 - bp;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.max(0, ((d[i] - bp) / range) * 255);
      d[i + 1] = Math.max(0, ((d[i + 1] - bp) / range) * 255);
      d[i + 2] = Math.max(0, ((d[i + 2] - bp) / range) * 255);
    }
  } else {
    // Lift shadows: out = in + lift * (1 - in/255). Brightens darks, leaves
    // pure white alone (lift factor goes to 0 as input approaches 255).
    const lift = (-shadow / 50) * 60; // slider −50 → lift ≈ 60 grey-levels at v=0
    for (let i = 0; i < d.length; i += 4) {
      d[i] = d[i] + lift * (1 - d[i] / 255);
      d[i + 1] = d[i + 1] + lift * (1 - d[i + 1] / 255);
      d[i + 2] = d[i + 2] + lift * (1 - d[i + 2] / 255);
    }
  }

  ctx.putImageData(img, 0, 0);
}

export async function composeFinal({
  source,
  cutoutBlob,
  cutout,
  doc,
  crop,
  brightness = 0,
  contrast = 0,
  shadow = 0,
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

  // Prefer the caller-supplied (cached) cutout bitmap. Fall back to decoding
  // the blob, then to the raw source if no background removal was performed.
  let subject: ImageBitmap | HTMLImageElement | null = cutout ?? null;
  if (!subject && cutoutBlob) subject = await blobToImageBitmap(cutoutBlob);
  if (!subject) subject = source;
  wctx.drawImage(
    subject,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    work.width,
    work.height
  );
  wctx.filter = 'none';

  // Step 2: downscale to final compliant dimensions with high-quality smoothing.
  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;
  const octx = out.getContext('2d')!;
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(work, 0, 0, outW, outH);
  // Photoshop-inspired shadow tone curve, run on the downscaled output so
  // the per-pixel cost is bounded (≈ 360k pixels at 51×51 mm @ 300 DPI).
  // Cascades into the print sheet automatically because renderPrintSheet
  // copies from this same canvas.
  applyShadow(out, shadow);
  const dataUrl = out.toDataURL('image/jpeg', 0.95);

  // Step 3: build the 4×6 print sheet using the best gang-up for this photo size.
  const printSheetDataUrl = renderPrintSheet(out, doc.widthMm, doc.heightMm, doc.dpi);

  return { dataUrl, printSheetDataUrl, pixelWidth: outW, pixelHeight: outH };
}

/* -------------------------------------------------------------------------- */
/*  Print sheet — 4×6 inch gang-up with adaptive orientation & layout.        */
/* -------------------------------------------------------------------------- */

const SHEET_LONG_MM = 152.4; // 6 inch
const SHEET_SHORT_MM = 101.6; // 4 inch
// 1 mm safe-cut margin around the photo grid — most consumer print kiosks
// have a 1-2 mm bleed area at the paper edge, so we keep just enough breathing
// room to avoid hairline clipping while letting 51 mm × 51 mm (US 2×2") fit
// 6-up in landscape (which needs every micron of width).
const SHEET_OUTER_MARGIN_MM = 1;

interface SheetLayout {
  orientation: 'landscape' | 'portrait';
  cols: number;
  rows: number;
  /** Per-photo pixel size on the sheet — may be a touch smaller than spec
   *  if the gang-up needed a 0-2% downscale to fit the sheet exactly. */
  photoWPx: number;
  photoHPx: number;
  sheetWPx: number;
  sheetHPx: number;
}

/**
 * Pick the best layout for a given photo size:
 *   1. Try 6 photos in landscape (3 cols × 2 rows).
 *   2. Then 6 in portrait (2 × 3).
 *   3. Fall back to 4 in portrait (2 × 2).
 *   4. Last resort: 4 in landscape (2 × 2).
 *   5. Worst case: 1 photo on a portrait sheet.
 *
 * Each candidate is accepted if the photos fit inside the sheet's
 * inner-margin area allowing up to 2% downscale (absorbs tiny mm-rounding
 * overflows like the US 2×2" / 51 mm spec on a 152.4 mm sheet).
 */
export function pickSheetLayout(photoWmm: number, photoHmm: number, dpi: number): SheetLayout {
  const candidates: Array<{ orient: 'landscape' | 'portrait'; cols: number; rows: number }> = [
    { orient: 'landscape', cols: 3, rows: 2 }, // 6 across
    { orient: 'portrait', cols: 2, rows: 3 }, // 6 down
    { orient: 'portrait', cols: 2, rows: 2 }, // 4 portrait (Canada etc.)
    { orient: 'landscape', cols: 2, rows: 2 }, // 4 landscape
  ];

  for (const cand of candidates) {
    const sheetW = cand.orient === 'landscape' ? SHEET_LONG_MM : SHEET_SHORT_MM;
    const sheetH = cand.orient === 'landscape' ? SHEET_SHORT_MM : SHEET_LONG_MM;
    const availW = sheetW - 2 * SHEET_OUTER_MARGIN_MM;
    const availH = sheetH - 2 * SHEET_OUTER_MARGIN_MM;
    const reqW = cand.cols * photoWmm;
    const reqH = cand.rows * photoHmm;
    // Accept with up to 3% downscale — covers cases like US 2×2" (which is
    // technically 50.8 mm but we store as 51 mm) so 3-up fits within the 6"
    // sheet dimension after a sub-millimetre shave.
    if (reqW <= availW * 1.03 && reqH <= availH * 1.03) {
      const scale = Math.min(1, Math.min(availW / reqW, availH / reqH));
      return {
        orientation: cand.orient,
        cols: cand.cols,
        rows: cand.rows,
        photoWPx: Math.round(mmToPx(photoWmm * scale, dpi)),
        photoHPx: Math.round(mmToPx(photoHmm * scale, dpi)),
        sheetWPx: mmToPx(sheetW, dpi),
        sheetHPx: mmToPx(sheetH, dpi),
      };
    }
  }

  // Single photo fallback.
  return {
    orientation: 'portrait',
    cols: 1,
    rows: 1,
    photoWPx: mmToPx(photoWmm, dpi),
    photoHPx: mmToPx(photoHmm, dpi),
    sheetWPx: mmToPx(SHEET_SHORT_MM, dpi),
    sheetHPx: mmToPx(SHEET_LONG_MM, dpi),
  };
}

function renderPrintSheet(
  photoCanvas: HTMLCanvasElement,
  photoWmm: number,
  photoHmm: number,
  dpi: number
): string {
  const layout = pickSheetLayout(photoWmm, photoHmm, dpi);

  const sheet = document.createElement('canvas');
  sheet.width = layout.sheetWPx;
  sheet.height = layout.sheetHPx;
  const sctx = sheet.getContext('2d')!;

  // Pure white background — what every print kiosk expects.
  sctx.fillStyle = '#FFFFFF';
  sctx.fillRect(0, 0, sheet.width, sheet.height);

  // Centre the photo grid on the sheet.
  const gridW = layout.cols * layout.photoWPx;
  const gridH = layout.rows * layout.photoHPx;
  const startX = Math.round((sheet.width - gridW) / 2);
  const startY = Math.round((sheet.height - gridH) / 2);

  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = 'high';
  for (let r = 0; r < layout.rows; r++) {
    for (let c = 0; c < layout.cols; c++) {
      sctx.drawImage(
        photoCanvas,
        startX + c * layout.photoWPx,
        startY + r * layout.photoHPx,
        layout.photoWPx,
        layout.photoHPx
      );
    }
  }

  // Light-grey separator lines between photos (and around the grid) — easy
  // visual cut guide for the print kiosk without intruding on the photos.
  sctx.strokeStyle = '#D4D4D4';
  // Scale stroke proportional to sheet width so the line is visible at print size
  // (~1.5 px at 300 DPI) without dominating the photo edges.
  sctx.lineWidth = Math.max(1, Math.round(layout.sheetWPx / 1200));
  sctx.beginPath();
  for (let c = 1; c < layout.cols; c++) {
    const x = startX + c * layout.photoWPx + 0.5;
    sctx.moveTo(x, startY);
    sctx.lineTo(x, startY + gridH);
  }
  for (let r = 1; r < layout.rows; r++) {
    const y = startY + r * layout.photoHPx + 0.5;
    sctx.moveTo(startX, y);
    sctx.lineTo(startX + gridW, y);
  }
  sctx.rect(startX + 0.5, startY + 0.5, gridW, gridH);
  sctx.stroke();

  return sheet.toDataURL('image/jpeg', 0.95);
}
