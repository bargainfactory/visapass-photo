'use client';

import { motion } from 'framer-motion';
import { COUNTRIES } from '@/lib/countries';
import { Badge } from '@/components/ui/badge';

export function CountryShowcase() {
  return (
    <section id="countries" className="container py-16">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <Badge variant="brand">20+ specifications</Badge>
        <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl">
          Country-perfect, every time
        </h2>
        <p className="mt-3 text-muted-foreground">
          Each preset encodes head height ranges, eye line, glasses policy, and background tone.
        </p>
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
                  {doc.widthMm}×{doc.heightMm} mm
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {doc.glasses === 'forbidden' ? 'No glasses' : 'Glasses ok'}
                </Badge>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
