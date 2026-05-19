'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Loader2, Mail, ShieldCheck, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { downloadDataUrl } from '@/lib/utils';
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
  const tCommon = useTranslations('common');
  const tPackages = useTranslations('packages');
  const docPair = findDocument(documentId);
  const [pendingPkg, setPendingPkg] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<DeliverableTab>('digital');
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
            <Tabs value={tab} onValueChange={(v) => setTab(v as DeliverableTab)} className="w-full">
              <TabsList className="grid h-11 w-full grid-cols-2 rounded-none border-b bg-muted/40 p-1">
                <TabsTrigger value="digital" className="text-sm">
                  {t('tabs.digital')}
                </TabsTrigger>
                <TabsTrigger value="print" className="text-sm" disabled={!printSheetDataUrl}>
                  {t('tabs.print')}
                </TabsTrigger>
              </TabsList>

              <AnimatePresence mode="wait">
                <TabsContent value="digital" key="digital" forceMount={tab === 'digital' ? true : undefined} hidden={tab !== 'digital'} className="m-0">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className="grid place-items-center p-8"
                    style={{
                      background: `linear-gradient(135deg, ${doc.background}, ${doc.background}cc)`,
                    }}
                  >
                    <img
                      src={resultDataUrl}
                      alt=""
                      className="max-h-80 rounded-lg border bg-white shadow-2xl"
                    />
                  </motion.div>
                </TabsContent>
                <TabsContent value="print" key="print" forceMount={tab === 'print' ? true : undefined} hidden={tab !== 'print'} className="m-0">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className="grid place-items-center bg-[linear-gradient(135deg,#f4f4f5,#e7e7e8)] p-8"
                  >
                    {printSheetDataUrl ? (
                      <img
                        src={printSheetDataUrl}
                        alt=""
                        className="max-h-80 rounded-lg border bg-white shadow-2xl"
                      />
                    ) : (
                      <div className="grid place-items-center gap-2 py-12 text-sm text-muted-foreground">
                        <Loader2 className="size-5 animate-spin" />
                      </div>
                    )}
                  </motion.div>
                </TabsContent>
              </AnimatePresence>

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
                <Button
                  size="lg"
                  variant="brand"
                  className="w-full"
                  disabled={tab === 'print' && !printSheetDataUrl}
                  onClick={() => {
                    if (tab === 'digital') {
                      downloadDataUrl(resultDataUrl, `${doc.id}.jpg`);
                    } else if (printSheetDataUrl) {
                      downloadDataUrl(printSheetDataUrl, `${doc.id}-print-sheet.jpg`);
                    }
                  }}
                >
                  <Download className="size-4" /> {tCommon('download')}{' '}
                  {tab === 'digital' ? t('tabs.digital') : t('tabs.print')}
                </Button>
              </CardContent>
            </Tabs>
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
