/**
 * Operator-only full refund. POST { sessionId, reason? } -> { ok, refundId, alreadyRefunded }
 *
 * Money-moving, so: operator allow-list enforced server-side, rate limited,
 * idempotent per session (Stripe idempotency key), and never partial — the
 * refund policy is all-or-nothing for a digital good.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getStripeServer } from '@/lib/stripe';
import { getOperatorEmail } from '@/lib/operator';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const operator = await getOperatorEmail();
  if (!operator) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const rl = rateLimit(`operator-refund:${clientIp(req)}`, 20, 10 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: 'too_many' }, { status: 429 });

  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

  let body: { sessionId?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const sessionId = typeof body.sessionId === 'string' && /^cs_(test|live)_[A-Za-z0-9]+$/.test(body.sessionId) ? body.sessionId : null;
  if (!sessionId) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const note = typeof body.reason === 'string' ? body.reason.trim().slice(0, 200) : '';

  try {
    const stripe = getStripeServer();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent.latest_charge'],
    });
    const pi = session.payment_intent && typeof session.payment_intent !== 'string' ? session.payment_intent : null;
    if (!pi || session.payment_status !== 'paid') {
      return NextResponse.json({ error: 'not_paid' }, { status: 409 });
    }
    const charge = pi.latest_charge && typeof pi.latest_charge !== 'string' ? pi.latest_charge : null;
    if (charge?.refunded) return NextResponse.json({ ok: true, alreadyRefunded: true });

    const refund = await stripe.refunds.create(
      {
        payment_intent: pi.id,
        reason: 'requested_by_customer',
        metadata: { operator, note, sessionId },
      },
      { idempotencyKey: `refund_${sessionId}` }
    );
    console.log(`[operator] ${operator} refunded ${sessionId} (${refund.id})${note ? ` — ${note}` : ''}`);
    return NextResponse.json({ ok: true, refundId: refund.id, alreadyRefunded: false });
  } catch (e: any) {
    console.error('[operator refund]', e?.message ?? e);
    return NextResponse.json({ error: 'refund_failed' }, { status: 502 });
  }
}
