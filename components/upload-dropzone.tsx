'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Camera, ImageUp, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, formatBytes } from '@/lib/utils';

interface UploadDropzoneProps {
  onAccept: (file: File) => void;
  onOpenCamera?: () => void;
}

export function UploadDropzone({ onAccept, onOpenCamera }: UploadDropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [drag, setDrag] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const validate = (file: File) => {
    if (!/^image\/(jpeg|jpg|png|webp|heic|heif)$/i.test(file.type) && file.type !== '') {
      setError('Please upload a JPG, PNG, WebP, or HEIC photo.');
      return false;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError(`That file is ${formatBytes(file.size)} — please use a photo under 25 MB.`);
      return false;
    }
    setError(null);
    return true;
  };

  const handleFile = (file?: File | null) => {
    if (!file || !validate(file)) return;
    onAccept(file);
  };

  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        className={cn(
          'group relative grid cursor-pointer place-items-center overflow-hidden rounded-3xl border-2 border-dashed bg-card/60 px-6 py-14 text-center backdrop-blur transition-all',
          drag ? 'border-brand-400 bg-brand-500/10 scale-[1.01]' : 'border-border hover:border-brand-400/70 hover:bg-brand-500/[0.04]'
        )}
        aria-label="Upload a photo"
      >
        <div className="pointer-events-none absolute -inset-px bg-[radial-gradient(circle_at_50%_-10%,hsl(var(--primary)/0.12),transparent_60%)] opacity-0 transition-opacity group-hover:opacity-100" />
        <div className="relative space-y-4">
          <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-500/30">
            <ImageUp className="size-7" />
          </div>
          <div>
            <p className="text-lg font-semibold">Drop a photo, or click to upload</p>
            <p className="mt-1 text-sm text-muted-foreground">
              JPG / PNG / HEIC · up to 25 MB · processed entirely on your device
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              variant="brand"
              size="lg"
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
            >
              <Sparkles className="size-4" /> Choose a photo
            </Button>
            {onOpenCamera && (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenCamera();
                }}
              >
                <Camera className="size-4" /> Use camera
              </Button>
            )}
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </motion.div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
