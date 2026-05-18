'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Download, Loader2, Mail, ShieldCheck, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { downloadDataUrl } from '@/lib/utils';
import { findDocument } from '@/lib/countries';
import { PRINT_PACKAGES } from '@/lib/stripe';
import { usePhotoStore } from '@/lib/store';

interface ResultsPanelProps {
  resultDataUrl: string;
  printSheetDataUrl: string | null;
  documentId: string;
}

export function ResultsPanel({ resultDataUrl, printSheetDataUrl, documentId }: ResultsPanelProps) {
  const t = useTranslations('results');
  const tPackages = useTranslations('packages');
  const docPair = findDocument(documentId);
  const [pendingPkg, setPendingPkg] = React.useState<string | null>(null);
  const addOrder = usePhotoStore((s) => s.addOrder);

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
      });
      window.location.href = data.url;
    } catch (err: any) {
      alert(err?.message ?? t('checkoutError'));
    } finally {
      setPendingPkg(null);
    }
  };

  if (!docPair) return null;
  const { country, doc } = docPair;

  const pkgKey = (id: string) => (id === 'prints-4' ? 'prints4' : id === 'prints-8' ? 'prints8' : 'digital');

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div className="space-y-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <Card className="overflow-hidden">
            <div
              className="grid place-items-center p-8"
              style={{ background: `linear-gradient(135deg, ${doc.background}, ${doc.background}cc)` }}
            >
              <img
                src={resultDataUrl}
                alt=""
                className="max-h-80 rounded-lg border bg-white shadow-2xl"
              />
            </div>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{country.flag} {doc.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('specsLine', { w: doc.widthMm, h: doc.heightMm, dpi: doc.dpi })}
                  </p>
                </div>
                <Badge variant="success" className="gap-1">
                  <ShieldCheck className="size-3" /> {t('compliant')}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="outline" onClick={() => downloadDataUrl(resultDataUrl, `${doc.id}.jpg`)}>
                  <Download className="size-4" /> {t('downloadPhoto')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!printSheetDataUrl}
                  onClick={() =>
                    printSheetDataUrl && downloadDataUrl(printSheetDataUrl, `${doc.id}-print-sheet.jpg`)
                  }
                >
                  <Download className="size-4" /> {t('downloadSheet')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <Card>
          <CardContent className="space-y-2 p-5 text-xs text-muted-foreground">
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
                  ? 'ring-1 ring-brand-500/40 bg-gradient-to-tr from-card via-card to-brand-500/[0.05]'
                  : ''
              }
            >
              <CardContent className="flex items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{tPackages(`${pkgKey(pkg.id)}.name`)}</p>
                    {pkg.id === 'prints-4' && <Badge variant="brand">{t('mostPopular')}</Badge>}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{tPackages(`${pkgKey(pkg.id)}.description`)}</p>
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
