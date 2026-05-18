/**
 * Stripe price catalogue + server helpers.
 *
 * Price IDs are read from env vars so the same code runs across test / live keys.
 * Replace placeholders in .env.local with real Stripe price IDs.
 */
import Stripe from 'stripe';

export const PRINT_PACKAGES = [
  {
    id: 'digital',
    name: 'Digital download',
    description: 'High-resolution JPEG + print-ready 4×6 sheet',
    priceCents: 599,
    envKey: 'STRIPE_PRICE_DIGITAL',
  },
  {
    id: 'prints-4',
    name: '4 physical prints',
    description: '4 ICAO-compliant photos shipped to your door',
    priceCents: 1499,
    envKey: 'STRIPE_PRICE_PRINTS_4',
  },
  {
    id: 'prints-8',
    name: '8 physical prints',
    description: '8 ICAO-compliant photos shipped with priority delivery',
    priceCents: 2499,
    envKey: 'STRIPE_PRICE_PRINTS_8',
  },
] as const;

export type PackageId = (typeof PRINT_PACKAGES)[number]['id'];

export function findPackage(id: string) {
  return PRINT_PACKAGES.find((p) => p.id === id);
}

export function getStripeServer() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  return new Stripe(key, { apiVersion: '2025-02-24.acacia' });
}
