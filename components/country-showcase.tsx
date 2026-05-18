'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { COUNTRIES } from '@/lib/countries';
import { Badge } from '@/components/ui/badge';

export function CountryShowcase() {
  const t = useTranslations('countryShowcase');
  return (
    <section id="countries" className="container py-16">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <Badge variant="brand">{t('badge')}</Badge>
        <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl">{t('heading')}</h2>
        <p className="mt-3 text-muted-foreground">{t('subtitle')}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {COUNTRIES.map((c, i) => {
          const doc = c.documents[0];
          return (
            <motion.div
              key={c.code}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.3, delay: (i % 8) * 0.03 }}
              className="group relative overflow-hidden rounded-2xl border bg-card/60 p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="flex items-center gap-2">
                <span className="text-3xl leading-none">{c.flag}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{doc.label}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                <Badge variant="secondary" className="text-[10px]">
                  {t('headSize', { w: doc.widthMm, h: doc.heightMm })}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {doc.glasses === 'forbidden' ? t('glassesNo') : t('glassesOk')}
                </Badge>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
