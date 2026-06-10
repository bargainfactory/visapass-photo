/**
 * Order status endpoint — used by /success to poll for payment confirmation.
 *
 * GET /api/order-status?session_id=cs_test_…  ->  { status, amountCents, documentId, email }
 *
 * Reads directly from Stripe (the source of truth) instead of an in-memory
 * store. Vercel runs each /api route in its own serverless instance, so an
 * in-memory Map populated by the webhook lambda is invisible to this lambda —
 * we'd be stuck on "pending" forever. Asking Stripe also means polling works
 * even if the webhook is delayed, retried, or temporarily failing.
 *
 * Demo sessions (`cs_demo_…` created when STRIPE_SECRET_KEY is missing) skip
 * the API call and return a synthetic fulfilled response.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getStripeServer } from '@/lib/stripe';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id');
  if (!sessionId) {
    return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
  }

  if (sessionId.startsWith('cs_demo_')) {
    return NextResponse.json({
      status: 'fulfilled',
      amountCents: null,
      documentId: null,
      packageId: null,
    });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({
      status: 'pending',
      amountCents: null,
      documentId: null,
      packageId: null,
    });
  }

  try {
    const stripe = getStripeServer();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    // Translate Stripe's two-axis (payment_status + session status) into our
    // single status enum the UI understands.
    let status: 'pending' | 'paid' | 'fulfilled' | 'shipped' = 'pending';
    if (session.payment_status === 'paid' && session.status === 'complete') {
      // Treat a confirmed Stripe payment as fulfilled — we don't currently
      // model a separate "print queue accepted" state in any durable store.
      status = 'fulfilled';
    } else if (session.status === 'expired') {
      status = 'pending';
    }
    // NOTE: this endpoint is UNAUTHENTICATED and a checkout session_id leaks
    // readily (it lands in the /success URL, browser history, Referer headers).
    // So return ONLY non-PII fields the success UI needs to unlock downloads.
    // The buyer's email is intentionally NOT returned here — Stripe already
    // emails the receipt, and exposing it would let anyone holding a session_id
    // read the customer's address.
    return NextResponse.json({
      status,
      amountCents: session.amount_total ?? null,
      documentId: (session.metadata?.documentId as string | undefined) ?? null,
      // packageId comes from the checkout-session metadata we set in
      // /api/checkout. The success page uses it to gate which download
      // buttons to show — a buyer of "digital" never sees the print sheet,
      // a buyer of "print-sheet" never sees the digital file.
      packageId: (session.metadata?.packageId as string | undefined) ?? null,
    });
  } catch (e: any) {
    // Stripe returns 404 for session IDs from a different account / mode.
    // Surface as pending so the UI keeps polling rather than throwing. Log the
    // detail server-side; never echo the raw error to the caller.
    console.error('[order-status]', e?.message ?? e);
    return NextResponse.json({
      status: 'pending',
      amountCents: null,
      documentId: null,
      packageId: null,
    });
  }
}
