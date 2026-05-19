/**
 * Stripe price catalogue + server helpers.
 *
 * The checkout panel offers three one-time, all-digital deliverables:
 *
 *   · digital      — single compliant JPEG, ready for online submission
 *   · print-sheet  — 4×6" multi-up sheet, ready for home or kiosk printing
 *   · bundle       — both, at a discount (best value)
 *
 * Price IDs are read from env vars so the same code runs across test / live
 * keys. The /api/checkout route falls back to inline `price_data` when no
 * STRIPE_PRICE_* is set, so the demo flow works without pre-configured
 * products.
 */
import Stripe from 'stripe';

export const PRINT_PACKAGES = [
  {
    id: 'digital',
    name: 'Digital Download',
    description: 'High-resolution JPEG · online submission ready',
    priceCents: 599,
    envKey: 'STRIPE_PRICE_DIGITAL',
  },
  {
    id: 'print-sheet',
    name: '4×6" Print Sheet',
    description: 'Multi-up print sheet · home or lab printing',
    priceCents: 599,
    envKey: 'STRIPE_PRICE_PRINT_SHEET',
  },
  {
    id: 'bundle',
    name: 'Bundled Deal',
    description: 'Digital download + 4×6" print sheet · best value',
    priceCents: 999,
    envKey: 'STRIPE_PRICE_BUNDLE',
  },
] as const;

export type PackageId = (typeof PRINT_PACKAGES)[number]['id'];

/** Sum of digital + print-sheet, used to advertise the bundle discount. */
export function bundleSavingsCents() {
  const dig = PRINT_PACKAGES.find((p) => p.id === 'digital')!.priceCents;
  const sheet = PRINT_PACKAGES.find((p) => p.id === 'print-sheet')!.priceCents;
  const bundle = PRINT_PACKAGES.find((p) => p.id === 'bundle')!.priceCents;
  return dig + sheet - bundle;
}

export function findPackage(id: string) {
  return PRINT_PACKAGES.find((p) => p.id === id);
}

export function getStripeServer() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  return new Stripe(key, { apiVersion: '2025-02-24.acacia' });
}
