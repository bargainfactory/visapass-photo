'use client';

import { useTranslations } from 'next-intl';
import { ShieldCheck } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Badge } from '@/components/ui/badge';

export function SiteHeader() {
  const t = useTranslations();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/60 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between gap-3">
        <Link href="/" className="group flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 text-white shadow-lg shadow-brand-500/30 transition-transform group-hover:rotate-3">
            <ShieldCheck className="size-4" strokeWidth={2.5} />
          </span>
          <span className="font-display text-lg">{t('brand.name')}</span>
          <Badge variant="brand" className="ms-2 hidden sm:inline-flex">
            {t('brand.tagline')}
          </Badge>
        </Link>
        <nav className="flex items-center gap-1.5">
          <Link
            href="/#countries"
            className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            {t('nav.countries')}
          </Link>
          <Link
            href="/#pricing"
            className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            {t('nav.pricing')}
          </Link>
          <Link
            href="/editor"
            className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            {t('nav.editor')}
          </Link>
          <LanguageSwitcher />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
