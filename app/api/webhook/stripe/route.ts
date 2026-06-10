/**
 * Stripe webhook handler.
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY        - sk_test_… or sk_live_…
 *   STRIPE_WEBHOOK_SECRET    - whsec_… (from `stripe listen` or the Dashboard)
 *
 * Flow:
 *   1. Verify the Stripe signature using the *raw* request body.
 *   2. Switch on event type. We handle `checkout.session.completed`.
 *   3. Persist the order to the in-memory store (replace with your DB).
 *   4. Trigger fulfillment side-effects (mock email, print queue submit).
 *   5. ALWAYS return 200 quickly — Stripe retries on non-2xx.
 *
 * Next.js note: the App Router's Request.text() returns the unparsed body, which
 * is exactly what stripe.webhooks.constructEvent needs. We disable body parsing
 * implicitly by reading the raw text.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getStripeServer } from '@/lib/stripe';
import { orderStore } from '../../order-store';

export const runtime = 'nodejs';
// Stripe requires the raw body — keep dynamic rendering / no caching.
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'STRIPE_WEBHOOK_SECRET not configured' }, { status: 500 });
  }

  let event;
  try {
    const stripe = getStripeServer();
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err: any) {
    // Log the detail server-side; return a generic 400 so we don't echo SDK
    // internals back to an unauthenticated caller.
    console.error('[stripe webhook] signature verification failed:', err?.message ?? err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const packageId = session.metadata?.packageId ?? 'unknown';
        const documentId = session.metadata?.documentId ?? 'unknown';
        const email = session.customer_details?.email ?? null;
        const amountCents = session.amount_total ?? 0;

        // Persist (in-memory; swap for your DB in production).
        orderStore.upsert({
          id: session.id,
          packageId,
          documentId,
          email,
          amountCents,
          status: 'paid',
          createdAt: Date.now(),
        });

        // Fire-and-forget fulfillment side effects.
        await Promise.allSettled([
          mockSendReceiptEmail(email, amountCents),
          mockSubmitToPrintQueue({
            sessionId: session.id,
            packageId,
            documentId,
            shipping: session.shipping_details,
          }),
        ]);

        // Mark fulfilled once the print queue accepted the job.
        orderStore.update(session.id, { status: 'fulfilled' });
        break;
      }

      case 'checkout.session.expired':
      case 'checkout.session.async_payment_failed': {
        const session = event.data.object as any;
        orderStore.update(session.id, { status: 'pending' });
        break;
      }

      default:
        // Acknowledge unhandled events so Stripe doesn't retry.
        break;
    }
  } catch (err: any) {
    // Log on the server. Don't 500 — Stripe will retry events that 5xx, but we
    // already enqueued the fulfillment job, so just record and acknowledge.
    console.error('[stripe webhook]', err);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

/**
 * Stub: integrate with your transactional email provider here
 * (Resend, Postmark, SendGrid, AWS SES). Keep it idempotent — webhooks can
 * be delivered more than once.
 */
async function mockSendReceiptEmail(email: string | null, amountCents: number) {
  if (!email) return;
  console.log(`[mock email] Receipt to ${email} — $${(amountCents / 100).toFixed(2)}`);
}

/**
 * Stub: hand the order off to your print fulfillment partner
 * (e.g. Printify, Lob, Gooten, Prodigi, or a local lab webhook).
 */
async function mockSubmitToPrintQueue(params: {
  sessionId: string;
  packageId: string;
  documentId: string;
  shipping: unknown;
}) {
  console.log('[mock print queue] enqueued', params);
}
