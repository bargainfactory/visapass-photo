/**
 * Crop calculator — turns a FaceAnalysis + DocumentSpec into a precise crop rect
 * that satisfies the country's head-size and eye-line constraints.
 *
 * Warnings are returned as i18n keys + interpolation params so the UI layer can
 * translate them in the active locale.
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
  const targetHeadRatio = midpoint(doc.headHeightRatio);
  const targetEyeFromBottom = midpoint(doc.eyeLineFromBottom);
  const photoAspect = doc.widthMm / doc.heightMm;

  let photoHeight = face.headHeightPx / targetHeadRatio;
  let photoWidth = photoHeight * photoAspect;

  const cx = (face.eyeLine.x + face.chin.x) / 2;
  let x = cx - photoWidth / 2;

  const eyeFromTop = (1 - targetEyeFromBottom) * photoHeight;
  let y = face.eyeLine.y - eyeFromTop;

  if (x < 0 || y < 0 || x + photoWidth > imageWidth || y + photoHeight > imageHeight) {
    const scale = Math.min(imageWidth / photoWidth, imageHeight / photoHeight) * 0.98;
    photoWidth *= scale;
    photoHeight *= scale;
    x = Math.max(0, Math.min(cx - photoWidth / 2, imageWidth - photoWidth));
    y = Math.max(
      0,
      Math.min(face.eyeLine.y - (1 - targetEyeFromBottom) * photoHeight, imageHeight - photoHeight)
    );
    warnings.push({ key: 'scaledDown' });
  }

  if (face.confidence < 0.6) {
    warnings.push({ key: 'lowConfidence', params: { pct: (face.confidence * 100).toFixed(0) } });
  }

  return { x, y, width: photoWidth, height: photoHeight, aspect: photoAspect, warnings };
}
