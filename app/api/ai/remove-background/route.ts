/**
 * Server-side background removal — OPTIONAL fallback.
 *
 * The default flow runs entirely client-side via @imgly/background-removal in a
 * Web Worker. This route exists as a drop-in placeholder for higher-accuracy
 * server pipelines:
 *
 *   - Self-hosted rembg + InsightFace
 *   - Replicate (lucataco/remove-bg, stability-ai/sdxl-background-remover, …)
 *   - Hugging Face Inference API (briaai/RMBG-1.4)
 *   - Google Cloud Vision, Azure Computer Vision, or AWS Rekognition
 *
 * Wire one in by replacing the body of the handler. Keep the contract:
 *   POST  multipart/form-data with field "image" (Blob)
 *   ->    image/png (RGBA cutout, transparent background)
 *
 * Example: Replicate
 *   const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
 *   const output = await replicate.run("lucataco/remove-bg:…", {
 *     input: { image: dataUrl },
 *   });
 *
 * Example: Hugging Face
 *   const r = await fetch("https://api-inference.huggingface.co/models/briaai/RMBG-1.4", {
 *     method: "POST",
 *     headers: { Authorization: `Bearer ${process.env.HF_TOKEN}`, "Content-Type": "image/jpeg" },
 *     body: blob,
 *   });
 */
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest) {
  return NextResponse.json(
    {
      error:
        'Server-side background removal is intentionally a stub. Plug in Replicate, Hugging Face, or self-hosted rembg here.',
      docs:
        'See README §“Server-side AI fallback” for a step-by-step on swapping in Replicate/HF/Cloud Vision.',
    },
    { status: 501 }
  );
}
