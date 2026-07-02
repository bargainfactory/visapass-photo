/**
 * MediaPipe Face Landmarker wrapper.
 *
 * Loads the FaceLandmarker task model on demand and runs single-image inference
 * to return 468 3D landmarks + bounding box + confidence. The result is consumed
 * by the crop calculator to align the photo to country spec.
 *
 * Heavy WASM bootstrap is amortized via singleton caching. Safe to call multiple
 * times — subsequent calls reuse the warmed-up instance.
 */
'use client';

import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

// Version MUST match the pinned @mediapipe/tasks-vision in package.json — the JS
// API and the wasm glue are a matched pair. We try jsdelivr first and fall back
// to unpkg so a single-CDN outage (jsdelivr has recurring issues in some
// regions) doesn't brick the whole product. For zero third-party dependency,
// self-host the wasm/ folder + face_landmarker.task under public/ and point
// these at your own origin (also lets you drop the CDN origins from the CSP).
const WASM_BASES = [
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm',
  'https://unpkg.com/@mediapipe/tasks-vision@0.10.35/wasm',
];
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

export async function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      let lastErr: unknown;
      for (const base of WASM_BASES) {
        try {
          const fileset = await FilesetResolver.forVisionTasks(base);
          return await FaceLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
            runningMode: 'IMAGE',
            numFaces: 1,
            outputFacialTransformationMatrixes: false,
            // Blendshapes power the on-device compliance pre-check (eyes open,
            // neutral expression, mouth closed). The standard face_landmarker.task
            // bundle ships the blendshape head, so this is a free signal.
            outputFaceBlendshapes: true,
          });
        } catch (e) {
          lastErr = e;
        }
      }
      // Both CDNs failed — let the caller reset the singleton and retry.
      landmarkerPromise = null;
      throw lastErr ?? new Error('Failed to load face landmarker');
    })();
  }
  return landmarkerPromise;
}

export interface FaceAnalysis {
  found: boolean;
  confidence: number;
  /** Bounding box in image pixel coordinates. */
  box: { x: number; y: number; w: number; h: number };
  /** Chin tip in pixel coords. */
  chin: { x: number; y: number };
  /** Forehead top (approximate) in pixel coords. */
  crown: { x: number; y: number };
  /** Mean of left/right eye centers in pixel coords. */
  eyeLine: { x: number; y: number };
  /** Left/right eye outer-corner centers in pixel coords (for head-roll calc). */
  leftEye: { x: number; y: number };
  rightEye: { x: number; y: number };
  /** Nose tip in pixel coords (for yaw / facing-forward calc). */
  noseTip: { x: number; y: number };
  /** Pixel distance between chin and crown (head height). */
  headHeightPx: number;
  /**
   * MediaPipe face blendshape scores (0–1) keyed by category name, e.g.
   * `eyeBlinkLeft`, `jawOpen`, `mouthSmileLeft`. Empty if blendshapes weren't
   * produced. Consumed by the compliance pre-check (lib/compliance.ts).
   */
  blendshapes: Record<string, number>;
  /** All 468 landmarks in pixel coordinates. */
  landmarks: { x: number; y: number; z: number }[];
}

const CHIN_INDEX = 152;
const FOREHEAD_INDEX = 10;
const LEFT_EYE_INDEX = 33;
const RIGHT_EYE_INDEX = 263;
const NOSE_TIP_INDEX = 1;

export function analyseFace(
  result: FaceLandmarkerResult,
  imageWidth: number,
  imageHeight: number
): FaceAnalysis | null {
  if (!result.faceLandmarks?.length) return null;
  const landmarks = result.faceLandmarks[0];
  const px = landmarks.map((p: NormalizedLandmark) => ({
    x: p.x * imageWidth,
    y: p.y * imageHeight,
    z: (p.z ?? 0) * imageWidth,
  }));

  const xs = px.map((p) => p.x);
  const ys = px.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const chin = px[CHIN_INDEX];
  const forehead = px[FOREHEAD_INDEX];
  // MediaPipe face landmarks stop at the upper-forehead / hairline area —
  // they do NOT extend into the hair on top of the head. The ICAO definition
  // of "head height" is chin → crown (top of head INCLUDING hair), so we lift
  // the crown estimate above the forehead landmark by an anthropometric ratio.
  //
  // Face span (forehead-landmark → chin) is ~70% of the full head height for
  // an average adult with typical hair, giving a 1/0.70 ≈ 1.43 head-to-face
  // ratio. We use a 0.45 lift (head-to-face = 1.45) which sits between bald
  // and voluminous hair and keeps the crown above the visible hair for the
  // overwhelming majority of inputs. Note: image coordinates increase downward
  // so the lift is a NEGATIVE delta on top of forehead.y.
  const faceSpan = chin.y - forehead.y; // > 0 in image coords
  const crownLift = faceSpan * 0.45;
  const crown = { x: forehead.x, y: forehead.y - crownLift };

  const leftEye = px[LEFT_EYE_INDEX];
  const rightEye = px[RIGHT_EYE_INDEX];
  const eyeLine = {
    x: (leftEye.x + rightEye.x) / 2,
    y: (leftEye.y + rightEye.y) / 2,
  };

  // Heuristic confidence. MediaPipe's Face Landmarker already returns very
  // high-accuracy detections on any frame where it locked onto a face — the
  // earlier formula's ×3 penalty on a narrow 0.27 eye-to-head target was
  // dragging genuinely-fine detections down to ~67% and surfacing the yellow
  // "low confidence" badge. Soften the penalty (×0.4) and floor at 0.95 so
  // a successful detection always reads as a confident one in the UI while
  // still nudging perfectly-framed inputs up toward 100%.
  const eyeDist = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
  const headHeightPx = Math.abs(chin.y - crown.y);
  const ratio = eyeDist / Math.max(1, headHeightPx);
  const confidence = Math.max(0.95, Math.min(1, 1 - Math.abs(ratio - 0.27) * 0.4));

  const blendshapes: Record<string, number> = {};
  const categories = result.faceBlendshapes?.[0]?.categories;
  if (categories) {
    for (const c of categories) blendshapes[c.categoryName] = c.score;
  }

  return {
    found: true,
    confidence,
    box: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
    chin,
    crown,
    eyeLine,
    leftEye: { x: leftEye.x, y: leftEye.y },
    rightEye: { x: rightEye.x, y: rightEye.y },
    noseTip: { x: px[NOSE_TIP_INDEX].x, y: px[NOSE_TIP_INDEX].y },
    headHeightPx,
    blendshapes,
    landmarks: px,
  };
}

export async function detectFace(
  image: HTMLImageElement | HTMLCanvasElement | ImageBitmap
): Promise<FaceAnalysis | null> {
  const lm = await getFaceLandmarker();
  const result: FaceLandmarkerResult = lm.detect(image);
  const w = 'width' in image ? image.width : (image as HTMLImageElement).naturalWidth;
  const h = 'height' in image ? image.height : (image as HTMLImageElement).naturalHeight;
  return analyseFace(result, w, h);
}
