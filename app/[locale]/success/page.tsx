'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { motion } from 'framer-motion';
import { CheckCircle2, Download, Loader2, Printer } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { downloadDataUrl, jpegDataUrlToPng } from '@/lib/utils';
import { usePhotoStore } from '@/lib/store';
import { loadRecord, importDek, decryptToObjectUrl } from '@/lib/secure-delivery';

interface OrderStatus {
  status: 'pending' | 'paid' | 'fulfilled' | 'shipped' | 'unknown';
  amountCents: number | null;
  documentId: string | null;
  /**
   * Which package was purchased — one of 'digital' | 'print-sheet' | 'bundle'.
   * Read from Stripe checkout-session metadata. Drives which download buttons
   * appear so a digital-only buyer never sees the print sheet and vice versa.
   */
  packageId: string | null;
}

interface StashedResult {
  /** Decrypted object URLs ready for download. */
  digital: string;
  print: string | null;
  /** Back-of-sheet (Canada) — null when the doc doesn't require one. */
  printBack: string | null;
  doc: string;
  /** Buyer's chosen export format, carried from the editor. */
  format: 'jpeg' | 'png';
}

// Next.js requires any component reading useSearchParams() to sit beneath a
// <Suspense> boundary so the static prerender can defer it to client-side.
// The default export is just that boundary; SuccessContent below holds the
// real logic.
export default function SuccessPage() {
  return (
    <React.Suspense fallback={<SuccessFallback />}>
      <SuccessContent />
    </React.Suspense>
  );
}

function SuccessFallback() {
  return (
    <div className="container max-w-2xl py-16">
      <Card>
        <CardContent className="grid place-items-center gap-3 p-12 text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </CardContent>
      </Card>
    </div>
  );
}

function SuccessContent() {
  const t = useTranslations('success');
  const tResults = useTranslations('results');
  const params = useSearchParams();
  const sessionId = params.get('session_id');
  const [status, setStatus] = React.useState<OrderStatus | null>(null);
  const [stashed, setStashed] = React.useState<StashedResult | null>(null);
  const [deliveryError, setDeliveryError] = React.useState(false);
  const updateOrderStatus = usePhotoStore((s) => s.updateOrderStatus);

  const paid =
    status?.status === 'paid' ||
    status?.status === 'fulfilled' ||
    status?.status === 'shipped';

  // Once payment is confirmed, decrypt the deliverables. The encrypted bytes
  // live in IndexedDB on THIS device (written at checkout); the AES key is
  // released by /api/release-key only because Stripe says the session is paid.
  // A stranger with a bogus/unpaid session_id gets no key, and even the buyer
  // can't decrypt on a different device (the ciphertext isn't there). Demo
  // sessions hold the key client-side since there's no real payment to gate.
  React.useEffect(() => {
    if (!paid || stashed || !sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const record = await loadRecord(sessionId);
        // No ciphertext on this device (e.g. opened the success link in a
        // different browser than the one used to create the photo). Surface the
        // "reopen in the original browser" message instead of spinning forever.
        if (!record) {
          if (!cancelled) setDeliveryError(true);
          return;
        }

        let dekB64: string | null = null;
        if (sessionId.startsWith('cs_demo_')) {
          dekB64 = sessionStorage.getItem('vp-demo-dek');
        } else {
          const r = await fetch(`/api/release-key?session_id=${encodeURIComponent(sessionId)}`);
          if (r.ok) dekB64 = ((await r.json()) as { dek?: string }).dek ?? null;
        }
        if (!dekB64) {
          if (!cancelled) setDeliveryError(true);
          return;
        }

        const key = await importDek(dekB64);
        const digital = (await decryptToObjectUrl(key, record.items.digital!)).url;
        const print = record.items.print
          ? (await decryptToObjectUrl(key, record.items.print)).url
          : null;
        const printBack = record.items.printBack
          ? (await decryptToObjectUrl(key, record.items.printBack)).url
          : null;
        const format =
          (sessionStorage.getItem('vp-pending-format') as 'jpeg' | 'png') || 'jpeg';

        if (!cancelled) {
          setStashed({ digital, print, printBack, doc: record.documentId, format });
        }
      } catch {
        if (!cancelled) setDeliveryError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [paid, sessionId, stashed]);

  React.useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };
    const fetchStatus = async () => {
      try {
        const r = await fetch(`/api/order-status?session_id=${encodeURIComponent(sessionId)}`);
        if (!r.ok) return;
        const data: OrderStatus = await r.json();
        if (cancelled) return;
        setStatus(data);
        // Propagate the confirmed payment back into the Zustand store so the
        // results page in /editor knows this session is paid and unlocks the
        // downloads (state is persisted to localStorage, survives reload).
        if (
          data.status === 'paid' ||
          data.status === 'fulfilled' ||
          data.status === 'shipped'
        ) {
          updateOrderStatus(sessionId, data.status);
          // Terminal state reached — stop polling instead of hammering Stripe
          // (and the order-status route) every 4 s for the page's lifetime.
          stop();
        }
      } catch {
        /* ignore */
      }
    };
    fetchStatus();
    timer = setInterval(fetchStatus, 4000);
    return () => {
      cancelled = true;
      stop();
    };
  }, [sessionId, updateOrderStatus]);

  return (
    <div className="container max-w-2xl py-16">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardContent className="space-y-6 p-8 text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-500/15 text-emerald-600">
              <CheckCircle2 className="size-7" />
            </div>
            <div>
              <h1 className="font-display text-3xl font-semibold">{t('title')}</h1>
              <p className="mt-2 text-muted-foreground">{t('subtitle')}</p>
            </div>

            <div className="grid gap-3 text-start">
              <Row
                icon={<CheckCircle2 className="size-4 text-emerald-600" />}
                label={t('paymentConfirmed')}
                value={status?.amountCents ? `$${(status.amountCents / 100).toFixed(2)}` : '—'}
              />
            </div>

            {/* Download grid — one card per file the customer actually paid
                for, with a live preview thumbnail so they see exactly what
                they're getting. Gated by Stripe-confirmed packageId so a
                "digital" buyer never sees the print sheet, a "print-sheet"
                buyer never sees the digital file, etc. */}
            {paid && stashed && (
              <DownloadGrid
                stashed={stashed}
                packageId={status?.packageId ?? 'bundle'}
                tResults={tResults}
              />
            )}

            {/* Print-at-home guidance — only when the purchase includes a sheet. */}
            {paid &&
              stashed?.print &&
              (status?.packageId ?? 'bundle') !== 'digital' && (
                <div className="rounded-xl border bg-muted/30 px-4 py-3 text-start text-xs text-muted-foreground">
                  <p className="mb-1 flex items-center gap-1.5 font-semibold text-foreground">
                    <Printer className="size-3.5" /> {t('printTip.title')}
                  </p>
                  <p>{t('printTip.body')}</p>
                </div>
              )}

            {/* Paid, key released, but still decrypting the local ciphertext. */}
            {paid && !stashed && !deliveryError && (
              <div className="grid place-items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
                <span>{t('preparingFiles')}</span>
              </div>
            )}

            {/* Paid, but the deliverables aren't on this device / couldn't be
                unlocked (e.g. the success link was opened in a different
                browser than the one used to create the photo). */}
            {paid && deliveryError && (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-xs text-amber-700 dark:text-amber-400">
                {t('deliveryUnavailable')}
              </p>
            )}

            <Button asChild variant={paid && stashed ? 'outline' : 'brand'} size="lg" className="w-full">
              <Link href="/editor">{t('another')}</Link>
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border bg-muted/40 px-4 py-3">
      <div className="flex items-center gap-2 text-sm">
        {icon}
        <span>{label}</span>
      </div>
      <Badge variant="outline">{value}</Badge>
    </div>
  );
}

interface DownloadGridProps {
  stashed: StashedResult;
  /** Stripe-confirmed package: 'digital' | 'print-sheet' | 'bundle'. */
  packageId: string;
  tResults: ReturnType<typeof useTranslations>;
}

interface DownloadEntry {
  key: string;
  /** Preview thumbnail src (the front sheet doubles for print). */
  thumbnail: string;
  /** Optional second thumbnail (Canada's print-sheet back). */
  thumbnailExtra?: string;
  title: string;
  /** All files that should download when the user clicks the card. */
  files: Array<{ src: string; filename: string }>;
}

/**
 * Mirrors the package picker on the editor: at most two cards — one for the
 * Digital deliverable, one for the 4×6 Printable. When a country requires a
 * back template (Canada), the Print card downloads BOTH front and back files
 * in sequence on a single click; its preview shows both thumbnails so the
 * buyer sees they're getting two sheets.
 *
 *   digital      → Digital card only
 *   print-sheet  → Printable 4×6 card only
 *   bundle       → both cards
 */
function DownloadGrid({ stashed, packageId, tResults }: DownloadGridProps) {
  const entries: DownloadEntry[] = [];
  const wantsDigital = packageId === 'digital' || packageId === 'bundle';
  const wantsPrint = packageId === 'print-sheet' || packageId === 'bundle';
  const ext = stashed.format === 'png' ? 'png' : 'jpg';

  if (wantsDigital) {
    entries.push({
      key: 'digital',
      thumbnail: stashed.digital,
      title: tResults('tabs.digital'),
      files: [{ src: stashed.digital, filename: `${stashed.doc}.${ext}` }],
    });
  }
  if (wantsPrint && stashed.print) {
    const files = [
      { src: stashed.print, filename: `${stashed.doc}-print-sheet-front.${ext}` },
    ];
    if (stashed.printBack) {
      files.push({
        src: stashed.printBack,
        filename: `${stashed.doc}-print-sheet-back.${ext}`,
      });
    }
    entries.push({
      key: 'print',
      thumbnail: stashed.print,
      thumbnailExtra: stashed.printBack ?? undefined,
      title: tResults('tabs.print'),
      files,
    });
  }

  if (entries.length === 0) return null;

  return (
    <div
      className={
        entries.length === 1
          ? 'grid grid-cols-1 gap-3'
          : 'grid grid-cols-1 gap-3 sm:grid-cols-2'
      }
    >
      {entries.map((entry) => (
        <DownloadCard key={entry.key} entry={entry} format={stashed.format} />
      ))}
    </div>
  );
}

function DownloadCard({ entry, format }: { entry: DownloadEntry; format: 'jpeg' | 'png' }) {
  const t = useTranslations('success');
  // The decrypted deliverables are JPEG object URLs. For a JPEG export we hand
  // them straight to the browser; for PNG we round-trip each through a canvas
  // first. All triggered from one user gesture so multi-file downloads work.
  const downloadAll = async () => {
    for (const f of entry.files) {
      if (format === 'png') {
        const png = await jpegDataUrlToPng(f.src);
        downloadDataUrl(png, f.filename);
      } else {
        downloadDataUrl(f.src, f.filename);
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border bg-muted/30 p-4">
      <div
        className={
          entry.thumbnailExtra
            ? 'grid w-full grid-cols-2 gap-2'
            : 'grid w-full grid-cols-1'
        }
      >
        <ThumbBox src={entry.thumbnail} />
        {entry.thumbnailExtra && <ThumbBox src={entry.thumbnailExtra} />}
      </div>
      <p className="text-center text-sm font-semibold leading-tight">{entry.title}</p>
      <Button variant="brand" size="lg" className="w-full" onClick={downloadAll}>
        <Download className="size-4" />
        {entry.files.length > 1 ? t('downloadN', { count: entry.files.length }) : t('download')}
      </Button>
    </div>
  );
}

/**
 * Preview of the actual deliverable. Rendered at the photo's TRUE aspect ratio
 * (the compliant output dimensions), edge-to-edge — no square letterbox, no
 * white padding, no rounded corners or border. So a US 51×51 mm photo shows
 * square and a 35×45 mm photo shows portrait, exactly as downloaded.
 */
function ThumbBox({ src }: { src: string }) {
  return <img src={src} alt="" draggable={false} className="block h-auto w-full" />;
}
