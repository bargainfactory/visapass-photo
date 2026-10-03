/**
 * One-click auto-enhance for the compliant photo — face-metered, deliberately
 * conservative. Runs on the SUBJECT layer (transparent background) at output
 * resolution, so the spec background colour is never touched and the per-pixel
 * cost is bounded (~0.4 MP).
 *
 * Passes, in order:
 *   1. White balance — skin-anchored. The face metering rect (eye line → chin,
 *      central 60% of the face box) is skin-dominated, so its mean chromaticity
 *      is compared against a canonical skin chromaticity. Only HALF of the
 *      measured deviation is corrected and gains are clamped, so unusual
 *      complexions and make-up are nudged, not "fixed". Luminance is held.
 *   2. Exposure balance — gamma, not gain, so white and black points are
 *      preserved and nothing clips. We correct only when the face is clearly
 *      under- or over-exposed (outside a 0.40–0.72 luminance window) and move
 *      it to the EDGE of the window, never to a fixed target. This evens out
 *      lighting without normalising skin tone across subjects.
 *   3. Left/right balance — side-lit faces are the most common ICAO rejection
 *      ("uneven lighting"). If the two halves of the face differ by more than
 *      8%, a horizontal gain ramp across the face box equalises half the
 *      difference, feathered beyond the box so shoulders stay consistent.
 *   4. Sharpening — unsharp mask on luminance only (no colour fringing),
 *      radius ~1 px at output size, amount 0.55, threshold 3 levels so skin
 *      noise is not amplified. Applied only to interior subject pixels so the
 *      cut-out edge against the flat background gets no halo. Done LAST,
 *      after the downscale — sharpening before a resize is wasted.
 *
 * All thresholds are intentionally mild: government upload checkers and human
 * reviewers reject visibly processed photos faster than slightly dull ones.
 */

export interface FaceMetering {
  /** Face bounding box in SOURCE pixel coordinates. */
  box: { x: number; y: number; w: number; h: number };
  /** Mean eye centre in source pixel coordinates. */
  eyeLine: { x: number; y: number };
  /** Chin tip in source pixel coordinates. */
  chin: { x: number; y: number };
}

export interface MeteringRects {
  /** Skin-dominated metering rect in OUTPUT pixel coordinates. */
  skin: Rect;
  /** Whole face box in OUTPUT pixel coordinates (for the left/right ramp). */
  face: Rect;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Luma weights (Rec. 709) applied directly to sRGB — adequate for metering. */
const LR = 0.2126;
const LG = 0.7152;
const LB = 0.0722;

/** Canonical skin chromaticity (r, g, b sum to 1), stable across skin tones. */
const SKIN_CHROMA = { r: 0.44, g: 0.32, b: 0.24 };

const WB_DAMP = 0.5;
const WB_GAIN_MIN = 0.9;
const WB_GAIN_MAX = 1.12;

const EXPOSURE_LOW = 0.4;
const EXPOSURE_HIGH = 0.72;
const EXPOSURE_DAMP = 0.7;
const GAMMA_MIN = 0.75;
const GAMMA_MAX = 1.35;

const SIDE_IMBALANCE_MIN = 0.08;
const SIDE_DAMP = 0.5;
const SIDE_GAIN_MAX = 1.2;

const USM_AMOUNT = 0.55;
const USM_THRESHOLD = 3;

/**
 * Map the face geometry from source pixels into output-canvas pixels given
 * the crop rect and output size. Falls back to a spec-shaped central region
 * when no face data is available (ICAO framing puts the face there anyway).
 */
export function meteringRects(
  face: FaceMetering | null | undefined,
  crop: { x: number; y: number; width: number; height: number },
  outW: number,
  outH: number
): MeteringRects {
  const sx = outW / crop.width;
  const sy = outH / crop.height;
  const clampRect = (r: Rect): Rect => {
    const x = Math.max(0, Math.min(outW - 1, r.x));
    const y = Math.max(0, Math.min(outH - 1, r.y));
    const w = Math.max(2, Math.min(outW - x, r.w));
    const h = Math.max(2, Math.min(outH - y, r.h));
    return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
  };

  if (!face) {
    const fw = outW * 0.5;
    const fh = outH * 0.45;
    const faceRect = clampRect({ x: (outW - fw) / 2, y: outH * 0.22, w: fw, h: fh });
    const skin = clampRect({ x: outW * 0.32, y: outH * 0.4, w: outW * 0.36, h: outH * 0.24 });
    return { skin, face: faceRect };
  }

  const bx = (face.box.x - crop.x) * sx;
  const by = (face.box.y - crop.y) * sy;
  const bw = face.box.w * sx;
  const bh = face.box.h * sy;
  const eyeY = (face.eyeLine.y - crop.y) * sy;
  const chinY = (face.chin.y - crop.y) * sy;

  const faceRect = clampRect({ x: bx, y: by, w: bw, h: bh });
  // Cheeks / nose / mouth: below the eye line (skip brows + hair), above the
  // chin edge, central 60% horizontally (skip ears + hair line).
  const top = eyeY + (chinY - eyeY) * 0.1;
  const bottom = chinY - (chinY - eyeY) * 0.08;
  const skin = clampRect({ x: bx + bw * 0.2, y: top, w: bw * 0.6, h: Math.max(4, bottom - top) });
  return { skin, face: faceRect };
}

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/**
 * Apply auto-enhance in place to a canvas holding the subject on a
 * transparent background. Pixels with alpha < 8 are left untouched.
 */
export function applyAutoEnhance(canvas: HTMLCanvasElement, rects: MeteringRects): void {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;

  /* ---- 1. Skin-anchored white balance ---------------------------------- */
  const m = meanRgb(d, W, rects.skin);
  if (m) {
    const sum = m.r + m.g + m.b;
    if (sum > 0) {
      const cr = m.r / sum;
      const cg = m.g / sum;
      const cb = m.b / sum;
      let gr = Math.pow(SKIN_CHROMA.r / Math.max(cr, 1e-3), WB_DAMP);
      let gg = Math.pow(SKIN_CHROMA.g / Math.max(cg, 1e-3), WB_DAMP);
      let gb = Math.pow(SKIN_CHROMA.b / Math.max(cb, 1e-3), WB_DAMP);
      gr = Math.min(WB_GAIN_MAX, Math.max(WB_GAIN_MIN, gr));
      gg = Math.min(WB_GAIN_MAX, Math.max(WB_GAIN_MIN, gg));
      gb = Math.min(WB_GAIN_MAX, Math.max(WB_GAIN_MIN, gb));
      // Hold face luminance constant so WB never doubles as an exposure change.
      const lBefore = LR * m.r + LG * m.g + LB * m.b;
      const lAfter = LR * m.r * gr + LG * m.g * gg + LB * m.b * gb;
      const norm = lAfter > 0 ? lBefore / lAfter : 1;
      gr *= norm;
      gg *= norm;
      gb *= norm;
      if (Math.abs(gr - 1) > 0.005 || Math.abs(gg - 1) > 0.005 || Math.abs(gb - 1) > 0.005) {
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] < 8) continue;
          d[i] = clamp255(d[i] * gr);
          d[i + 1] = clamp255(d[i + 1] * gg);
          d[i + 2] = clamp255(d[i + 2] * gb);
        }
      }
    }
  }

  /* ---- 2. Exposure balance (gamma, windowed) ---------------------------- */
  const m2 = meanRgb(d, W, rects.skin);
  if (m2) {
    const lum = (LR * m2.r + LG * m2.g + LB * m2.b) / 255;
    let target: number | null = null;
    if (lum < EXPOSURE_LOW) target = EXPOSURE_LOW;
    else if (lum > EXPOSURE_HIGH) target = EXPOSURE_HIGH;
    if (target !== null && lum > 0.02 && lum < 0.98) {
      let gamma = Math.log(target) / Math.log(lum);
      gamma = 1 + (gamma - 1) * EXPOSURE_DAMP;
      gamma = Math.min(GAMMA_MAX, Math.max(GAMMA_MIN, gamma));
      const lut = new Uint8ClampedArray(256);
      for (let v = 0; v < 256; v++) lut[v] = Math.round(255 * Math.pow(v / 255, gamma));
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 8) continue;
        d[i] = lut[d[i]];
        d[i + 1] = lut[d[i + 1]];
        d[i + 2] = lut[d[i + 2]];
      }
    }
  }

  /* ---- 3. Left / right balance ------------------------------------------ */
  {
    const f = rects.face;
    const halfW = Math.floor(f.w / 2);
    if (halfW >= 4) {
      const left = meanRgb(d, W, { x: f.x, y: f.y, w: halfW, h: f.h });
      const right = meanRgb(d, W, { x: f.x + halfW, y: f.y, w: f.w - halfW, h: f.h });
      if (left && right) {
        const lL = LR * left.r + LG * left.g + LB * left.b;
        const lR = LR * right.r + LG * right.g + LB * right.b;
        if (lL > 1 && lR > 1) {
          const ratio = lL / lR; // >1 → left brighter
          if (Math.abs(ratio - 1) > SIDE_IMBALANCE_MIN) {
            // Bring each side halfway toward their geometric mean.
            const mean = Math.sqrt(lL * lR);
            let gL = Math.pow(mean / lL, SIDE_DAMP);
            let gR = Math.pow(mean / lR, SIDE_DAMP);
            gL = Math.min(SIDE_GAIN_MAX, Math.max(1 / SIDE_GAIN_MAX, gL));
            gR = Math.min(SIDE_GAIN_MAX, Math.max(1 / SIDE_GAIN_MAX, gR));
            // Gain ramps linearly across the face box, then holds flat with a
            // soft feather of half a face-width on either side.
            const x0 = f.x;
            const x1 = f.x + f.w;
            const feather = Math.max(1, f.w * 0.5);
            const gainAt = new Float32Array(W);
            for (let x = 0; x < W; x++) {
              let g: number;
              if (x <= x0) {
                const t = Math.min(1, (x0 - x) / feather);
                g = gL + (1 - gL) * t * t;
              } else if (x >= x1) {
                const t = Math.min(1, (x - x1) / feather);
                g = gR + (1 - gR) * t * t;
              } else {
                const t = (x - x0) / (x1 - x0);
                g = gL + (gR - gL) * t;
              }
              gainAt[x] = g;
            }
            for (let y = 0; y < H; y++) {
              const row = y * W * 4;
              for (let x = 0; x < W; x++) {
                const i = row + x * 4;
                if (d[i + 3] < 8) continue;
                const g = gainAt[x];
                if (g === 1) continue;
                d[i] = clamp255(d[i] * g);
                d[i + 1] = clamp255(d[i + 1] * g);
                d[i + 2] = clamp255(d[i + 2] * g);
              }
            }
          }
        }
      }
    }
  }

  /* ---- 4. Luminance unsharp mask (interior subject pixels only) ---------- */
  {
    const n = W * H;
    const Y = new Float32Array(n);
    for (let p = 0, i = 0; p < n; p++, i += 4) Y[p] = LR * d[i] + LG * d[i + 1] + LB * d[i + 2];
    // Separable 5-tap Gaussian, sigma ≈ 1 px (radius scales mildly with size).
    const sigma = Math.max(0.8, Math.min(1.4, W / 600));
    const k = gaussianKernel5(sigma);
    const tmp = new Float32Array(n);
    const blur = new Float32Array(n);
    for (let y = 0; y < H; y++) {
      const row = y * W;
      for (let x = 0; x < W; x++) {
        let acc = 0;
        for (let t = -2; t <= 2; t++) {
          const xx = Math.min(W - 1, Math.max(0, x + t));
          acc += Y[row + xx] * k[t + 2];
        }
        tmp[row + x] = acc;
      }
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let acc = 0;
        for (let t = -2; t <= 2; t++) {
          const yy = Math.min(H - 1, Math.max(0, y + t));
          acc += tmp[yy * W + x] * k[t + 2];
        }
        blur[y * W + x] = acc;
      }
    }
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const p = y * W + x;
        const i = p * 4;
        // Interior test: this pixel and its 4 neighbours are fully opaque, so
        // the mask edge against the background is never sharpened (no halo).
        if (
          d[i + 3] !== 255 ||
          d[i - 1] !== 255 ||
          d[i + 7] !== 255 ||
          d[i - W * 4 + 3] !== 255 ||
          d[i + W * 4 + 3] !== 255
        ) {
          continue;
        }
        const delta = Y[p] - blur[p];
        if (Math.abs(delta) < USM_THRESHOLD) continue;
        const add = delta * USM_AMOUNT;
        d[i] = clamp255(d[i] + add);
        d[i + 1] = clamp255(d[i + 1] + add);
        d[i + 2] = clamp255(d[i + 2] + add);
      }
    }
  }

  ctx.putImageData(img, 0, 0);
}

function gaussianKernel5(sigma: number): number[] {
  const k = [-2, -1, 0, 1, 2].map((t) => Math.exp(-(t * t) / (2 * sigma * sigma)));
  const s = k.reduce((a, b) => a + b, 0);
  return k.map((v) => v / s);
}

/** Mean RGB over opaque pixels in a rect, or null when too few samples. */
function meanRgb(d: Uint8ClampedArray, W: number, r: Rect): { r: number; g: number; b: number } | null {
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let n = 0;
  const x1 = r.x + r.w;
  const y1 = r.y + r.h;
  for (let y = r.y; y < y1; y++) {
    const row = y * W * 4;
    for (let x = r.x; x < x1; x++) {
      const i = row + x * 4;
      if (d[i + 3] < 200) continue;
      sr += d[i];
      sg += d[i + 1];
      sb += d[i + 2];
      n++;
    }
  }
  if (n < 64) return null;
  return { r: sr / n, g: sg / n, b: sb / n };
}
