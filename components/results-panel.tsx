'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Loader2, Lock, Mail, ShieldCheck, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, downloadDataUrl } from '@/lib/utils';
import { findDocument } from '@/lib/countries';
import { PRINT_PACKAGES } from '@/lib/stripe';
import { usePhotoStore } from '@/lib/store';

interface ResultsPanelProps {
  resultDataUrl: string;
  printSheetDataUrl: string | null;
  documentId: string;
}

type DeliverableTab = 'digital' | 'print';

export function ResultsPanel({ resultDataUrl, printSheetDataUrl, documentId }: ResultsPanelProps) {
  const t = useTranslations('results');
  const tPackages = useTranslations('packages');
  const docPair = findDocument(documentId);
  const [pendingPkg, setPendingPkg] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<DeliverableTab>('digital');
  const addOrder = usePhotoStore((s) => s.addOrder);
  const orders = usePhotoStore((s) => s.orders);
  const currentRenderToken = usePhotoStore((s) => s.currentRenderToken);

  // An order only unlocks downloads for THIS render — i.e. when the order
  // was created from the same upload session as the photo currently in
  // view. Without the render-token scope, a previous purchase of any
  // US-passport photo would auto-unlock every future US-passport upload,
  // letting users download new photos for free.
  const isPaid = React.useMemo(() => {
    if (!currentRenderToken) return false;
    return orders.some(
      (o) =>
        o.renderToken === currentRenderToken &&
        (o.status === 'paid' || o.status === 'fulfilled' || o.status === 'shipped')
    );
  }, [orders, currentRenderToken]);

  const startCheckout = async (packageId: string) => {
    setPendingPkg(packageId);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId, documentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('checkoutError'));
      addOrder({
        id: data.sessionId,
        documentId,
        amountCents: data.amountCents,
        status: 'pending',
        createdAt: Date.now(),
        // Tag the order with the per-upload token so isPaid can verify
        // payment is for THIS specific render, not just this document type.
        renderToken: currentRenderToken ?? undefined,
      });
      // Stash the rendered result in sessionStorage so /success can offer the
      // download after Stripe redirects back. sessionStorage survives the same-tab
      // redirect-and-return while Zustand's in-memory state does not.
      try {
        sessionStorage.setItem('vp-pending-session', data.sessionId);
        sessionStorage.setItem('vp-pending-doc', documentId);
        sessionStorage.setItem('vp-pending-result', resultDataUrl);
        if (printSheetDataUrl) sessionStorage.setItem('vp-pending-print', printSheetDataUrl);
      } catch {
        /* quota exceeded — non-critical, user can come back via /editor */
      }
      window.location.href = data.url;
    } catch (err: any) {
      alert(err?.message ?? t('checkoutError'));
    } finally {
      setPendingPkg(null);
    }
  };

  if (!docPair) return null;
  const { country, doc } = docPair;

  const handleAction = (which: DeliverableTab) => {
    setTab(which);
    if (isPaid) {
      // Already paid — download immediately.
      if (which === 'digital') {
        downloadDataUrl(resultDataUrl, `${doc.id}.jpg`);
      } else if (printSheetDataUrl) {
        downloadDataUrl(printSheetDataUrl, `${doc.id}-print-sheet.jpg`);
      }
    } else {
      // Unlock both deliverables with a single $5.99 digital package — the
      // physical-print upsells in the right column are separate.
      startCheckout('digital');
    }
  };

  const pkgKey = (id: string) => (id === 'prints-4' ? 'prints4' : id === 'prints-8' ? 'prints8' : 'digital');

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div className="space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="overflow-hidden">
            {/* ── PREVIEW (anti-save + watermark while unpaid) ─────────────── */}
            <div
              className="relative"
              onContextMenu={(e) => e.preventDefault()}
            >
              <AnimatePresence mode="wait">
                {tab === 'digital' ? (
                  <motion.div
                    key="digital-preview"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className="grid place-items-center select-none p-8"
                    style={{
                      background: `linear-gradient(135deg, ${doc.background}, ${doc.background}cc)`,
                    }}
                  >
                    <PreviewImage src={resultDataUrl} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="print-preview"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className="grid place-items-center select-none bg-[linear-gradient(135deg,#f4f4f5,#e7e7e8)] p-8 dark:bg-[linear-gradient(135deg,#1f2937,#111827)]"
                  >
                    {printSheetDataUrl ? (
                      <PreviewImage src={printSheetDataUrl} />
                    ) : (
                      <div className="grid place-items-center gap-2 py-12 text-sm text-muted-foreground">
                        <Loader2 className="size-5 animate-spin" />
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {!isPaid && <PreviewWatermark />}
            </div>

            {/* ── Country + Compliance row ───────────────────────────────── */}
            <CardContent className="flex items-center justify-between gap-3 border-t border-b py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {country.flag} {doc.label}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {t('specsLine', { w: doc.widthMm, h: doc.heightMm, dpi: doc.dpi })}
                </p>
              </div>
              <Badge variant="success" className="shrink-0 gap-1">
                <ShieldCheck className="size-3" /> {t('compliant')}
              </Badge>
            </CardContent>

            {/* ── Deliverable tabs at the bottom (replace the old Download CTA).
                Blue when active. Click → download (paid) or checkout (unpaid). */}
            <div className="grid grid-cols-2 gap-px bg-border">
              <DeliverableTabButton
                active={tab === 'digital'}
                paid={isPaid}
                loading={!isPaid && pendingPkg === 'digital'}
                onClick={() => handleAction('digital')}
              >
                {t('tabs.digital')}
              </DeliverableTabButton>
              <DeliverableTabButton
                active={tab === 'print'}
                paid={isPaid}
                loading={!isPaid && pendingPkg === 'digital'}
                disabled={!printSheetDataUrl}
                onClick={() => handleAction('print')}
              >
                {t('tabs.print')}
              </DeliverableTabButton>
            </div>
          </Card>
        </motion.div>

        <Card>
          <CardContent className="space-y-2 p-5 text-xs text-muted-foreground">
            {!isPaid && (
              <p className="flex items-center gap-1.5 font-medium text-amber-600">
                <Lock className="size-3.5" /> {t('locked')}
              </p>
            )}
            <p className="flex items-center gap-1.5">
              <Mail className="size-3.5" /> {t('noEmail')}
            </p>
            <p className="flex items-center gap-1.5">
              <Truck className="size-3.5" /> {t('shipping')}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3" id="pricing">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">{t('shopHeading')}</h2>
          <p className="text-sm text-muted-foreground">{t('shopSubtitle')}</p>
        </div>
        {PRINT_PACKAGES.map((pkg, idx) => (
          <motion.div
            key={pkg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <Card
              className={
                pkg.id === 'prints-4'
                  ? 'bg-gradient-to-tr from-card via-card to-brand-500/[0.05] ring-1 ring-brand-500/40'
                  : ''
              }
            >
              <CardContent className="flex items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{tPackages(`${pkgKey(pkg.id)}.name`)}</p>
                    {pkg.id === 'prints-4' && <Badge variant="brand">{t('mostPopular')}</Badge>}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {tPackages(`${pkgKey(pkg.id)}.description`)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-display text-xl font-semibold">
                    ${(pkg.priceCents / 100).toFixed(2)}
                  </span>
                  <Button
                    size="sm"
                    variant={pkg.id === 'prints-4' ? 'brand' : 'default'}
                    disabled={pendingPkg !== null}
                    onClick={() => startCheckout(pkg.id)}
                  >
                    {pendingPkg === pkg.id ? <Loader2 className="size-4 animate-spin" /> : t('buy')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/**
 * Wraps the preview image with the strongest set of casual-screenshot
 * deterrents we can apply in-browser: drag/select disabled, right-click
 * suppressed, native callouts blocked. The actual high-resolution file is
 * still gated behind payment so even a determined screenshot only yields
 * the watermarked, on-screen-size render.
 */
function PreviewImage({ src }: { src: string }) {
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
      className="pointer-events-none max-h-80 select-none rounded-lg border bg-white shadow-2xl [-webkit-touch-callout:none] [-webkit-user-drag:none]"
    />
  );
}

/**
 * Tiled diagonal "PREVIEW" watermark — purely a visible deterrent painted
 * over the preview area while the order is unpaid. The downloaded JPEG never
 * carries this overlay because we gate the download itself.
 */
function PreviewWatermark() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <defs>
          <pattern
            id="visapass-wm"
            patternUnits="userSpaceOnUse"
            width="240"
            height="160"
            patternTransform="rotate(-22)"
          >
            <text
              x="0"
              y="44"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
              fontSize="22"
              fontWeight={800}
              letterSpacing={4}
              fill="rgba(255,255,255,0.55)"
              stroke="rgba(0,0,0,0.25)"
              strokeWidth={0.6}
            >
              PREVIEW · PAY TO UNLOCK
            </text>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#visapass-wm)" />
      </svg>
    </div>
  );
}

interface DeliverableTabButtonProps {
  active: boolean;
  paid: boolean;
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function DeliverableTabButton({
  active,
  paid,
  loading,
  disabled,
  onClick,
  children,
}: DeliverableTabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      aria-pressed={active}
      className={cn(
        'relative flex h-14 items-center justify-center gap-2 px-4 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-inset',
        active
          ? // Brand-blue highlight when chosen by the user.
            'bg-gradient-to-br from-brand-600 to-brand-500 text-white shadow-inner shadow-brand-700/40'
          : 'bg-card text-foreground hover:bg-accent',
        (disabled || loading) && 'cursor-not-allowed opacity-60'
      )}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : !paid ? (
        <Lock className={cn('size-4', active ? 'text-white' : 'text-amber-600')} />
      ) : (
        <Download className={cn('size-4', active ? 'text-white' : 'text-muted-foreground')} />
      )}
      <span>{children}</span>
    </button>
  );
}
