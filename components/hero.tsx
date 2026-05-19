'use client';

import * as React from 'react';
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
      <div className="pointer-events-none absolute inset-0 -z-10 bg-mesh-light opacity-90 dark:bg-mesh-dark" />
      <div className="pointer-events-none absolute inset-x-0 -top-40 -z-10 h-[40rem] bg-[radial-gradient(circle_at_50%_30%,hsl(220_100%_70%/0.2),transparent_60%)] dark:opacity-30" />

      <div className="container py-12 md:py-20">
        <div className="grid items-center gap-12 md:grid-cols-[1.1fr_0.9fr]">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            className="space-y-6"
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

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <UploadDropzone onAccept={handleFile} onOpenCamera={() => setCameraOpen(true)} />
            <CameraCapture open={cameraOpen} onOpenChange={setCameraOpen} onCapture={handleFile} />
            <div className="mt-4 flex justify-center">
              <Button variant="link" size="sm" asChild>
                <a href="#countries">{t('hero.seeCountries')}</a>
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
