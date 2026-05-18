'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Brain, Globe2, Lock, Scissors, ShieldCheck, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const FEATURES = [
  { key: 'landmarks', icon: Brain },
  { key: 'bgswap', icon: Scissors },
  { key: 'presets', icon: Globe2 },
  { key: 'validation', icon: ShieldCheck },
  { key: 'privacy', icon: Lock },
  { key: 'print', icon: Sparkles },
] as const;

export function FeatureGrid() {
  const t = useTranslations('features');
  return (
    <section className="container py-16">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{t('heading')}</h2>
        <p className="mt-3 text-muted-foreground">{t('subtitle')}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.key}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
          >
            <Card className="h-full transition-shadow hover:shadow-xl">
              <CardContent className="space-y-3 p-6">
                <div className="grid size-10 place-items-center rounded-xl bg-brand-500/10 text-brand-600">
                  <f.icon className="size-5" />
                </div>
                <h3 className="text-base font-semibold">{t(`${f.key}.title`)}</h3>
                <p className="text-sm text-muted-foreground">{t(`${f.key}.body`)}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
