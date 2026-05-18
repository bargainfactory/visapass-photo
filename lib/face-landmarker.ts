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

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

export async function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
      return FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        runningMode: 'IMAGE',
        numFaces: 1,
        outputFacialTransformationMatrixes: false,
        outputFaceBlendshapes: false,
      });
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
  /** Pixel distance between chin and crown (head height). */
  headHeightPx: number;
  /** All 468 landmarks in pixel coordinates. */
  landmarks: { x: number; y: number; z: number }[];
}

const CHIN_INDEX = 152;
const FOREHEAD_INDEX = 10;
const LEFT_EYE_INDEX = 33;
const RIGHT_EYE_INDEX = 263;

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

  // Heuristic confidence: with head height including hair, the eye distance is
  // typically ~25-30% of the full head height for a frontal portrait. Penalise
  // distance from that target.
  const eyeDist = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
  const headHeightPx = Math.abs(chin.y - crown.y);
  const ratio = eyeDist / Math.max(1, headHeightPx);
  const confidence = Math.max(0, Math.min(1, 1 - Math.abs(ratio - 0.27) * 3));

  return {
    found: true,
    confidence,
    box: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
    chin,
    crown,
    eyeLine,
    headHeightPx,
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
