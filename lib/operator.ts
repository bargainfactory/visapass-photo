/**
 * Operator (back-office) access + data. SERVER-ONLY.
 *
 * WHO. An operator is any signed-in customer whose email is on the
 * OPERATOR_EMAILS allow-list (comma-separated env var). There is no separate
 * login: the operator signs in exactly like a customer (magic link), and the
 * role is derived from the allow-list at request time — so removing an address
 * from the env var revokes access on the next request, with no token to expire.
 *
 * WHAT. Everything here reads Stripe directly (the system of record; no DB):
 * recent paid Checkout Sessions, revenue roll-ups in USD (Adaptive Pricing
 * sessions report via currency_conversion), per-package / per-country counts,
 * refund state, and a go-live configuration health check.
 */
import type Stripe from 'stripe';
import { getStripeServer, findPackage } from '@/lib/stripe';
import { findDocument } from '@/lib/countries';
import { getSessionEmail, authConfigured } from '@/lib/auth';
import { emailConfigured } from '@/lib/email';

/* ------------------------------- Access ---------------------------------- */

export function operatorEmails(): string[] {
  return (process.env.OPERATOR_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isOperator(email: string | null | undefined): boolean {
  if (!email) return false;
  return operatorEmails().includes(email.toLowerCase());
}

/** Signed-in operator email for this request, or null (not signed in / not an operator). */
export async function getOperatorEmail(): Promise<string | null> {
  const email = await getSessionEmail();
  return isOperator(email) ? email : null;
}

/* ------------------------------- Orders ---------------------------------- */

export interface OperatorOrder {
  sessionId: string;
  createdAt: Date;
  email: string | null;
  /** USD cents, price of record. */
  amountCents: number;
  /** Local charge when Adaptive Pricing converted, else null. */
  chargedAmountCents: number | null;
  chargedCurrency: string | null;
  packageId: string | null;
  packageName: string | null;
  documentId: string | null;
  documentLabel: string | null;
  countryCode: string | null;
  paymentIntentId: string | null;
  refunded: boolean;
  amountRefundedCents: number;
  receiptUrl: string | null;
  livemode: boolean;
}

export interface OperatorStats {
  configured: boolean;
  livemode: boolean | null;
  windowDays: number;
  orders: OperatorOrder[];
  revenue: { today: number; last7d: number; last30d: number };
  counts: { today: number; last7d: number; last30d: number; refunded: number };
  byPackage: Array<{ id: string; name: string; count: number; revenueCents: number }>;
  byCountry: Array<{ code: string; label: string; count: number }>;
}

function toOrder(s: Stripe.Checkout.Session): OperatorOrder {
  const pi = s.payment_intent && typeof s.payment_intent !== 'string' ? s.payment_intent : null;
  const charge = pi?.latest_charge && typeof pi.latest_charge !== 'string' ? pi.latest_charge : null;
  const conv = s.currency_conversion;
  const packageId = (s.metadata?.packageId as string | undefined) ?? null;
  const documentId = (s.metadata?.documentId as string | undefined) ?? null;
  const pkg = packageId ? findPackage(packageId) : undefined;
  const docPair = documentId ? findDocument(documentId) : null;
  const usdCents = conv?.amount_total ?? s.amount_total ?? 0;
  return {
    sessionId: s.id,
    createdAt: new Date(s.created * 1000),
    email: s.customer_details?.email ?? null,
    amountCents: usdCents,
    chargedAmountCents: conv ? (s.amount_total ?? null) : null,
    chargedCurrency: conv ? (s.currency ?? 'usd').toUpperCase() : null,
    packageId,
    packageName: pkg?.name ?? null,
    documentId,
    documentLabel: docPair ? `${docPair.country.flag} ${docPair.country.name} · ${docPair.doc.label}` : null,
    countryCode: docPair?.country.code ?? ((s.metadata?.country as string | undefined) ?? null),
    paymentIntentId: pi?.id ?? (typeof s.payment_intent === 'string' ? s.payment_intent : null),
    refunded: Boolean(charge?.refunded) || (charge?.amount_refunded ?? 0) > 0,
    amountRefundedCents: charge?.amount_refunded ?? 0,
    receiptUrl: charge?.receipt_url ?? null,
    livemode: s.livemode,
  };
}

/**
 * Paid sessions in the last `windowDays` (max 300 rows), newest first, with
 * roll-ups. `query` filters by customer email substring or session id.
 */
export async function operatorStats(opts: { windowDays?: number; query?: string } = {}): Promise<OperatorStats> {
  const windowDays = opts.windowDays ?? 30;
  const empty: OperatorStats = {
    configured: false,
    livemode: null,
    windowDays,
    orders: [],
    revenue: { today: 0, last7d: 0, last30d: 0 },
    counts: { today: 0, last7d: 0, last30d: 0, refunded: 0 },
    byPackage: [],
    byCountry: [],
  };
  if (!process.env.STRIPE_SECRET_KEY) return empty;

  const stripe = getStripeServer();
  const since = Math.floor(Date.now() / 1000) - windowDays * 86_400;
  const sessions = await stripe.checkout.sessions
    .list({
      status: 'complete',
      created: { gte: since },
      limit: 100,
      expand: ['data.payment_intent.latest_charge'],
    })
    .autoPagingToArray({ limit: 300 });

  const all = sessions.filter((s) => s.payment_status === 'paid').map(toOrder);
  all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const inWindow = (o: OperatorOrder, ms: number) => now - o.createdAt.getTime() <= ms;
  const net = (o: OperatorOrder) => Math.max(0, o.amountCents - (o.refunded ? o.amountCents : 0));

  const revenue = { today: 0, last7d: 0, last30d: 0 };
  const counts = { today: 0, last7d: 0, last30d: 0, refunded: 0 };
  const pkgMap = new Map<string, { id: string; name: string; count: number; revenueCents: number }>();
  const countryMap = new Map<string, { code: string; label: string; count: number }>();

  for (const o of all) {
    const n = net(o);
    if (o.createdAt.getTime() >= startOfToday.getTime()) {
      revenue.today += n;
      counts.today++;
    }
    if (inWindow(o, 7 * 86_400_000)) {
      revenue.last7d += n;
      counts.last7d++;
    }
    revenue.last30d += n;
    counts.last30d++;
    if (o.refunded) counts.refunded++;

    const pid = o.packageId ?? 'unknown';
    const p = pkgMap.get(pid) ?? { id: pid, name: o.packageName ?? pid, count: 0, revenueCents: 0 };
    p.count++;
    p.revenueCents += n;
    pkgMap.set(pid, p);

    const cc = o.countryCode ?? '??';
    const c = countryMap.get(cc) ?? { code: cc, label: o.documentLabel?.split(' · ')[0] ?? cc, count: 0 };
    c.count++;
    countryMap.set(cc, c);
  }

  const q = opts.query?.trim().toLowerCase();
  const orders = q
    ? all.filter((o) => o.email?.toLowerCase().includes(q) || o.sessionId.toLowerCase().includes(q))
    : all;

  return {
    configured: true,
    livemode: all[0]?.livemode ?? (process.env.STRIPE_SECRET_KEY.startsWith('sk_live_') ? true : false),
    windowDays,
    orders,
    revenue,
    counts,
    byPackage: [...pkgMap.values()].sort((a, b) => b.revenueCents - a.revenueCents),
    byCountry: [...countryMap.values()].sort((a, b) => b.count - a.count).slice(0, 10),
  };
}

/* ------------------------------ Go-live health ---------------------------- */

export interface HealthItem {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
}

export function configHealth(): HealthItem[] {
  const sk = process.env.STRIPE_SECRET_KEY ?? '';
  const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
  const live = sk.startsWith('sk_live_');
  const pkLive = pk.startsWith('pk_live_');
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  return [
    {
      key: 'stripe',
      label: 'Stripe keys',
      ok: Boolean(sk && pk),
      detail: !sk ? 'STRIPE_SECRET_KEY missing — checkout runs in demo mode' : live ? 'LIVE mode' : 'TEST mode (sk_test)',
    },
    {
      key: 'stripe-match',
      label: 'Secret / publishable key modes match',
      ok: !sk || !pk || live === pkLive,
      detail: live === pkLive ? 'Both keys are the same mode' : 'One key is live and the other test',
    },
    {
      key: 'webhook',
      label: 'Stripe webhook secret',
      ok: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
      detail: process.env.STRIPE_WEBHOOK_SECRET ? 'Set' : 'STRIPE_WEBHOOK_SECRET missing — webhook events are rejected',
    },
    {
      key: 'auth',
      label: 'AUTH_SECRET',
      ok: authConfigured() && Boolean(process.env.AUTH_SECRET),
      detail: process.env.AUTH_SECRET ? 'Set' : process.env.NODE_ENV === 'production' ? 'Missing — sign-in fails closed' : 'Missing — using dev fallback key',
    },
    {
      key: 'email',
      label: 'Sign-in email (Resend)',
      ok: emailConfigured(),
      detail: emailConfigured() ? `Sending as ${process.env.EMAIL_FROM}` : 'RESEND_API_KEY / EMAIL_FROM missing — links shown on screen in dev, unavailable in prod',
    },
    {
      key: 'site-url',
      label: 'NEXT_PUBLIC_SITE_URL',
      ok: site.startsWith('https://www.visapassphoto.com'),
      detail: site || 'Missing — production sign-in links fall back to the request host',
    },
    {
      key: 'operators',
      label: 'Operator allow-list',
      ok: operatorEmails().length > 0,
      detail: operatorEmails().length ? `${operatorEmails().length} operator(s)` : 'OPERATOR_EMAILS missing',
    },
  ];
}
