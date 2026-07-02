import { getTranslations } from 'next-intl/server';
import { ArrowRight, BadgeCheck, ImageIcon, Printer, Sparkles } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PRINT_PACKAGES, bundleSavingsCents } from '@/lib/stripe';

const KEY: Record<string, string> = {
  digital: 'digital',
  'print-sheet': 'printSheet',
  bundle: 'bundle',
};
const ICON: Record<string, typeof ImageIcon> = {
  digital: ImageIcon,
  'print-sheet': Printer,
  bundle: Sparkles,
};

export async function PricingSection() {
  const t = await getTranslations('pricing');
  const tPackages = await getTranslations('packages');
  const savings = `$${(bundleSavingsCents() / 100).toFixed(2)}`;

  return (
    <section id="pricing" className="border-t bg-muted/20 py-16">
      <div className="container">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <Badge variant="brand">{t('badge')}</Badge>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl">
            {t('heading')}
          </h2>
          <p className="mt-3 text-muted-foreground">{t('subtitle')}</p>
        </div>

        <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-3">
          {PRINT_PACKAGES.map((pkg) => {
            const Icon = ICON[pkg.id];
            const featured = pkg.id === 'bundle';
            return (
              <Card
                key={pkg.id}
                className={featured ? 'relative border-brand-500 shadow-md shadow-brand-500/15' : 'relative'}
              >
                {featured && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-tr from-brand-600 to-brand-400 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow">
                    {t('save', { amount: savings })}
                  </span>
                )}
                <CardContent className="space-y-2 p-5 text-center">
                  <span className="mx-auto grid size-9 place-items-center rounded-xl bg-brand-500/15 text-brand-600">
                    <Icon className="size-4" />
                  </span>
                  <p className="text-sm font-semibold">{tPackages(`${KEY[pkg.id]}.name`)}</p>
                  <p className="font-display text-3xl font-bold text-brand-500 dark:text-brand-400">
                    ${(pkg.priceCents / 100).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">{tPackages(`${KEY[pkg.id]}.description`)}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-8 flex flex-col items-center gap-3">
          <Button asChild size="lg" variant="brand">
            <Link href="/editor">
              {t('cta')} <ArrowRight className="size-4 rtl:rotate-180" />
            </Link>
          </Button>
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
            <BadgeCheck className="size-4" /> {t('guarantee')}
          </p>
        </div>
      </div>
    </section>
  );
}
