/**
 * On-device ICAO compliance pre-check.
 *
 * Runs entirely client-side on signals we already have — MediaPipe face
 * landmarks + blendshapes and the calculated crop — so it adds no upload, no
 * server cost, and keeps the "on-device AI" privacy promise. It catches the
 * most common reasons a passport/visa photo gets rejected BEFORE the buyer
 * pays, so they can re-take or adjust instead of getting their application
 * bounced.
 *
 * It is intentionally advisory (warn, don't block): blendshape thresholds can
 * misfire, so we surface guidance rather than gate the purchase.
 */
import type { DocumentSpec } from './countries';
import type { FaceAnalysis } from './face-landmarker';
import type { CropRect } from './crop-calculator';

export type ComplianceStatus = 'pass' | 'warn' | 'fail';
export type ComplianceId =
  | 'headSize'
  | 'eyesOpen'
  | 'expression'
  | 'headLevel'
  | 'facingForward';

export interface ComplianceCheck {
  id: ComplianceId;
  status: ComplianceStatus;
}

export interface ComplianceReport {
  checks: ComplianceCheck[];
  /** Worst status across all checks. */
  overall: ComplianceStatus;
}

function bs(face: FaceAnalysis, name: string): number {
  return face.blendshapes[name] ?? 0;
}

/** pass inside [min,max]; warn within 15% beyond the band; fail otherwise. */
function rangeStatus(value: number, min: number, max: number): ComplianceStatus {
  if (value >= min && value <= max) return 'pass';
  if (value >= min * 0.85 && value <= max * 1.15) return 'warn';
  return 'fail';
}

export function checkCompliance(
  face: FaceAnalysis,
  doc: DocumentSpec,
  crop: CropRect
): ComplianceReport {
  const checks: ComplianceCheck[] = [];

  // 1) HEAD SIZE — fraction of the final photo height the head occupies.
  // crop.height (source px) maps to the full photo height after resampling, so
  // the achieved head fraction is headHeightPx / crop.height. The crop targets
  // the spec, so this mainly catches low-res sources that had to be scaled down
  // (head ends up oversized / out of range).
  const achieved = crop.height > 0 ? face.headHeightPx / crop.height : 0;
  let lo: number;
  let hi: number;
  if (doc.headHeightMm != null) {
    const target = doc.headHeightMm / doc.heightMm;
    lo = target * 0.92;
    hi = target * 1.08;
  } else {
    [lo, hi] = doc.headHeightRatio;
  }
  checks.push({ id: 'headSize', status: rangeStatus(achieved, lo, hi) });

  // 2) EYES OPEN — high eyeBlink* score means the eye is closed.
  const blink = Math.max(bs(face, 'eyeBlinkLeft'), bs(face, 'eyeBlinkRight'));
  checks.push({
    id: 'eyesOpen',
    status: blink > 0.55 ? 'fail' : blink > 0.4 ? 'warn' : 'pass',
  });

  // 3) NEUTRAL EXPRESSION — open mouth (jawOpen) or a smile (mouthSmile*).
  const expr = Math.max(
    bs(face, 'jawOpen'),
    bs(face, 'mouthSmileLeft'),
    bs(face, 'mouthSmileRight')
  );
  checks.push({
    id: 'expression',
    status: expr > 0.55 ? 'fail' : expr > 0.35 ? 'warn' : 'pass',
  });

  // 4) HEAD LEVEL — roll angle from the eye line vs horizontal. Normalized to a
  // 0–90° deviation so it works regardless of which eye index sits left/right.
  const rawDeg =
    Math.abs(
      Math.atan2(face.rightEye.y - face.leftEye.y, face.rightEye.x - face.leftEye.x) *
        (180 / Math.PI)
    );
  const roll = Math.min(rawDeg, Math.abs(180 - rawDeg));
  checks.push({ id: 'headLevel', status: roll > 10 ? 'fail' : roll > 5 ? 'warn' : 'pass' });

  // 5) FACING FORWARD — nose-tip offset from the eye midpoint, normalized by
  // inter-eye distance. A centered nose ≈ looking straight at the camera.
  const eyeMidX = (face.leftEye.x + face.rightEye.x) / 2;
  const eyeDist = Math.max(
    1,
    Math.hypot(face.rightEye.x - face.leftEye.x, face.rightEye.y - face.leftEye.y)
  );
  const yaw = Math.abs(face.noseTip.x - eyeMidX) / eyeDist;
  checks.push({
    id: 'facingForward',
    status: yaw > 0.32 ? 'fail' : yaw > 0.18 ? 'warn' : 'pass',
  });

  const overall: ComplianceStatus = checks.some((c) => c.status === 'fail')
    ? 'fail'
    : checks.some((c) => c.status === 'warn')
      ? 'warn'
      : 'pass';

  return { checks, overall };
}
