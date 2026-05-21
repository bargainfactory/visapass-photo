'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { motion } from 'framer-motion';
import { CheckCircle2, Download, Loader2, Mail, Truck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { downloadDataUrl } from '@/lib/utils';
import { usePhotoStore } from '@/lib/store';

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
  email: string | null;
}

interface StashedResult {
  digital: string;
  print: string | null;
  /** Back-of-sheet (Canada) — null when the doc doesn't require one. */
  printBack: string | null;
  doc: string;
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
  const [polls, setPolls] = React.useState(0);
  const [stashed, setStashed] = React.useState<StashedResult | null>(null);
  const updateOrderStatus = usePhotoStore((s) => s.updateOrderStatus);

  // After payment is confirmed by the webhook, pull the rendered photo +
  // print sheet out of sessionStorage (cached on the /editor side just
  // before the Stripe redirect) and expose download buttons. Reading is
  // gated on `paid` status so a stranger landing on /success with a bogus
  // session_id can't pull stashed data.
  const paid =
    status?.status === 'paid' ||
    status?.status === 'fulfilled' ||
    status?.status === 'shipped';

  React.useEffect(() => {
    if (!paid || stashed) return;
    try {
      const expectedSession = sessionStorage.getItem('vp-pending-session');
      if (!expectedSession || expectedSession !== sessionId) return;
      const digital = sessionStorage.getItem('vp-pending-result');
      const print = sessionStorage.getItem('vp-pending-print');
      const printBack = sessionStorage.getItem('vp-pending-print-back');
      const doc = sessionStorage.getItem('vp-pending-doc');
      if (digital && doc) setStashed({ digital, print, printBack, doc });
    } catch {
      /* ignore */
    }
  }, [paid, sessionId, stashed]);

  React.useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
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
        }
      } catch {
        /* ignore */
      }
    };
    fetchStatus();
    const i = setInterval(() => {
      setPolls((p) => p + 1);
      fetchStatus();
    }, 4000);
    return () => {
      cancelled = true;
      clearInterval(i);
    };
  }, [sessionId, updateOrderStatus]);

  const isFulfilled = status?.status === 'fulfilled' || status?.status === 'shipped';

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
              <Row
                icon={
                  isFulfilled ? (
                    <CheckCircle2 className="size-4 text-emerald-600" />
                  ) : (
                    <Loader2 className="size-4 animate-spin text-brand-600" />
                  )
                }
                label={t('fulfillment')}
                value={t(`status.${status?.status ?? 'unknown'}`)}
              />
              <Row
                icon={<Mail className="size-4" />}
                label={t('receiptTo')}
                value={status?.email ?? '—'}
              />
              <Row
                icon={<Truck className="size-4" />}
                label={t('shippingEta')}
                value={t('etaText')}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t('pollLine', { count: polls + 1, session: sessionId?.slice(0, 14) ?? '' })}
            </p>

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

/**
 * Renders one card per file the buyer actually paid for, with a live preview
 * thumbnail so they see exactly what they're downloading before clicking.
 *
 *   digital      → digital JPEG only
 *   print-sheet  → 4×6 sheet (front) [+ back if Canada/requiresBackTemplate]
 *   bundle       → all of the above
 */
function DownloadGrid({ stashed, packageId, tResults }: DownloadGridProps) {
  const items: Array<{ key: string; src: string; title: string; filename: string }> = [];
  const wantsDigital = packageId === 'digital' || packageId === 'bundle';
  const wantsPrint = packageId === 'print-sheet' || packageId === 'bundle';

  if (wantsDigital) {
    items.push({
      key: 'digital',
      src: stashed.digital,
      title: tResults('tabs.digital'),
      filename: `${stashed.doc}.jpg`,
    });
  }
  if (wantsPrint && stashed.print) {
    items.push({
      key: 'print-front',
      src: stashed.print,
      title: `${tResults('tabs.print')} — ${tResults('frontLabel')}`,
      filename: `${stashed.doc}-print-sheet-front.jpg`,
    });
  }
  if (wantsPrint && stashed.printBack) {
    items.push({
      key: 'print-back',
      src: stashed.printBack,
      title: `${tResults('tabs.print')} — ${tResults('backLabel')}`,
      filename: `${stashed.doc}-print-sheet-back.jpg`,
    });
  }

  if (items.length === 0) return null;

  return (
    <div
      className={
        items.length === 1
          ? 'grid grid-cols-1 gap-3'
          : items.length === 2
            ? 'grid grid-cols-1 gap-3 sm:grid-cols-2'
            : 'grid grid-cols-1 gap-3 sm:grid-cols-3'
      }
    >
      {items.map((it) => (
        <DownloadCard
          key={it.key}
          src={it.src}
          title={it.title}
          filename={it.filename}
        />
      ))}
    </div>
  );
}

function DownloadCard({
  src,
  title,
  filename,
}: {
  src: string;
  title: string;
  filename: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border bg-muted/30 p-3">
      <div className="grid h-28 w-full place-items-center overflow-hidden rounded-lg bg-white">
        <img
          src={src}
          alt={title}
          className="max-h-full max-w-full object-contain"
          draggable={false}
        />
      </div>
      <p className="text-center text-xs font-medium leading-tight">{title}</p>
      <p className="text-center text-[10px] text-muted-foreground">{filename}</p>
      <Button
        variant="brand"
        size="sm"
        className="mt-1 w-full"
        onClick={() => downloadDataUrl(src, filename)}
      >
        <Download className="size-3.5" /> {filename.split('.').pop()?.toUpperCase()}
      </Button>
    </div>
  );
}
