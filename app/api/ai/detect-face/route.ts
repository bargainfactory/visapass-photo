/**
 * Server-side face detection — OPTIONAL fallback.
 *
 * Client-side MediaPipe Face Landmarker handles 95%+ of real-world inputs. Use
 * this route when you need:
 *   - Very low-quality / sub-300px source images
 *   - Profile shots or extreme rotations
 *   - Production SLAs / audit logging
 *
 * Suggested integrations:
 *   - Google Cloud Vision  (faceAnnotations)
 *   - AWS Rekognition       (DetectFaces)
 *   - Azure Face API        (returns landmarks + headPose)
 *   - InsightFace            (self-hosted, very accurate; ONNX or Triton)
 *
 * Contract:
 *   POST  multipart/form-data with field "image" (Blob)
 *   ->    JSON: { box, eyeLine, chin, crown, headHeightPx, confidence, landmarks[] }
 */
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest) {
  return NextResponse.json(
    {
      error:
        'Server-side face detection is intentionally a stub. Plug Google Cloud Vision, Rekognition, Azure Face, or InsightFace here.',
    },
    { status: 501 }
  );
}
