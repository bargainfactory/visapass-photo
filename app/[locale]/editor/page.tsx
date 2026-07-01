'use client';

import * as React from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, CheckCircle2, Lightbulb, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ProgressStepper } from '@/components/progress-stepper';
import { UploadDropzone } from '@/components/upload-dropzone';
import { CameraCapture } from '@/components/camera-capture';
import { CountrySelector } from '@/components/country-selector';
import { EditorStudio } from '@/components/editor-studio';
import { ResultsPanel } from '@/components/results-panel';
import { newRenderToken, usePhotoStore } from '@/lib/store';
import { findDocument } from '@/lib/countries';
import { toDecodableImage } from '@/lib/heic';
import { getFaceLandmarker } from '@/lib/face-landmarker';
import { warmupBackgroundRemoval } from '@/lib/background-removal-client';

export default function EditorPage() {
  const t = useTranslations('editorPage');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const step = usePhotoStore((s) => s.step);
  const sourceUrl = usePhotoStore((s) => s.sourceUrl);
  const documentId = usePhotoStore((s) => s.documentId);
  const resultDataUrl = usePhotoStore((s) => s.resultDataUrl);
  const printSheetDataUrl = usePhotoStore((s) => s.printSheetDataUrl);
  const printSheetBackDataUrl = usePhotoStore((s) => s.printSheetBackDataUrl);
  const setStep = usePhotoStore((s) => s.setStep);
  const setSource = usePhotoStore((s) => s.setSource);
  const setDocument = usePhotoStore((s) => s.setDocument);
  const setRenderToken = usePhotoStore((s) => s.setRenderToken);
  const [cameraOpen, setCameraOpen] = React.useState(false);
  const [converting, setConverting] = React.useState(false);

  React.useEffect(() => {
    if (!sourceUrl && step !== 'upload') setStep('upload');
  }, [sourceUrl, step, setStep]);

  // Warm the heavy on-device models ahead of the Studio step so the pipeline
  // feels instant. The face landmarker (MediaPipe wasm + model) starts as soon
  // as the editor mounts; the ~22 MB background-removal model is kicked off
  // once the user has committed a photo (the 'select' step), while they pick a
  // country — so its download overlaps the country selection instead of
  // stalling on "Warming up the AI…" later.
  React.useEffect(() => {
    getFaceLandmarker().catch(() => {});
  }, []);
  React.useEffect(() => {
    if (step === 'select' || step === 'edit') warmupBackgroundRemoval();
  }, [step]);

  const handleFile = async (file: File) => {
    // iPhone HEIC/HEIF → JPEG so Chrome/Firefox/Edge can actually decode it.
    let f = file;
    try {
      setConverting(true);
      f = await toDecodableImage(file);
    } catch {
      /* decode failed — fall through with the original; the pipeline surfaces
         a friendly "could not load" error if it truly can't be read */
    } finally {
      setConverting(false);
    }
    const url = URL.createObjectURL(f);
    setSource(url, f.type);
    // Fresh upload → fresh render token so any earlier paid order does
    // NOT carry over to this new photo. See lib/store.ts comments.
    setRenderToken(newRenderToken());
    setStep('select');
  };

  const goBack = () => {
    if (step === 'select') setStep('upload');
    else if (step === 'edit') setStep('select');
    else if (step === 'result') setStep('edit');
    else router.push('/');
  };

  return (
    <div className="relative overflow-hidden">
      {/* Same hero-journey background as the landing page so the editor
          feels like a continuation of /en rather than a stripped-down chrome
          on a flat surface. Heavier opacity overlay than the hero — the
          wizard UI needs to stay the focal point, but the photo is still
          visible behind it. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-30">
        <Image
          src="/showcase/hero-journey.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-60"
        />
      </div>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-20 bg-gradient-to-b from-background/85 via-background/75 to-background/95 dark:from-background/90 dark:via-background/80 dark:to-background"
      />

      <div className="container relative py-8 md:py-12">
        <div className="mb-8 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" size="sm" onClick={goBack}>
              <ArrowLeft className="size-4 rtl:rotate-180" /> {tCommon('back')}
            </Button>
            <ProgressStepper step={step} />
          </div>
        </div>

      <AnimatePresence mode="wait">
        {step === 'upload' && (
          <motion.section
            key="upload"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="mx-auto max-w-2xl space-y-3"
          >
            <h1 className="font-display text-3xl font-semibold">{t('uploadTitle')}</h1>
            <p className="text-muted-foreground">{t('uploadSubtitle')}</p>
            {converting ? (
              <div className="grid place-items-center gap-3 rounded-2xl border bg-muted/30 py-16 text-sm text-muted-foreground">
                <Loader2 className="size-6 animate-spin" />
                <span>{t('converting')}</span>
              </div>
            ) : (
              <UploadDropzone onAccept={handleFile} onOpenCamera={() => setCameraOpen(true)} />
            )}
            <CameraCapture open={cameraOpen} onOpenChange={setCameraOpen} onCapture={handleFile} />
            {!converting && (
              <Card className="bg-muted/30">
                <CardContent className="p-5">
                  <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                    <Lightbulb className="size-4 text-brand-500" /> {t('tips.title')}
                  </p>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {(t.raw('tips.items') as string[]).map((tip, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </motion.section>
        )}

        {step === 'select' && (
          <motion.section
            key="select"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="grid gap-8 lg:grid-cols-[1fr_1.2fr]"
          >
            <div className="space-y-3">
              <h1 className="font-display text-3xl font-semibold">{t('selectTitle')}</h1>
              <p className="text-muted-foreground">{t('selectSubtitle')}</p>
              {sourceUrl && (
                <div className="overflow-hidden rounded-2xl border bg-muted/40">
                  <img src={sourceUrl} alt="" className="aspect-square w-full object-cover" />
                </div>
              )}
            </div>
            <div className="space-y-3">
              <CountrySelector selectedDocId={documentId} onSelect={(_c, d) => setDocument(d.id)} />
              <Button
                size="lg"
                variant="brand"
                className="w-full"
                disabled={!documentId}
                onClick={() => setStep('edit')}
              >
                {t('selectContinue')} <ArrowRight className="size-4 rtl:rotate-180" />
              </Button>
            </div>
          </motion.section>
        )}

        {step === 'edit' && sourceUrl && documentId && findDocument(documentId) && (
          <motion.section
            key="edit"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <div>
              <h1 className="font-display text-3xl font-semibold">{t('studioTitle')}</h1>
              <p className="text-muted-foreground">{t('studioSubtitle')}</p>
            </div>
            <EditorStudio
              sourceUrl={sourceUrl}
              documentId={documentId}
              onComplete={() => setStep('result')}
            />
          </motion.section>
        )}

        {step === 'result' && resultDataUrl && documentId && (
          <motion.section
            key="result"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <div>
              <h1 className="font-display text-3xl font-semibold">{t('resultTitle')}</h1>
              <p className="text-muted-foreground">{t('resultSubtitle')}</p>
            </div>
            <ResultsPanel
              resultDataUrl={resultDataUrl}
              printSheetDataUrl={printSheetDataUrl}
              printSheetBackDataUrl={printSheetBackDataUrl}
              documentId={documentId}
            />
          </motion.section>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
