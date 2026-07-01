/**
 * Crop calculator — turns a FaceAnalysis + DocumentSpec into a precise crop rect
 * that satisfies the country's head-size and positioning constraints.
 *
 * Two positioning modes:
 *
 *   1) Crown-anchored (preferred when the spec provides absolute mm).
 *      Used by e.g. US passport/visa — 3 mm from photo top to crown,
 *      head measures exactly 34 mm crown→chin, remaining 14 mm fills with
 *      shoulders/upper body. Head height in source pixels is scaled so that
 *      face.headHeightPx maps to doc.headHeightMm in the final photo, and the
 *      crop's top edge is placed `doc.crownFromTopMm` mm above face.crown.y.
 *
 *   2) Eye-line + ratio (default for specs that allow ranges).
 *      head fills target_ratio of the photo height; eye line sits at
 *      target_eye_from_bottom from the bottom. Used by Schengen, UK, etc.
 *
 * Warnings are returned as i18n keys + interpolation params so the UI layer
 * can translate them in the active locale.
 */
import type { DocumentSpec } from './countries';
import { midpoint } from './countries';
import type { FaceAnalysis } from './face-landmarker';

export interface CropWarning {
  key: 'scaledDown' | 'lowConfidence';
  params?: Record<string, string | number>;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
  aspect: number;
  warnings: CropWarning[];
}

export function calculateCrop(
  face: FaceAnalysis,
  doc: DocumentSpec,
  imageWidth: number,
  imageHeight: number
): CropRect {
  const warnings: CropWarning[] = [];
  const photoAspect = doc.widthMm / doc.heightMm;

  // --- 1) Vertical scale: how tall is the final crop in *source* pixels? ---
  // Whichever sizing mode is used, photoHeight is the height of the crop
  // rectangle in source-image coordinates. After we resample to the final
  // output dimensions, head_height_px becomes the target head height.
  let photoHeight: number;
  if (doc.headHeightMm != null) {
    // Absolute mm spec — head must end up exactly headHeightMm tall.
    // photoHeight / heightMm == face.headHeightPx / headHeightMm
    photoHeight = (face.headHeightPx * doc.heightMm) / doc.headHeightMm;
  } else {
    const targetHeadRatio = midpoint(doc.headHeightRatio);
    photoHeight = face.headHeightPx / targetHeadRatio;
  }
  let photoWidth = photoHeight * photoAspect;

  // --- 2) Horizontal placement: centre on the midpoint of the face. ---
  const cx = (face.eyeLine.x + face.chin.x) / 2;
  let x = cx - photoWidth / 2;

  // --- 3) Vertical placement: crown-anchored vs eye-line-anchored. ---
  let y: number;
  if (doc.crownFromTopMm != null) {
    // Top of crop = crown.y - (crownFromTopMm / heightMm) * photoHeight
    y = face.crown.y - (doc.crownFromTopMm / doc.heightMm) * photoHeight;
  } else {
    const targetEyeFromBottom = midpoint(doc.eyeLineFromBottom);
    const eyeFromTop = (1 - targetEyeFromBottom) * photoHeight;
    y = face.eyeLine.y - eyeFromTop;
  }

  // --- 4) Clamp / scale down if the desired crop spills outside the source. ---
  if (x < 0 || y < 0 || x + photoWidth > imageWidth || y + photoHeight > imageHeight) {
    // Only ever SHRINK the crop, never grow it. The fit ratio is >1 whenever
    // the crop is smaller than the source and merely sits off-edge (very common
    // when the crown anchor pushes y<0 on a tall photo). Capping at 1 means we
    // just reposition in that case; without the cap the crop would inflate to
    // fill the frame and the head would render far below the document spec.
    const fitScale = Math.min(imageWidth / photoWidth, imageHeight / photoHeight) * 0.98;
    const scale = Math.min(1, fitScale);
    photoWidth *= scale;
    photoHeight *= scale;
    x = Math.max(0, Math.min(cx - photoWidth / 2, imageWidth - photoWidth));
    if (doc.crownFromTopMm != null) {
      y = Math.max(
        0,
        Math.min(
          face.crown.y - (doc.crownFromTopMm / doc.heightMm) * photoHeight,
          imageHeight - photoHeight
        )
      );
    } else {
      const targetEyeFromBottom = midpoint(doc.eyeLineFromBottom);
      y = Math.max(
        0,
        Math.min(
          face.eyeLine.y - (1 - targetEyeFromBottom) * photoHeight,
          imageHeight - photoHeight
        )
      );
    }
    if (scale < 1) warnings.push({ key: 'scaledDown' });
  }

  if (face.confidence < 0.6) {
    warnings.push({ key: 'lowConfidence', params: { pct: (face.confidence * 100).toFixed(0) } });
  }

  return { x, y, width: photoWidth, height: photoHeight, aspect: photoAspect, warnings };
}

export interface CropAdjust {
  /** >1 zooms in (head larger); <1 zooms out. */
  zoom: number;
  /** Horizontal pan as a fraction of the base crop width (−0.5…0.5). */
  x: number;
  /** Vertical pan as a fraction of the base crop height (−0.5…0.5). */
  y: number;
}

export const IDENTITY_ADJUST: CropAdjust = { zoom: 1, x: 0, y: 0 };

/**
 * Apply a user zoom/pan on top of the auto-calculated crop, preserving the
 * document aspect ratio and clamping so the crop never leaves the source image.
 * Used by the manual "Framing" controls to rescue photos the auto-crop centred
 * imperfectly (hats, long hair, off-angle shots).
 */
export function applyCropAdjust(
  base: CropRect,
  adj: CropAdjust,
  imageWidth: number,
  imageHeight: number
): CropRect {
  // Never let the crop grow larger than the source (would require upscaling /
  // break the aspect); cap the effective zoom-out at the fit-to-image point.
  const minZoom = Math.max(base.width / imageWidth, base.height / imageHeight, 0.0001);
  const zoom = Math.max(minZoom, adj.zoom);
  const w = base.width / zoom;
  const h = base.height / zoom;
  const cx = base.x + base.width / 2 + adj.x * base.width;
  const cy = base.y + base.height / 2 + adj.y * base.height;
  const x = Math.max(0, Math.min(cx - w / 2, imageWidth - w));
  const y = Math.max(0, Math.min(cy - h / 2, imageHeight - h));
  return { ...base, x, y, width: w, height: h };
}
