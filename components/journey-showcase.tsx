'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Camera, ImageUp, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * Full-bleed, three-panel journey: selfie → upload portal → compliant
 * passport photo. Sits between the hero and the feature grid as a wide,
 * visually distinct band so it's the first thing a scrolling visitor
 * lands on after the pitch.
 *
 * The infographic lives at `public/showcase/journey.webp` and is served
 * through next/image with its own srcset so devices request only the
 * width they need (smallest at 640px wide, largest 2048px).
 */
export function JourneyShowcase() {
  const t = useTranslations('journey');

  const steps = [
    { icon: Camera, key: 'step1' },
    { icon: ImageUp, key: 'step2' },
    { icon: ShieldCheck, key: 'step3' },
  ] as const;

  return (
    <section className="relative overflow-hidden border-y bg-gradient-to-b from-background via-brand-500/[0.04] to-background py-20 md:py-28">
      {/* Decorative mesh glow behind the band. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-[60%] max-w-5xl bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.16),transparent_70%)] blur-3xl"
      />

      <div className="container">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <Badge variant="brand" className="px-3 py-1 text-xs uppercase tracking-wider">
            {t('badge')}
          </Badge>
          <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight md:text-5xl">
            {t('heading')}
          </h2>
          <p className="mt-4 text-base text-muted-foreground md:text-lg">{t('subtitle')}</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="relative mx-auto max-w-6xl"
        >
          <div className="overflow-hidden rounded-3xl border bg-card shadow-[0_30px_80px_-30px_rgba(15,23,42,0.5)] ring-1 ring-black/[0.05] dark:ring-white/[0.06]">
            <Image
              src="/showcase/journey.webp"
              alt=""
              width={1920}
              height={1280}
              sizes="(min-width: 1280px) 1152px, (min-width: 768px) 90vw, 100vw"
              className="h-auto w-full select-none"
              priority={false}
            />
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {steps.map((s, i) => (
              <div
                key={s.key}
                className="flex items-center gap-3 rounded-2xl border bg-card/80 p-4 backdrop-blur transition-colors hover:bg-card"
              >
                <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-500/15 text-brand-600 dark:text-brand-300">
                  <s.icon className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {t('stepLabel', { n: i + 1 })}
                  </p>
                  <p className="text-sm font-semibold">{t(s.key)}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
