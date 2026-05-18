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
  // The hairline / crown sits ~1.4x above the forehead landmark relative to chin.
  // Empirical correction so head height includes hair, matching ICAO measurement.
  const crownLift = (forehead.y - chin.y) * 0.18;
  const crown = { x: forehead.x, y: forehead.y + crownLift };

  const leftEye = px[LEFT_EYE_INDEX];
  const rightEye = px[RIGHT_EYE_INDEX];
  const eyeLine = {
    x: (leftEye.x + rightEye.x) / 2,
    y: (leftEye.y + rightEye.y) / 2,
  };

  // Heuristic confidence: tightness of bounding box vs detected face, with eye distance sanity check.
  const eyeDist = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
  const headHeightPx = Math.abs(chin.y - crown.y);
  const ratio = eyeDist / Math.max(1, headHeightPx);
  // Healthy eye distance is ~30-45% of head height for a frontal portrait.
  const confidence = Math.max(0, Math.min(1, 1 - Math.abs(ratio - 0.37) * 3));

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
