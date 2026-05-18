/**
 * Order status endpoint — used by /success to poll the webhook-updated order state.
 *
 * GET /api/order-status?session_id=cs_test_…  ->  { status, amountCents, documentId, email }
 *
 * Returns the in-memory ServerOrder if present, otherwise falls back to a
 * "pending" response so the polling UI shows a sensible placeholder.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { orderStore } from '../order-store';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id');
  if (!sessionId) {
    return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
  }

  const order = orderStore.get(sessionId);
  if (!order) {
    return NextResponse.json({
      status: sessionId.startsWith('cs_demo_') ? 'fulfilled' : 'pending',
      amountCents: null,
      documentId: null,
      email: null,
    });
  }

  return NextResponse.json({
    status: order.status,
    amountCents: order.amountCents,
    documentId: order.documentId,
    email: order.email,
  });
}
