'use client';

import { motion } from 'framer-motion';
import { Brain, Globe2, Lock, Scissors, ShieldCheck, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const FEATURES = [
  {
    icon: Brain,
    title: '468 facial landmarks',
    body: 'MediaPipe Face Landmarker locks onto chin, crown, and eye line for math-precise compliance — not vibes-based cropping.',
  },
  {
    icon: Scissors,
    title: 'High-res background swap',
    body: 'We process at the equivalent of 600 DPI in a Web Worker so hair strands and shoulders stay sharp before downscaling.',
  },
  {
    icon: Globe2,
    title: '20+ country presets',
    body: 'Schengen, US 2×2, UK 35×45, Canada 50×70, India 2×2, China 33×48 and many more — head ratios pre-encoded.',
  },
  {
    icon: ShieldCheck,
    title: 'Real-time validation',
    body: 'Confidence score, glasses-policy hints, and live warnings if your upload is too low-res to meet specifications.',
  },
  {
    icon: Lock,
    title: 'Stays on your device',
    body: 'No server upload by default — photos only leave your browser if you order physical prints via Stripe.',
  },
  {
    icon: Sparkles,
    title: 'Print-ready output',
    body: 'Download an ICAO-compliant JPEG and a 4×6” glossy-printer sheet at 300 DPI to print at any pharmacy.',
  },
];

export function FeatureGrid() {
  return (
    <section className="container py-16">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
          Engineered to pass on first submission
        </h2>
        <p className="mt-3 text-muted-foreground">
          Every pixel is computed against the issuing authority's spec — head ratio, eye-line
          position, and background color.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
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
                <h3 className="text-base font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.body}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
