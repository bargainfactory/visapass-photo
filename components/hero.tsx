'use client';

import * as React from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Brain, Cpu, Globe2, Lock, Sparkles, Zap } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UploadDropzone } from '@/components/upload-dropzone';
import { CameraCapture } from '@/components/camera-capture';
import { newRenderToken, usePhotoStore } from '@/lib/store';

export function Hero() {
  const t = useTranslations();
  const router = useRouter();
  const setSource = usePhotoStore((s) => s.setSource);
  const setStep = usePhotoStore((s) => s.setStep);
  const setRenderToken = usePhotoStore((s) => s.setRenderToken);
  const [cameraOpen, setCameraOpen] = React.useState(false);

  const handleFile = (file: File) => {
    const url = URL.createObjectURL(file);
    setSource(url, file.type);
    // Fresh upload → fresh render token so any earlier paid order does
    // NOT carry over to this new photo. See lib/store.ts comments.
    setRenderToken(newRenderToken());
    setStep('select');
    router.push('/editor');
  };

  return (
    <section className="relative overflow-hidden">
      {/* Hero background art: the three-panel journey infographic (selfie →
          upload portal → compliant photo). next/image serves an auto-resized
          WebP/AVIF variant; `priority` because the image is part of the LCP
          paint. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-30">
        <Image
          src="/showcase/hero-journey.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      </div>
      {/* Left-to-right contrast overlay: solid background behind the headline
          on the left so the text always reads, fading to ~25% opacity on the
          right where the upload card sits and the photo shows through. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20 bg-gradient-to-r from-background via-background/80 to-background/25 dark:from-background dark:via-background/80 dark:to-background/30"
      />
      {/* Brand-blue radial glow on top — same premium feel as before. */}
      <div className="pointer-events-none absolute inset-x-0 -top-40 -z-10 h-[40rem] bg-[radial-gradient(circle_at_50%_30%,hsl(220_100%_70%/0.2),transparent_60%)] dark:opacity-30" />

      {/* The hero is now one tall flex column: title block at the top-left,
          upload card pushed to the bottom-left via mt-auto and a generous
          gap. The right ~50% of the section stays unobstructed so the
          three-panel background art (selfie → portal → finished photo) is
          actually visible alongside the content. */}
      <div className="container flex min-h-[78vh] flex-col py-12 md:py-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className="max-w-2xl space-y-6"
        >
          <Badge variant="brand" className="px-3 py-1 text-xs uppercase tracking-wider">
            <Sparkles className="me-1 size-3" /> {t('hero.badge')}
          </Badge>
          <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            {t('hero.titleLine1')}
            <br />
            <span className="bg-gradient-to-tr from-brand-700 via-brand-500 to-brand-300 bg-clip-text text-transparent">
              {t('hero.titleLine2')}
            </span>
          </h1>
          <p className="max-w-xl text-base text-muted-foreground md:text-lg">{t('hero.subtitle')}</p>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-card/60 px-3 py-1.5">
              <Brain className="size-3.5 text-brand-500" /> {t('hero.chip468')}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-card/60 px-3 py-1.5">
              <Cpu className="size-3.5 text-brand-500" /> {t('hero.chip600dpi')}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-card/60 px-3 py-1.5">
              <Globe2 className="size-3.5 text-brand-500" /> {t('hero.chipCountries')}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-card/60 px-3 py-1.5">
              <Lock className="size-3.5 text-brand-500" /> {t('hero.chipPrivacy')}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-card/60 px-3 py-1.5">
              <Zap className="size-3.5 text-brand-500" /> {t('hero.chipStripe')}
            </span>
          </div>
        </motion.div>

        {/* Upload card — pushed to the bottom-left of the section (mt-auto)
            and constrained to max-w-md so the right half of the hero is left
            free for the background photo to come through. */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-12 w-full max-w-md md:mt-auto md:pt-16"
        >
          <UploadDropzone onAccept={handleFile} onOpenCamera={() => setCameraOpen(true)} />
          <CameraCapture open={cameraOpen} onOpenChange={setCameraOpen} onCapture={handleFile} />
          <div className="mt-4 flex">
            <Button variant="link" size="sm" asChild className="ps-0">
              <a href="#countries">{t('hero.seeCountries')}</a>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
