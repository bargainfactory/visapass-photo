'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Camera, ImageUp, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * Three-panel journey: selfie → upload portal → compliant passport photo.
 * Sits directly under the hero so the visitor sees the entire experience
 * before they read about the engineering. The .png lives in `public/showcase/`
 * and is served through next/image so it's auto-converted to WebP/AVIF and
 * responsively sized.
 */
export function JourneyShowcase() {
  const t = useTranslations('journey');

  const steps = [
    { icon: Camera, key: 'step1' },
    { icon: ImageUp, key: 'step2' },
    { icon: ShieldCheck, key: 'step3' },
  ] as const;

  return (
    <section className="container py-16 md:py-24">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <Badge variant="brand">{t('badge')}</Badge>
        <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl">
          {t('heading')}
        </h2>
        <p className="mt-3 text-muted-foreground">{t('subtitle')}</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative mx-auto max-w-5xl"
      >
        {/* Soft radial glow behind the image — picks up the brand-blue from the
            theme on both light and dark backgrounds. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-10 -z-10 rounded-[3rem] bg-[radial-gradient(circle_at_50%_55%,hsl(var(--primary)/0.22),transparent_70%)] blur-3xl"
        />

        <div className="overflow-hidden rounded-3xl border bg-card shadow-2xl ring-1 ring-black/[0.04] dark:ring-white/[0.04]">
          <Image
            src="/showcase/journey.png"
            alt=""
            width={3000}
            height={2000}
            sizes="(min-width: 1024px) 960px, 100vw"
            className="h-auto w-full select-none"
            priority={false}
          />
        </div>

        {/* Step pills under the image — match each panel of the infographic
            and give the user a textual anchor for what they're seeing. */}
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {steps.map((s, i) => (
            <div
              key={s.key}
              className="flex items-center gap-3 rounded-2xl border bg-card/70 p-4 backdrop-blur"
            >
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-500/15 text-brand-600 dark:text-brand-300">
                <s.icon className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {t('stepLabel', { n: i + 1 })}
                </p>
                <p className="truncate text-sm font-semibold">{t(s.key)}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
