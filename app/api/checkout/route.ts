/**
 * Stripe Checkout session creation.
 *
 * POST { packageId, documentId } -> { url, sessionId, amountCents }
 *
 * The price for each package is created on-the-fly via `price_data` so the demo
 * runs without pre-configured Stripe products. In production, swap to env-var
 * `STRIPE_PRICE_*` and pass `line_items: [{ price: ..., quantity: 1 }]`.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getStripeServer, findPackage } from '@/lib/stripe';
import { findDocument } from '@/lib/countries';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const pkg = findPackage(body.packageId);
    const docPair = findDocument(body.documentId);
    if (!pkg) return NextResponse.json({ error: 'Unknown package' }, { status: 400 });
    if (!docPair) return NextResponse.json({ error: 'Unknown document' }, { status: 400 });

    if (!process.env.STRIPE_SECRET_KEY) {
      // Friendly dev-mode fallback so the UI still works locally without secrets.
      return NextResponse.json({
        url: `/success?session_id=cs_demo_${Date.now()}`,
        sessionId: `cs_demo_${Date.now()}`,
        amountCents: pkg.priceCents,
      });
    }

    const stripe = getStripeServer();
    const origin =
      req.headers.get('origin') ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      `https://${req.headers.get('host')}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: pkg.priceCents,
            product_data: {
              name: `VisaPass Photo · ${pkg.name}`,
              description: `${docPair.country.flag} ${docPair.doc.label} — ${pkg.description}`,
            },
          },
        },
      ],
      shipping_address_collection: pkg.id !== 'digital' ? { allowed_countries: ['US', 'CA', 'GB', 'AU'] } : undefined,
      automatic_tax: { enabled: false },
      metadata: {
        packageId: pkg.id,
        documentId: docPair.doc.id,
        country: docPair.country.code,
      },
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/editor`,
    });

    return NextResponse.json({
      url: session.url!,
      sessionId: session.id,
      amountCents: pkg.priceCents,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Checkout failed' }, { status: 500 });
  }
}
