'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProgressStepper } from '@/components/progress-stepper';
import { UploadDropzone } from '@/components/upload-dropzone';
import { CameraCapture } from '@/components/camera-capture';
import { CountrySelector } from '@/components/country-selector';
import { EditorStudio } from '@/components/editor-studio';
import { ResultsPanel } from '@/components/results-panel';
import { newRenderToken, usePhotoStore } from '@/lib/store';
import { findDocument } from '@/lib/countries';

export default function EditorPage() {
  const t = useTranslations('editorPage');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const step = usePhotoStore((s) => s.step);
  const sourceUrl = usePhotoStore((s) => s.sourceUrl);
  const documentId = usePhotoStore((s) => s.documentId);
  const resultDataUrl = usePhotoStore((s) => s.resultDataUrl);
  const printSheetDataUrl = usePhotoStore((s) => s.printSheetDataUrl);
  const setStep = usePhotoStore((s) => s.setStep);
  const setSource = usePhotoStore((s) => s.setSource);
  const setDocument = usePhotoStore((s) => s.setDocument);
  const setRenderToken = usePhotoStore((s) => s.setRenderToken);
  const [cameraOpen, setCameraOpen] = React.useState(false);

  React.useEffect(() => {
    if (!sourceUrl && step !== 'upload') setStep('upload');
  }, [sourceUrl, step, setStep]);

  const handleFile = (file: File) => {
    const url = URL.createObjectURL(file);
    setSource(url, file.type);
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
    <div className="container py-8 md:py-12">
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
            <UploadDropzone onAccept={handleFile} onOpenCamera={() => setCameraOpen(true)} />
            <CameraCapture open={cameraOpen} onOpenChange={setCameraOpen} onCapture={handleFile} />
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
              documentId={documentId}
            />
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
