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
    const scale = Math.min(imageWidth / photoWidth, imageHeight / photoHeight) * 0.98;
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
    warnings.push({ key: 'scaledDown' });
  }

  if (face.confidence < 0.6) {
    warnings.push({ key: 'lowConfidence', params: { pct: (face.confidence * 100).toFixed(0) } });
  }

  return { x, y, width: photoWidth, height: photoHeight, aspect: photoAspect, warnings };
}
