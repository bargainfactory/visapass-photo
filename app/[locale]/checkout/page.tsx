'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { ArrowLeft, CreditCard, Loader2, ShieldCheck } from 'lucide-react';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { Link, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Stripe.js singleton — loadStripe must be called outside of render so the
 * SDK isn't reinstantiated on every state change. NEXT_PUBLIC_STRIPE_*
 * is read at module-eval time; missing keys are handled in the page below.
 */
const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
const stripePromise: Promise<Stripe | null> | null = stripeKey
  ? loadStripe(stripeKey)
  : null;

export default function CheckoutPage() {
  const t = useTranslations('checkout');
  const router = useRouter();
  const [clientSecret, setClientSecret] = React.useState<string | null>(null);
  const [sessionId, setSessionId] = React.useState<string | null>(null);

  React.useEffect(() => {
    try {
      const secret = sessionStorage.getItem('vp-checkout-secret');
      const sess = sessionStorage.getItem('vp-pending-session');
      if (secret) setClientSecret(secret);
      if (sess) setSessionId(sess);
    } catch {
      /* ignore */
    }
  }, []);

  // No active session — visitor probably hit /checkout directly.
  if (!clientSecret) {
    return (
      <div className="container max-w-2xl py-20">
        <Card>
          <CardContent className="space-y-4 p-8 text-center">
            <p className="text-muted-foreground">{t('noSession')}</p>
            <Button asChild variant="brand">
              <Link href="/editor">
                <ArrowLeft className="size-4 rtl:rotate-180" /> {t('returnToEditor')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Dev fallback — /api/checkout returned a fake clientSecret because
  // STRIPE_SECRET_KEY isn't set. Show a single "Simulate payment" button
  // that walks the user through to /success so the rest of the flow can
  // be exercised end-to-end locally.
  const isDemo = clientSecret.endsWith('_demo');
  if (isDemo) {
    return (
      <div className="container max-w-2xl py-12">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="space-y-5 p-8 text-center">
              <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-amber-500/15 text-amber-600">
                <CreditCard className="size-6" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-semibold">{t('demoTitle')}</h1>
                <p className="mt-2 text-muted-foreground">{t('demoBody')}</p>
              </div>
              <Button
                size="lg"
                variant="brand"
                className="w-full"
                onClick={() => router.push(`/success?session_id=${sessionId ?? ''}`)}
              >
                <ShieldCheck className="size-4" /> {t('demoSimulate')}
              </Button>
              <p className="text-xs text-muted-foreground">{t('demoFootnote')}</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // No publishable key — Stripe.js can't initialise.
  if (!stripePromise) {
    return (
      <div className="container max-w-2xl py-20">
        <Card>
          <CardContent className="space-y-3 p-8 text-center">
            <p className="text-destructive">{t('missingKey')}</p>
            <Button asChild variant="outline">
              <Link href="/editor">{t('returnToEditor')}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-8 md:py-12">
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/editor">
            <ArrowLeft className="size-4 rtl:rotate-180" /> {t('back')}
          </Link>
        </Button>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" /> {t('secureNote')}
        </div>
      </div>

      <h1 className="mb-2 font-display text-3xl font-semibold tracking-tight">{t('title')}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{t('subtitle')}</p>

      {/* Stripe's embedded form renders here. Card / Apple Pay / Google Pay /
          Link / other local methods appear automatically based on the
          buyer's device and the merchant's Stripe dashboard config. */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden rounded-2xl border bg-white shadow-xl dark:bg-zinc-100"
      >
        <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </motion.div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Loader2 className="size-3 animate-spin" /> {t('verifying')}
        </span>
        <span aria-hidden>·</span>
        <span>{t('poweredBy')}</span>
      </div>
    </div>
  );
}
