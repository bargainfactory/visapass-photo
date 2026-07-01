'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  BadgeCheck,
  CreditCard,
  FileImage,
  ImageIcon,
  Loader2,
  Lock,
  Printer,
  Shield,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { findDocument } from '@/lib/countries';
import { PRINT_PACKAGES, bundleSavingsCents, type PackageId } from '@/lib/stripe';
import { pickSheetLayout } from '@/lib/compositor';
import { usePhotoStore } from '@/lib/store';
import { makeWatermarkedPreview } from '@/lib/preview';
import { generateDek, storeEncrypted } from '@/lib/secure-delivery';

interface ResultsPanelProps {
  resultDataUrl: string;
  printSheetDataUrl: string | null;
  /** Back-of-sheet certification (Canada). null when the spec doesn't need it. */
  printSheetBackDataUrl?: string | null;
  documentId: string;
}

type PreviewTab = 'digital' | 'print';
type FormatTab = 'jpeg' | 'png';

export function ResultsPanel({
  resultDataUrl,
  printSheetDataUrl,
  printSheetBackDataUrl,
  documentId,
}: ResultsPanelProps) {
  const t = useTranslations('results');
  const tPackages = useTranslations('packages');
  const router = useRouter();
  const docPair = findDocument(documentId);

  const [pendingPkg, setPendingPkg] = React.useState<string | null>(null);
  const [previewTab, setPreviewTab] = React.useState<PreviewTab>('digital');
  const [format, setFormat] = React.useState<FormatTab>('jpeg');
  const [selectedPkg, setSelectedPkg] = React.useState<PackageId>('digital');

  // Watermarked, downscaled previews. The CLEAN full-resolution images
  // (resultDataUrl / printSheetDataUrl / …) are NEVER rendered — only these
  // baked-watermark previews reach the DOM, so a screenshot or "save image"
  // can't lift the unpaid deliverable. The clean images are kept in JS memory
  // (props) solely to encrypt them at checkout. See lib/preview.ts + the
  // payment-gated decryption on /success.
  const [pvDigital, setPvDigital] = React.useState<string | null>(null);
  const [pvPrint, setPvPrint] = React.useState<string | null>(null);
  const [pvBack, setPvBack] = React.useState<string | null>(null);

  const addOrder = usePhotoStore((s) => s.addOrder);
  const currentRenderToken = usePhotoStore((s) => s.currentRenderToken);
  const compliance = usePhotoStore((s) => s.compliance);

  React.useEffect(() => {
    let alive = true;
    makeWatermarkedPreview(resultDataUrl)
      .then((p) => alive && setPvDigital(p))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [resultDataUrl]);

  React.useEffect(() => {
    let alive = true;
    if (printSheetDataUrl) {
      makeWatermarkedPreview(printSheetDataUrl)
        .then((p) => alive && setPvPrint(p))
        .catch(() => {});
    } else {
      setPvPrint(null);
    }
    return () => {
      alive = false;
    };
  }, [printSheetDataUrl]);

  React.useEffect(() => {
    let alive = true;
    if (printSheetBackDataUrl) {
      makeWatermarkedPreview(printSheetBackDataUrl)
        .then((p) => alive && setPvBack(p))
        .catch(() => {});
    } else {
      setPvBack(null);
    }
    return () => {
      alive = false;
    };
  }, [printSheetBackDataUrl]);

  const startCheckout = async (packageId: string) => {
    setPendingPkg(packageId);
    try {
      // 1) Generate the DEK up front so its base64 form can ride in the Stripe
      //    session metadata (the server releases it only after payment clears).
      const { key, b64 } = await generateDek();

      // 2) Create the checkout session, handing the DEK to the server.
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId, documentId, dek: b64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('checkoutError'));

      // 3) Write the small, load-bearing keys FIRST so they can never be lost
      //    to a storage-quota error from a larger write (the old bug: the
      //    clientSecret was written last, after multi-MB image data URLs, and a
      //    QuotaExceededError silently broke /checkout). The deliverables no
      //    longer touch sessionStorage at all — they go to IndexedDB below.
      const sessionId: string = data.sessionId;
      try {
        sessionStorage.setItem('vp-checkout-secret', data.clientSecret);
        sessionStorage.setItem('vp-pending-session', sessionId);
        sessionStorage.setItem('vp-pending-format', format);
        // Demo mode (no Stripe secret key) has no payment to gate, so the
        // success page decrypts with the DEK held client-side.
        if (sessionId.startsWith('cs_demo_')) {
          sessionStorage.setItem('vp-demo-dek', b64);
        } else {
          sessionStorage.removeItem('vp-demo-dek');
        }
      } catch {
        /* sessionStorage unavailable — checkout page handles the missing secret */
      }

      // 4) Encrypt the deliverables with the DEK and persist the CIPHERTEXT in
      //    IndexedDB, keyed by the real Stripe session id. No size cap, and the
      //    clean images are never written to disk in the clear.
      await storeEncrypted(sessionId, documentId, key, {
        digital: resultDataUrl,
        print: printSheetDataUrl,
        printBack: printSheetBackDataUrl,
      });

      addOrder({
        id: sessionId,
        documentId,
        amountCents: data.amountCents,
        status: 'pending',
        createdAt: Date.now(),
        renderToken: currentRenderToken ?? undefined,
      });

      router.push('/checkout');
    } catch (err: any) {
      alert(err?.message ?? t('checkoutError'));
    } finally {
      setPendingPkg(null);
    }
  };

  // Selecting a package also drives the FORMAT + PREVIEW pills so the buyer
  // immediately sees what they're paying for:
  //   · 4×6" Print Sheet → JPEG format + the 4×6" sheet preview
  //   · Digital          → the single digital photo preview
  //   · Bundle           → leave the buyer's current view untouched
  const selectPackage = (id: PackageId) => {
    setSelectedPkg(id);
    if (id === 'print-sheet') {
      setFormat('jpeg');
      setPreviewTab('print');
    } else if (id === 'digital') {
      setPreviewTab('digital');
    }
  };

  if (!docPair) return null;
  const { country, doc } = docPair;

  // Print-sheet metadata — how many photos fit, in which orientation.
  const sheetLayout = pickSheetLayout(doc.widthMm, doc.heightMm, doc.dpi);
  const photosPerSheet = sheetLayout.cols * sheetLayout.rows;
  const hasBackTemplate = !!doc.requiresBackTemplate && !!printSheetBackDataUrl;

  const selectedPkgData = PRINT_PACKAGES.find((p) => p.id === selectedPkg)!;
  const priceLabel = `$${(selectedPkgData.priceCents / 100).toFixed(2)}`;
  const savingsLabel = `$${(bundleSavingsCents() / 100).toFixed(2)}`;

  const pkgKey = (id: string) =>
    id === 'digital' ? 'digital' : id === 'print-sheet' ? 'printSheet' : 'bundle';
  const pkgIcon = (id: string) =>
    id === 'digital' ? ImageIcon : id === 'print-sheet' ? Printer : Sparkles;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      {/* ─────────────── LEFT: country badge + preview + selectors ─────────── */}
      <div className="space-y-4">
        <Badge variant="brand" className="gap-2 px-3 py-1.5 text-sm font-semibold">
          <span className="text-xs uppercase opacity-70">{country.code}</span>
          <span>
            {country.name} — <span className="capitalize">{doc.type.replace('_', ' ')}</span>
          </span>
        </Badge>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <Card className="overflow-hidden">
            {/* PREVIEW HEADER */}
            <div className="px-5 pb-1 pt-4 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                {t('front')}
              </p>
            </div>

            {/* PREVIEW IMAGE — watermarked, downscaled. Never the clean file. */}
            <div className="relative px-6 pb-3" onContextMenu={(e) => e.preventDefault()}>
              <AnimatePresence mode="wait">
                {previewTab === 'digital' && (
                  <motion.div
                    key="dig"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="grid place-items-center select-none p-4"
                    style={{
                      background: `linear-gradient(135deg, ${doc.background}, ${doc.background}cc)`,
                    }}
                  >
                    <PreviewImage src={pvDigital} />
                  </motion.div>
                )}
                {previewTab === 'print' && (
                  <motion.div
                    key="prn"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="select-none bg-[linear-gradient(135deg,#f4f4f5,#e7e7e8)] p-4 dark:bg-[linear-gradient(135deg,#1f2937,#111827)]"
                  >
                    {printSheetDataUrl ? (
                      hasBackTemplate ? (
                        <div className="grid grid-cols-2 items-center gap-4">
                          <div className="grid place-items-center">
                            <PreviewImage src={pvPrint} />
                            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                              {t('frontLabel')}
                            </p>
                          </div>
                          <div className="grid place-items-center">
                            <PreviewImage src={pvBack} />
                            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                              {t('backLabel')}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="grid place-items-center">
                          <PreviewImage src={pvPrint} />
                        </div>
                      )
                    ) : (
                      <div className="grid place-items-center gap-2 py-12 text-sm text-muted-foreground">
                        <Loader2 className="size-5 animate-spin" />
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* PREVIEW CAPTION */}
            <div className="px-5 pb-4 text-center">
              <p className="text-xs text-muted-foreground">
                {previewTab === 'digital' &&
                  t('previewCaptionDigital', {
                    w: doc.widthMm,
                    h: doc.heightMm,
                    dpi: doc.dpi,
                    format: format.toUpperCase(),
                  })}
                {previewTab === 'print' &&
                  (hasBackTemplate
                    ? t('previewCaptionPrintWithBack', {
                        count: photosPerSheet,
                        dpi: doc.dpi,
                        format: format.toUpperCase(),
                      })
                    : t('previewCaptionPrint', {
                        count: photosPerSheet,
                        dpi: doc.dpi,
                        format: format.toUpperCase(),
                      }))}
              </p>
            </div>

            {/* FORMAT + PREVIEW PILL SELECTORS */}
            <div className="grid grid-cols-2 gap-4 border-t bg-muted/30 p-4">
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  {t('format')}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <PillButton active={format === 'jpeg'} onClick={() => setFormat('jpeg')}>
                    <FileImage className="size-4" /> JPEG
                  </PillButton>
                  <PillButton active={format === 'png'} onClick={() => setFormat('png')}>
                    <FileImage className="size-4" /> PNG
                  </PillButton>
                </div>
              </div>
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  {t('preview')}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <PillButton active={previewTab === 'digital'} onClick={() => setPreviewTab('digital')}>
                    <ImageIcon className="size-4" /> {t('tabs.digital')}
                  </PillButton>
                  <PillButton
                    active={previewTab === 'print'}
                    onClick={() => setPreviewTab('print')}
                    disabled={!printSheetDataUrl}
                  >
                    <Printer className="size-4" /> 4×6&quot;
                  </PillButton>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* ─────────────── RIGHT: package picker + big price + CTA ─────────── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}>
        <Card>
          <CardContent className="space-y-5 p-6">
            <div className="text-center">
              <h2 className="font-display text-2xl font-semibold tracking-tight">
                {t('chooseYourPackage')}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('oneTimePayment')}</p>
            </div>

            <div className="space-y-3">
              {PRINT_PACKAGES.map((pkg) => {
                const Icon = pkgIcon(pkg.id);
                const isSelected = selectedPkg === pkg.id;
                return (
                  <PackageCard
                    key={pkg.id}
                    icon={<Icon className="size-4" />}
                    name={tPackages(`${pkgKey(pkg.id)}.name`)}
                    description={tPackages(`${pkgKey(pkg.id)}.description`)}
                    priceLabel={`$${(pkg.priceCents / 100).toFixed(2)}`}
                    selected={isSelected}
                    badge={pkg.id === 'bundle' ? t('saveAmount', { amount: savingsLabel }) : undefined}
                    onSelect={() => selectPackage(pkg.id as PackageId)}
                  />
                );
              })}
            </div>

            {/* BIG PRICE */}
            <div className="pt-1 text-center">
              <p className="font-display text-5xl font-bold text-brand-500 dark:text-brand-400">
                {priceLabel}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{t('secureCheckoutLine')}</p>
            </div>

            {/* COMPLIANCE ECHO — reassurance (or a gentle nudge) at the point of
                purchase, from the on-device pre-check run in the Studio step. */}
            {compliance && (
              <p
                className={cn(
                  'flex items-center justify-center gap-1.5 text-center text-xs',
                  compliance.overall === 'pass' ? 'text-emerald-600' : 'text-amber-600'
                )}
              >
                {compliance.overall === 'pass' ? (
                  <>
                    <ShieldCheck className="size-3.5 shrink-0" />
                    {t('compliancePass', { country: country.name })}
                  </>
                ) : (
                  <>
                    <AlertTriangle className="size-3.5 shrink-0" />
                    {t('complianceReview')}
                  </>
                )}
              </p>
            )}

            {/* BIG CTA */}
            <Button
              size="lg"
              variant="brand"
              className="h-14 w-full text-base"
              disabled={pendingPkg !== null}
              onClick={() => startCheckout(selectedPkg)}
            >
              {pendingPkg === selectedPkg ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <>
                  <CreditCard className="size-5" />
                  {t('payAndDownload', { price: priceLabel })}
                </>
              )}
            </Button>

            {/* ACCEPTANCE GUARANTEE — trust signal at the moment of purchase. */}
            <p className="flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-emerald-600">
              <BadgeCheck className="size-4 shrink-0" /> {t('guarantee')}
            </p>

            {/* CONSENT LINE */}
            <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
              {t.rich('consentLine', {
                terms: (chunks) => (
                  <Link
                    href="/legal/terms"
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    {chunks}
                  </Link>
                ),
                privacy: (chunks) => (
                  <Link
                    href="/legal/privacy"
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    {chunks}
                  </Link>
                ),
                refunds: (chunks) => (
                  <Link
                    href="/legal/refunds"
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </p>

            {/* TRUST FOOTER */}
            <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Shield className="size-3" /> {t('secure')}
              </span>
              <span aria-hidden>·</span>
              <span>Stripe</span>
            </div>

            <p className="flex items-start justify-center gap-1.5 text-center text-[11px] text-amber-600">
              <Lock className="mt-0.5 size-3 shrink-0" /> {t('locked')}
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                            */
/* -------------------------------------------------------------------------- */

function PreviewImage({ src }: { src: string | null }) {
  if (!src) {
    return (
      <div className="grid h-72 w-full place-items-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
      className="pointer-events-none max-h-80 select-none border bg-white shadow-2xl [-webkit-touch-callout:none] [-webkit-user-drag:none]"
    />
  );
}

interface PackageCardProps {
  icon: React.ReactNode;
  name: string;
  description: string;
  priceLabel: string;
  selected: boolean;
  badge?: string;
  onSelect: () => void;
}

function PackageCard({ icon, name, description, priceLabel, selected, badge, onSelect }: PackageCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'relative w-full rounded-xl border bg-card p-4 text-start transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
        selected
          ? 'border-brand-500 ring-2 ring-brand-500/40 shadow-md shadow-brand-500/15'
          : 'border-border hover:border-brand-500/40 hover:bg-accent/40'
      )}
    >
      {badge && (
        <span className="absolute -top-2.5 right-3 rounded-full bg-gradient-to-tr from-brand-600 to-brand-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow">
          {badge}
        </span>
      )}
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors',
            selected ? 'border-brand-500' : 'border-muted-foreground/30'
          )}
          aria-hidden
        >
          {selected && <span className="block size-2.5 rounded-full bg-brand-500" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <span className="text-brand-500 dark:text-brand-400">{icon}</span>
              {name}
            </p>
            <p className="text-sm font-semibold tabular-nums">{priceLabel}</p>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
    </button>
  );
}

interface PillButtonProps {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function PillButton({ active, disabled, onClick, children }: PillButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
        active
          ? 'border-brand-500 bg-brand-500/15 text-brand-600 dark:text-brand-300'
          : 'border-border bg-card text-foreground hover:border-brand-500/40',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      {children}
    </button>
  );
}
