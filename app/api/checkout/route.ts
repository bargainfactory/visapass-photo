/**
 * Stripe Checkout session creation — EMBEDDED mode.
 *
 * POST { packageId, documentId } -> { clientSecret, sessionId, amountCents }
 *
 * The `/checkout` page mounts <EmbeddedCheckoutProvider> with this
 * clientSecret. Stripe renders the secure card-entry form inline on our
 * domain and automatically surfaces Apple Pay / Google Pay / Link based on
 * the visitor's device + the merchant's dashboard configuration — no extra
 * payment_method_types config required.
 *
 * Inline `price_data` is used so the demo flow works without pre-configured
 * Stripe products. Swap to env-var `STRIPE_PRICE_*` in production.
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
      // Dev fallback — returns a fake clientSecret that /checkout recognises
      // by the `_secret_demo` suffix and renders a "demo payment" UI instead
      // of trying to mount EmbeddedCheckout with an invalid Stripe key.
      const fakeId = `cs_demo_${Date.now()}`;
      return NextResponse.json({
        clientSecret: `${fakeId}_secret_demo`,
        sessionId: fakeId,
        amountCents: pkg.priceCents,
      });
    }

    const stripe = getStripeServer();
    const origin =
      req.headers.get('origin') ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      `https://${req.headers.get('host')}`;

    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
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
      automatic_tax: { enabled: false },
      metadata: {
        packageId: pkg.id,
        documentId: docPair.doc.id,
        country: docPair.country.code,
      },
      // Embedded sessions use `return_url` — Stripe navigates the host page
      // to this URL once the payment completes. The session_id placeholder
      // is replaced server-side before redirect.
      return_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
    });

    return NextResponse.json({
      clientSecret: session.client_secret,
      sessionId: session.id,
      amountCents: pkg.priceCents,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Checkout failed' }, { status: 500 });
  }
}
