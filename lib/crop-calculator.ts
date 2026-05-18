/**
 * Crop calculator — turns a FaceAnalysis + DocumentSpec into a precise crop rect
 * that satisfies the country's head-size and eye-line constraints.
 *
 * Algorithm:
 *   1. Pick target ratios at the midpoint of the spec's allowed ranges.
 *   2. Solve for the photo's pixel height so that head_height_px == target_ratio * photo_height.
 *   3. Solve for photo width from the document aspect ratio.
 *   4. Position the crop so the eyeLine.y sits at the target eye-line height,
 *      and chin/eyeLine.x is horizontally centered.
 *   5. Clamp crop to image bounds — if the crop exceeds the source image, we
 *      shrink uniformly and report a warning rather than returning a black margin.
 */
import type { DocumentSpec } from './countries';
import { midpoint } from './countries';
import type { FaceAnalysis } from './face-landmarker';

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Photo aspect ratio (w / h) applied. */
  aspect: number;
  warnings: string[];
}

export function calculateCrop(
  face: FaceAnalysis,
  doc: DocumentSpec,
  imageWidth: number,
  imageHeight: number
): CropRect {
  const warnings: string[] = [];
  const targetHeadRatio = midpoint(doc.headHeightRatio);
  const targetEyeFromBottom = midpoint(doc.eyeLineFromBottom);

  const photoAspect = doc.widthMm / doc.heightMm;

  // Height of final photo in source-image pixel space so head fills the target ratio.
  let photoHeight = face.headHeightPx / targetHeadRatio;
  let photoWidth = photoHeight * photoAspect;

  // Centered horizontally on the midpoint of the face.
  const cx = (face.eyeLine.x + face.chin.x) / 2;
  let x = cx - photoWidth / 2;

  // Eye line sits at (1 - targetEyeFromBottom) * photoHeight from the top of the photo.
  const eyeFromTop = (1 - targetEyeFromBottom) * photoHeight;
  let y = face.eyeLine.y - eyeFromTop;

  // Clamp / scale-down if crop spills outside the source image.
  if (x < 0 || y < 0 || x + photoWidth > imageWidth || y + photoHeight > imageHeight) {
    const maxByWidth = imageWidth;
    const maxByHeight = imageHeight;
    const scale = Math.min(maxByWidth / photoWidth, maxByHeight / photoHeight) * 0.98;
    photoWidth *= scale;
    photoHeight *= scale;
    x = Math.max(0, Math.min(cx - photoWidth / 2, imageWidth - photoWidth));
    y = Math.max(
      0,
      Math.min(face.eyeLine.y - (1 - targetEyeFromBottom) * photoHeight, imageHeight - photoHeight)
    );
    warnings.push(
      'Photo was scaled down to fit the source image — for highest quality, upload a higher-resolution photo.'
    );
  }

  if (face.confidence < 0.6) {
    warnings.push(
      `Face detection confidence is ${(face.confidence * 100).toFixed(0)}%. Consider a clearer, well-lit, front-facing photo.`
    );
  }

  return {
    x,
    y,
    width: photoWidth,
    height: photoHeight,
    aspect: photoAspect,
    warnings,
  };
}
