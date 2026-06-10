/**
 * Payment-gated key release.
 *
 * GET /api/release-key?session_id=cs_…  ->  { dek }  (200)  when paid
 *                                           { error } (402) when not yet paid
 *
 * This is the enforcement boundary of the paywall. The buyer's browser holds
 * the encrypted deliverables (in IndexedDB) but cannot decrypt them without the
 * DEK, which was written into the Stripe Checkout Session metadata at checkout
 * time. We hand the DEK back ONLY when Stripe confirms the session is actually
 * paid + complete — so reading IndexedDB or replaying the request before paying
 * yields ciphertext the client can't open.
 *
 * Stripe is the source of truth (works across serverless instances and even if
 * the webhook is delayed). The session_id alone is not a capability: without a
 * cleared payment on that exact session, no key is returned.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getStripeServer } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id');
  if (!sessionId) {
    return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
  }

  // Demo sessions never created a real Stripe session, so there's nothing to
  // gate against here — the demo flow decrypts with the DEK echoed back by
  // /api/checkout (see the success page). Refuse to mint a key for them.
  if (sessionId.startsWith('cs_demo_')) {
    return NextResponse.json({ error: 'demo session' }, { status: 400 });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'not configured' }, { status: 503 });
  }

  try {
    const stripe = getStripeServer();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paid = session.payment_status === 'paid' && session.status === 'complete';
    if (!paid) {
      return NextResponse.json({ error: 'payment not complete' }, { status: 402 });
    }
    const dek = (session.metadata?.dek as string | undefined) ?? null;
    if (!dek) {
      return NextResponse.json({ error: 'no key on session' }, { status: 404 });
    }
    return NextResponse.json({ dek });
  } catch (e: any) {
    console.error('[release-key]', e?.message ?? e);
    return NextResponse.json({ error: 'lookup failed' }, { status: 502 });
  }
}
