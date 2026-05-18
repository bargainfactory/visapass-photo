'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Aperture,
  CheckCircle2,
  Eye,
  Loader2,
  RefreshCw,
  ScanFace,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { LandmarkOverlay } from '@/components/landmark-overlay';
import { detectFace, type FaceAnalysis } from '@/lib/face-landmarker';
import { calculateCrop, type CropRect } from '@/lib/crop-calculator';
import { composeFinal } from '@/lib/compositor';
import { removeBackground } from '@/lib/background-removal-client';
import { findDocument } from '@/lib/countries';
import { usePhotoStore } from '@/lib/store';

interface EditorStudioProps {
  sourceUrl: string;
  documentId: string;
  onComplete: () => void;
}

type Stage = 'idle' | 'detecting' | 'removing-bg' | 'composing' | 'done' | 'error';

interface PipelineState {
  stage: Stage;
  message: string;
  progress: number;
  face: FaceAnalysis | null;
  crop: CropRect | null;
  cutoutBlob: Blob | null;
  imageEl: HTMLImageElement | null;
  warnings: string[];
  error: string | null;
}

const initialState: PipelineState = {
  stage: 'idle',
  message: '',
  progress: 0,
  face: null,
  crop: null,
  cutoutBlob: null,
  imageEl: null,
  warnings: [],
  error: null,
};

export function EditorStudio({ sourceUrl, documentId, onComplete }: EditorStudioProps) {
  const docPair = React.useMemo(() => findDocument(documentId), [documentId]);
  const setResult = usePhotoStore((s) => s.setResult);
  const brightness = usePhotoStore((s) => s.brightness);
  const contrast = usePhotoStore((s) => s.contrast);
  const setAdjustments = usePhotoStore((s) => s.setAdjustments);
  const setFaceConfidence = usePhotoStore((s) => s.setFaceConfidence);

  const [state, setState] = React.useState<PipelineState>(initialState);
  const [showLandmarks, setShowLandmarks] = React.useState(true);
  const [showCrop, setShowCrop] = React.useState(true);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  const runPipeline = React.useCallback(async () => {
    if (!docPair) return;
    setState({ ...initialState, stage: 'detecting', message: 'Loading photo…', progress: 5 });
    try {
      const img = await loadImage(sourceUrl);
      setState((s) => ({ ...s, imageEl: img, message: 'Aligning 468 facial landmarks…', progress: 18 }));
      const face = await detectFace(img);
      if (!face) throw new Error('No face detected. Try a clearer, front-facing photo with even lighting.');
      setFaceConfidence(face.confidence);
      const crop = calculateCrop(face, docPair.doc, img.naturalWidth, img.naturalHeight);

      setState((s) => ({
        ...s,
        face,
        crop,
        stage: 'removing-bg',
        message: 'Processing background at high resolution…',
        progress: 35,
        warnings: crop.warnings,
      }));

      const blob = await fetch(sourceUrl).then((r) => r.blob());
      const cutoutBlob = await removeBackground(blob, (label, ratio) => {
        setState((s) => ({
          ...s,
          message: prettyLabel(label),
          progress: 35 + Math.round(ratio * 45),
        }));
      });

      setState((s) => ({ ...s, cutoutBlob, stage: 'composing', message: 'Compositing print-ready output…', progress: 88 }));
      const out = await composeFinal({
        source: img,
        cutoutBlob,
        doc: docPair.doc,
        crop,
        brightness,
        contrast,
      });
      setResult(out.dataUrl, out.printSheetDataUrl);
      setPreviewUrl(out.dataUrl);
      setState((s) => ({ ...s, stage: 'done', message: 'Ready to download', progress: 100 }));
    } catch (e: any) {
      setState((s) => ({ ...s, stage: 'error', error: e?.message ?? 'Unexpected error', message: '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceUrl, documentId]);

  React.useEffect(() => {
    runPipeline();
  }, [runPipeline]);

  // Re-composite quickly when brightness/contrast adjusted (no re-detection / no re-bg-removal).
  const recompose = React.useCallback(async () => {
    if (!docPair || !state.imageEl || !state.crop) return;
    const out = await composeFinal({
      source: state.imageEl,
      cutoutBlob: state.cutoutBlob,
      doc: docPair.doc,
      crop: state.crop,
      brightness,
      contrast,
    });
    setResult(out.dataUrl, out.printSheetDataUrl);
    setPreviewUrl(out.dataUrl);
  }, [docPair, state.imageEl, state.crop, state.cutoutBlob, brightness, contrast, setResult]);

  React.useEffect(() => {
    if (state.stage === 'done') recompose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brightness, contrast]);

  if (!docPair) return null;
  const { doc, country } = docPair;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      {/* Live split-view preview */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="grid grid-cols-2 divide-x">
            <div className="relative aspect-square bg-[radial-gradient(circle_at_50%_30%,hsl(var(--muted)),transparent)]">
              <div className="absolute left-3 top-3 z-10">
                <Badge variant="secondary" className="gap-1">
                  <ScanFace className="size-3" /> Source
                </Badge>
              </div>
              {state.imageEl && (
                <div className="relative h-full w-full">
                  <img
                    src={sourceUrl}
                    alt="Original upload"
                    className="h-full w-full object-contain"
                  />
                  <LandmarkOverlay
                    imageWidth={state.imageEl.naturalWidth}
                    imageHeight={state.imageEl.naturalHeight}
                    face={state.face}
                    crop={state.crop}
                    showLandmarks={showLandmarks}
                    showCrop={showCrop}
                  />
                </div>
              )}
            </div>
            <div
              className="relative aspect-square"
              style={{ background: doc.background }}
            >
              <div className="absolute left-3 top-3 z-10">
                <Badge variant="brand" className="gap-1">
                  <CheckCircle2 className="size-3" /> Compliant preview
                </Badge>
              </div>
              <AnimatePresence mode="wait">
                {previewUrl ? (
                  <motion.img
                    key={previewUrl}
                    src={previewUrl}
                    alt="Compliant preview"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="h-full w-full object-contain p-4"
                  />
                ) : (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="grid h-full place-items-center text-sm text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="size-5 animate-spin" />
                      <span>{state.message || 'Warming up the AI…'}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <div className="space-y-2 border-t bg-muted/40 p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-muted-foreground">
                {state.stage === 'done' ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600">
                    <CheckCircle2 className="size-3.5" /> Pipeline complete
                  </span>
                ) : (
                  state.message
                )}
              </div>
              <div className="text-xs tabular-nums text-muted-foreground">{state.progress}%</div>
            </div>
            <Progress value={state.progress} />
            {state.warnings.length > 0 && (
              <div className="space-y-1 pt-1">
                {state.warnings.map((w, i) => (
                  <p key={i} className="flex items-center gap-1.5 text-xs text-amber-600">
                    <AlertTriangle className="size-3.5" /> {w}
                  </p>
                ))}
              </div>
            )}
            {state.error && (
              <p className="flex items-center gap-1.5 text-sm text-destructive">
                <AlertTriangle className="size-4" /> {state.error}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Right-hand controls */}
      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <span className="text-2xl leading-none">{country.flag}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{doc.label}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {doc.widthMm}×{doc.heightMm}mm · {doc.dpi} DPI · {doc.glasses.replace('_', ' ')}
                </p>
              </div>
            </div>
            {doc.notes && (
              <ul className="space-y-1 text-xs text-muted-foreground">
                {doc.notes.map((n, i) => (
                  <li key={i} className="flex gap-1.5">
                    <Eye className="mt-0.5 size-3.5 shrink-0" /> {n}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Detection</p>
              {state.face && (
                <Badge variant={state.face.confidence > 0.6 ? 'success' : 'warning'}>
                  {(state.face.confidence * 100).toFixed(0)}% confidence
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="landmarks" className="flex flex-col">
                <span>Show 468 landmarks</span>
                <span className="text-xs font-normal text-muted-foreground">
                  Toggle the MediaPipe mesh overlay
                </span>
              </Label>
              <Switch id="landmarks" checked={showLandmarks} onCheckedChange={setShowLandmarks} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="crop" className="flex flex-col">
                <span>Show compliant crop</span>
                <span className="text-xs font-normal text-muted-foreground">
                  Dashed orange rectangle on the source
                </span>
              </Label>
              <Switch id="crop" checked={showCrop} onCheckedChange={setShowCrop} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-5 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Color tuning</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAdjustments(0, 0)}
                disabled={brightness === 0 && contrast === 0}
              >
                <RefreshCw className="size-3" /> Reset
              </Button>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <Label>Brightness</Label>
                <span className="tabular-nums text-muted-foreground">{brightness}</span>
              </div>
              <Slider
                value={[brightness]}
                onValueChange={([v]) => setAdjustments(v, contrast)}
                min={-50}
                max={50}
                step={1}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <Label>Contrast</Label>
                <span className="tabular-nums text-muted-foreground">{contrast}</span>
              </div>
              <Slider
                value={[contrast]}
                onValueChange={([v]) => setAdjustments(brightness, v)}
                min={-50}
                max={50}
                step={1}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button variant="outline" size="lg" onClick={runPipeline} className="flex-1">
            <Wand2 className="size-4" /> Re-run pipeline
          </Button>
          <Button
            variant="brand"
            size="lg"
            onClick={onComplete}
            disabled={state.stage !== 'done'}
            className="flex-1"
          >
            <Aperture className="size-4" /> Continue
          </Button>
        </div>
      </div>
    </div>
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load the photo.'));
    img.src = src;
  });
}

function prettyLabel(key: string): string {
  if (key.startsWith('fetch')) return 'Downloading AI model…';
  if (key.includes('decode')) return 'Decoding image at high resolution…';
  if (key.includes('process')) return 'Refining hair & shoulder edges…';
  if (key.includes('encode')) return 'Encoding clean RGBA cutout…';
  return 'Processing background at high resolution…';
}
