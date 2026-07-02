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
import { rateLimit, clientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const rl = rateLimit(`checkout:${clientIp(req)}`, 15, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    );
  }
  try {
    const body = await req.json();
    const pkg = findPackage(body.packageId);
    const docPair = findDocument(body.documentId);
    if (!pkg) return NextResponse.json({ error: 'Unknown package' }, { status: 400 });
    if (!docPair) return NextResponse.json({ error: 'Unknown document' }, { status: 400 });

    // The DEK (base64 AES-GCM key) encrypts the buyer's deliverables client-side.
    // We stash it in the Stripe session metadata and only release it back to the
    // browser once payment clears (see /api/release-key). Validate shape/length
    // so we never write arbitrary client data into Stripe metadata.
    const dek: string | undefined =
      typeof body.dek === 'string' && /^[A-Za-z0-9+/=]{40,64}$/.test(body.dek)
        ? body.dek
        : undefined;

    if (!process.env.STRIPE_SECRET_KEY) {
      // Dev fallback — returns a fake clientSecret that /checkout recognises
      // by the `_secret_demo` suffix and renders a "demo payment" UI instead
      // of trying to mount EmbeddedCheckout with an invalid Stripe key. There's
      // no real session to gate against, so the demo flow echoes the DEK back
      // for the success page to decrypt with.
      const fakeId = `cs_demo_${Date.now()}`;
      return NextResponse.json({
        clientSecret: `${fakeId}_secret_demo`,
        sessionId: fakeId,
        amountCents: pkg.priceCents,
        demoDek: dek ?? null,
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
        // Released to the buyer's browser only after payment clears. Stripe
        // metadata is server-side only — it is NOT exposed via the client
        // secret the embedded checkout receives.
        ...(dek ? { dek } : {}),
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
    // Log the real error server-side; return a generic message so Stripe SDK
    // internals / config hints aren't leaked to the client.
    console.error('[checkout]', e?.message ?? e);
    return NextResponse.json({ error: 'Checkout failed' }, { status: 500 });
  }
}
