/**
 * Order history for a signed-in customer — read straight from Stripe. SERVER-ONLY.
 *
 * Stripe is the system of record (no DB), so "your orders" = the completed,
 * paid Checkout Sessions whose customer email matches the verified session
 * email. Guests who never sign in are unaffected: this is a read-only view on
 * purchases they already made.
 */
import type Stripe from 'stripe';
import { getStripeServer, findPackage } from '@/lib/stripe';
import { findDocument } from '@/lib/countries';

export interface CustomerOrder {
  /** Stripe Checkout Session id — also the key of the on-device ciphertext. */
  sessionId: string;
  createdAt: Date;
  amountCents: number;
  currency: string;
  packageId: string | null;
  packageName: string | null;
  documentId: string | null;
  /** e.g. "🇺🇸 United States · Passport" */
  documentLabel: string | null;
  receiptUrl: string | null;
}

export type OrdersResult =
  | { configured: true; orders: CustomerOrder[] }
  | { configured: false; orders: [] };

function receiptFrom(session: Stripe.Checkout.Session): string | null {
  const pi = session.payment_intent;
  if (!pi || typeof pi === 'string') return null;
  const charge = pi.latest_charge;
  if (!charge || typeof charge === 'string') return null;
  return charge.receipt_url ?? null;
}

export async function listOrdersForEmail(email: string): Promise<OrdersResult> {
  if (!process.env.STRIPE_SECRET_KEY) return { configured: false, orders: [] };

  const stripe = getStripeServer();
  const res = await stripe.checkout.sessions.list({
    customer_details: { email },
    status: 'complete',
    limit: 25,
    expand: ['data.payment_intent.latest_charge'],
  });

  const orders: CustomerOrder[] = res.data
    .filter((s) => s.payment_status === 'paid')
    .map((s) => {
      const packageId = (s.metadata?.packageId as string | undefined) ?? null;
      const documentId = (s.metadata?.documentId as string | undefined) ?? null;
      const pkg = packageId ? findPackage(packageId) : undefined;
      const docPair = documentId ? findDocument(documentId) : null;
      return {
        sessionId: s.id,
        createdAt: new Date(s.created * 1000),
        amountCents: s.amount_total ?? 0,
        currency: (s.currency ?? 'usd').toUpperCase(),
        packageId,
        packageName: pkg?.name ?? null,
        documentId,
        documentLabel: docPair ? `${docPair.country.flag} ${docPair.country.name} · ${docPair.doc.label}` : null,
        receiptUrl: receiptFrom(s),
      };
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return { configured: true, orders };
}
