'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Camera, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface CameraCaptureProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCapture: (file: File) => void;
}

export function CameraCapture({ open, onOpenChange, onCapture }: CameraCaptureProps) {
  const t = useTranslations('camera');
  const tCommon = useTranslations('common');
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const [facing, setFacing] = React.useState<'user' | 'environment'>('user');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1920 } } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((trk) => trk.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setError(t('denied')));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((trk) => trk.stop());
      streamRef.current = null;
    };
  }, [open, facing, t]);

  const snap = () => {
    const v = videoRef.current;
    if (!v) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext('2d')!;
    // Do NOT mirror the saved image. The front-camera live preview is mirrored
    // (familiar selfie feel), but a passport photo must be a TRUE likeness —
    // baking the flip in would reverse the hair part, moles and asymmetries.
    ctx.drawImage(v, 0, 0);
    c.toBlob(
      (b) => {
        if (!b) return;
        onCapture(new File([b], `selfie-${Date.now()}.jpg`, { type: 'image/jpeg' }));
        onOpenChange(false);
      },
      'image/jpeg',
      0.95
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="size-4" /> {t('title')}
          </DialogTitle>
        </DialogHeader>
        <div className="relative aspect-square overflow-hidden rounded-xl bg-muted">
          {error ? (
            <div className="grid h-full place-items-center p-6 text-center text-sm text-muted-foreground">
              {error}
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
              style={facing === 'user' ? { transform: 'scaleX(-1)' } : undefined}
            />
          )}
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <svg viewBox="0 0 100 100" className="h-full w-full">
              <defs>
                <mask id="hole">
                  <rect width="100" height="100" fill="white" />
                  <ellipse cx="50" cy="50" rx="22" ry="32" fill="black" />
                </mask>
              </defs>
              <rect width="100" height="100" fill="rgba(0,0,0,0.35)" mask="url(#hole)" />
              <ellipse
                cx="50"
                cy="50"
                rx="22"
                ry="32"
                fill="none"
                stroke="rgba(255,255,255,0.8)"
                strokeWidth="0.5"
                strokeDasharray="2 2"
              />
            </svg>
          </div>
        </div>
        <div className="flex justify-between gap-2">
          <Button variant="outline" onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}>
            <RotateCcw className="size-4" /> {t('flip')}
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              <X className="size-4" /> {tCommon('cancel')}
            </Button>
            <Button variant="brand" onClick={snap} disabled={!!error}>
              <Camera className="size-4" /> {t('capture')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
