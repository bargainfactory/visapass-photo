'use client';

import { useTranslations } from 'next-intl';
import { ShieldCheck } from 'lucide-react';
import { Link } from '@/i18n/navigation';

export function SiteFooter() {
  const t = useTranslations();
  return (
    <footer className="mt-24 border-t bg-background/50">
      <div className="container grid gap-10 py-12 md:grid-cols-5">
        <div className="md:col-span-2">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 text-white shadow">
              <ShieldCheck className="size-4" />
            </span>
            <span className="font-display text-lg">{t('brand.name')}</span>
          </Link>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">{t('footer.description')}</p>
        </div>
        <div>
          <h4 className="text-sm font-semibold">{t('footer.productHeading')}</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/editor" className="hover:text-foreground">
                {t('footer.openEditor')}
              </Link>
            </li>
            <li>
              <Link href="/#countries" className="hover:text-foreground">
                {t('footer.supportedCountries')}
              </Link>
            </li>
            <li>
              <Link href="/#pricing" className="hover:text-foreground">
                {t('footer.pricing')}
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold">{t('footer.trustHeading')}</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>{t('footer.wcag')}</li>
            <li>{t('footer.encrypted')}</li>
            <li>{t('footer.noUpload')}</li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold">{t('footer.legalHeading')}</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/legal/terms" className="hover:text-foreground">
                {t('footer.terms')}
              </Link>
            </li>
            <li>
              <Link href="/legal/privacy" className="hover:text-foreground">
                {t('footer.privacy')}
              </Link>
            </li>
            <li>
              <Link href="/legal/refunds" className="hover:text-foreground">
                {t('footer.refunds')}
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t py-6 text-center text-xs text-muted-foreground">
        {t('brand.copyright', { year: new Date().getFullYear() })}
      </div>
    </footer>
  );
}
