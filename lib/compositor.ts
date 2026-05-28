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
  /**
   * Back of the print-sheet as a JPEG data URL — only produced when the
   * document spec sets `requiresBackTemplate` (currently Canada). Contains
   * the guarantor certification layout: brand header + live date + signature
   * lines. Same physical size & orientation as the front sheet.
   */
  printSheetBackDataUrl: string | null;
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

  // Step 3: build the 4×6 print sheet using the best gang-up for this photo
  // size. Done BEFORE the crop marks are drawn on `out` so the gang-up uses
  // a clean copy — the print sheet has its own grid-level cut guides between
  // photos and doesn't need both styles.
  const printSheetDataUrl = renderPrintSheet(out, doc.widthMm, doc.heightMm, doc.dpi);

  // Step 4: if this document requires a guarantor back-of-sheet (Canada),
  // also produce a matching 4×6 back canvas with the certification layout.
  const printSheetBackDataUrl = doc.requiresBackTemplate
    ? renderBackSheet(doc.widthMm, doc.heightMm, doc.dpi)
    : null;

  // Step 5: stamp subtle corner crop marks on the single compliant image so
  // a user printing it on plain paper has a precise cut guide. The print
  // sheet was already generated above from the clean canvas — marks are
  // only on the digital download.
  drawCropMarks(out, doc.dpi);
  const dataUrl = out.toDataURL('image/jpeg', 0.95);

  return {
    dataUrl,
    printSheetDataUrl,
    printSheetBackDataUrl,
    pixelWidth: outW,
    pixelHeight: outH,
  };
}

/* -------------------------------------------------------------------------- */
/*  Crop marks — corner ticks for trimming the single compliant photo.        */
/* -------------------------------------------------------------------------- */

/**
 * Draws four L-shaped corner crop marks on the canvas, anchored to the four
 * physical corners of the photo. Each leg is 3 mm long, ~0.3 mm thick (scaled
 * to DPI), pure black so it reads on both white and tinted backgrounds.
 *
 *   ┌─                 ─┐
 *   │                   │
 *
 *
 *   │                   │
 *   └─                 ─┘
 *
 * Only stamped on the single compliant image — the print sheet has its own
 * grid-level cut guides between photos and would get redundant marks if we
 * drew these before generating it.
 */
function drawCropMarks(canvas: HTMLCanvasElement, dpi: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const lenPx = Math.max(8, Math.round(mmToPx(3, dpi)));
  const thicknessPx = Math.max(1, Math.round(mmToPx(0.3, dpi)));
  ctx.save();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = thicknessPx;
  ctx.lineCap = 'butt';
  const w = canvas.width;
  const h = canvas.height;
  // Pixel-align the strokes so the marks render crisp at any DPI.
  const off = thicknessPx / 2;
  ctx.beginPath();
  // Top-left corner
  ctx.moveTo(off, off); ctx.lineTo(lenPx, off);
  ctx.moveTo(off, off); ctx.lineTo(off, lenPx);
  // Top-right corner
  ctx.moveTo(w - lenPx, off); ctx.lineTo(w - off, off);
  ctx.moveTo(w - off, off); ctx.lineTo(w - off, lenPx);
  // Bottom-left corner
  ctx.moveTo(off, h - lenPx); ctx.lineTo(off, h - off);
  ctx.moveTo(off, h - off); ctx.lineTo(lenPx, h - off);
  // Bottom-right corner
  ctx.moveTo(w - lenPx, h - off); ctx.lineTo(w - off, h - off);
  ctx.moveTo(w - off, h - lenPx); ctx.lineTo(w - off, h - off);
  ctx.stroke();
  ctx.restore();
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

/* -------------------------------------------------------------------------- */
/*  Back-of-sheet certification template (Canada).                            */
/* -------------------------------------------------------------------------- */

/**
 * Produce a 4×6 print-sheet back side that mirrors the FRONT gang-up layout —
 * one mini-certification per photo cell. Each cell on the back lines up with
 * its photo on the front, so cutting along the same grid lines produces N
 * standalone passport photos with their own guarantor certification on the
 * reverse side.
 *
 * Per-cell layout:
 *
 *     VisaPass Photo
 *     Digital Passport Photos
 *     visapassphoto.com
 *
 *     Photo taken  __________  DD/MM/YYYY
 *                              Date (DD/MM/YYYY)
 *
 *          I certify this to be a
 *             true likeness of
 *
 *     ___________________________________
 *              (applicant's name)
 *
 * The date is computed at render time so every cell reflects the day the
 * photo was generated.
 */
function renderBackSheet(photoWmm: number, photoHmm: number, dpi: number): string {
  const layout = pickSheetLayout(photoWmm, photoHmm, dpi);
  const sheet = document.createElement('canvas');
  sheet.width = layout.sheetWPx;
  sheet.height = layout.sheetHPx;
  const ctx = sheet.getContext('2d')!;

  // White paper background.
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, sheet.width, sheet.height);

  // Centre the grid on the sheet using the same offsets as the front.
  const gridW = layout.cols * layout.photoWPx;
  const gridH = layout.rows * layout.photoHPx;
  const startX = Math.round((sheet.width - gridW) / 2);
  const startY = Math.round((sheet.height - gridH) / 2);

  // Today's date (DD/MM/YYYY) — same value on every cell since the entire
  // sheet was rendered in one pass.
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yyyy = String(today.getFullYear());
  const dateStr = `${dd}/${mm}/${yyyy}`;

  for (let r = 0; r < layout.rows; r++) {
    for (let c = 0; c < layout.cols; c++) {
      drawBackCell(
        ctx,
        startX + c * layout.photoWPx,
        startY + r * layout.photoHPx,
        layout.photoWPx,
        layout.photoHPx,
        dateStr
      );
    }
  }

  // Cut-guide separators — same light grey lines as the front sheet so the
  // front and back align cut-for-cut when the print is duplexed.
  ctx.strokeStyle = '#D4D4D4';
  ctx.lineWidth = Math.max(1, Math.round(layout.sheetWPx / 1200));
  ctx.beginPath();
  for (let c = 1; c < layout.cols; c++) {
    const x = startX + c * layout.photoWPx + 0.5;
    ctx.moveTo(x, startY);
    ctx.lineTo(x, startY + gridH);
  }
  for (let r = 1; r < layout.rows; r++) {
    const y = startY + r * layout.photoHPx + 0.5;
    ctx.moveTo(startX, y);
    ctx.lineTo(startX + gridW, y);
  }
  ctx.rect(startX + 0.5, startY + 0.5, gridW, gridH);
  ctx.stroke();

  return sheet.toDataURL('image/jpeg', 0.95);
}

/**
 * Render a single guarantor-certification block sized to fill `[x,y,w,h]`
 * exactly. All vertical positions are expressed as fractions of `h` so the
 * layout scales gracefully across photo-size variants (Canada 50×70 mm fits
 * 4 cells; an EU 35×45 mm sheet would fit 6 cells with the same template).
 */
function drawBackCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  dateStr: string
) {
  const innerPadX = w * 0.07;
  const innerPadY = h * 0.06;
  const innerLeft = x + innerPadX;
  const innerRight = x + w - innerPadX;
  const innerWidth = innerRight - innerLeft;
  const centerX = x + w / 2;

  // Type scale tied to the SHORTER side of the cell so portrait/landscape
  // both read comfortably. ~3.3% of the short edge ≈ ~7 pt for a 50 mm cell
  // at 300 DPI, which is the rough size of the original IRCC template.
  const baseFontPx = Math.max(8, Math.round(Math.min(w, h) * 0.033));
  const sans =
    '"Inter", "Helvetica Neue", Helvetica, Arial, "Segoe UI", system-ui, sans-serif';
  const serif = '"Georgia", "Times New Roman", Times, serif';

  ctx.save();
  ctx.fillStyle = '#0F172A';
  ctx.textBaseline = 'alphabetic';

  /* ─── Brand header ─────────────────────────────────────────────────────── */
  ctx.textAlign = 'center';
  let cursorY = y + innerPadY + baseFontPx * 1.4;

  ctx.font = `700 ${baseFontPx * 1.55}px ${sans}`;
  ctx.fillText('VisaPass Photo', centerX, cursorY);

  cursorY += baseFontPx * 1.25;
  ctx.font = `500 ${baseFontPx * 0.85}px ${sans}`;
  ctx.fillStyle = '#475569';
  ctx.fillText('Digital Passport Photos', centerX, cursorY);

  cursorY += baseFontPx * 1.05;
  ctx.font = `400 ${baseFontPx * 0.78}px ${sans}`;
  ctx.fillStyle = '#64748B';
  ctx.fillText('visapassphoto.com', centerX, cursorY);

  // Thin divider rule under the brand block.
  cursorY += baseFontPx * 0.9;
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = Math.max(0.6, Math.round(w / 800));
  ctx.beginPath();
  ctx.moveTo(innerLeft + innerWidth * 0.2, cursorY);
  ctx.lineTo(innerRight - innerWidth * 0.2, cursorY);
  ctx.stroke();

  /* ─── Photo-taken + live date ──────────────────────────────────────────── */
  cursorY += baseFontPx * 2.3;
  ctx.textAlign = 'start';
  ctx.fillStyle = '#0F172A';
  ctx.font = `500 ${baseFontPx * 0.9}px ${sans}`;
  const photoTakenLabel = 'Photo taken';
  ctx.fillText(photoTakenLabel, innerLeft, cursorY);
  const labelWidth = ctx.measureText(photoTakenLabel).width;

  ctx.font = `600 ${baseFontPx * 0.95}px ${sans}`;
  const dateWidth = ctx.measureText(dateStr).width;

  // Underline from after the label to just before the date.
  const lineStart = innerLeft + labelWidth + baseFontPx * 0.5;
  const lineEnd = innerRight - dateWidth - baseFontPx * 0.4;
  if (lineEnd > lineStart) {
    ctx.strokeStyle = '#1F2937';
    ctx.lineWidth = Math.max(0.8, Math.round(w / 600));
    ctx.beginPath();
    ctx.moveTo(lineStart, cursorY + baseFontPx * 0.1);
    ctx.lineTo(lineEnd, cursorY + baseFontPx * 0.1);
    ctx.stroke();
  }

  ctx.textAlign = 'end';
  ctx.fillText(dateStr, innerRight, cursorY);

  // Tiny caption under the date.
  ctx.font = `400 ${baseFontPx * 0.6}px ${sans}`;
  ctx.fillStyle = '#94A3B8';
  ctx.fillText('Date (DD/MM/YYYY)', innerRight, cursorY + baseFontPx * 0.85);

  /* ─── Certification block ──────────────────────────────────────────────── */
  cursorY += baseFontPx * 3.3;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0F172A';
  ctx.font = `italic 400 ${baseFontPx * 0.95}px ${serif}`;
  ctx.fillText('I certify this to be a', centerX, cursorY);
  cursorY += baseFontPx * 1.25;
  ctx.fillText('true likeness of', centerX, cursorY);

  /* ─── Signature line + caption ─────────────────────────────────────────── */
  cursorY += baseFontPx * 2.6;
  ctx.strokeStyle = '#1F2937';
  ctx.lineWidth = Math.max(0.8, Math.round(w / 600));
  ctx.beginPath();
  ctx.moveTo(innerLeft + innerWidth * 0.05, cursorY);
  ctx.lineTo(innerRight - innerWidth * 0.05, cursorY);
  ctx.stroke();

  cursorY += baseFontPx * 0.9;
  ctx.textAlign = 'center';
  ctx.font = `400 ${baseFontPx * 0.65}px ${sans}`;
  ctx.fillStyle = '#94A3B8';
  ctx.fillText("(applicant's name)", centerX, cursorY);

  ctx.restore();
}
