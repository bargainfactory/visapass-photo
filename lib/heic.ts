'use client';

/**
 * iPhone photos default to HEIC/HEIF, which Chrome, Firefox and Edge cannot
 * decode in an <img>/canvas — so an untouched HEIC upload silently fails later
 * in the pipeline ("Could not load the photo"). Since a large share of buyers
 * shoot on iPhones, that was a real conversion leak.
 *
 * This transcodes HEIC/HEIF to JPEG entirely on-device (heic2any wraps libheif
 * wasm) before the rest of the pipeline touches it. The library is loaded lazily
 * so the ~1.5 MB wasm only downloads when someone actually uploads a HEIC.
 */

export function isHeic(file: File): boolean {
  return /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
}

/**
 * Convert a HEIC/HEIF File to a JPEG File. Any other input is returned
 * unchanged. Throws only if the HEIC decode itself fails.
 */
export async function toDecodableImage(file: File): Promise<File> {
  if (!isHeic(file)) return file;
  const heic2any = (await import('heic2any')).default as (opts: {
    blob: Blob;
    toType?: string;
    quality?: number;
  }) => Promise<Blob | Blob[]>;
  const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
  const blob = Array.isArray(out) ? out[0] : out;
  const name = file.name.replace(/\.(heic|heif)$/i, '.jpg') || 'photo.jpg';
  return new File([blob], name, { type: 'image/jpeg' });
}
