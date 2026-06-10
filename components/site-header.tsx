'use client';

import { useTranslations } from 'next-intl';
import { ShieldCheck } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';
import { COUNTRIES } from '@/lib/countries';

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

      {/* International flag band — quick visual cue that the site supports
          22+ country specs. The flag row is rendered twice end-to-end and
          the wrapper translates by -50% across one animation cycle, so the
          marquee loops seamlessly without a visible "snap" reset. Mask
          fades the edges into the header background. Respects users with
          prefers-reduced-motion via `motion-reduce:animate-none`. */}
      <div
        aria-label="Supported countries"
        className="relative border-t border-border/40 bg-background/40 [mask-image:linear-gradient(to_right,transparent,#000_10%,#000_90%,transparent)]"
      >
        <div className="flex h-7 items-center overflow-hidden">
          <div className="flex shrink-0 animate-marquee items-center gap-3 whitespace-nowrap px-4 motion-reduce:animate-none">
            {[...COUNTRIES, ...COUNTRIES].map((c, i) => (
              <span
                key={`${c.code}-${i}`}
                title={c.name}
                aria-hidden={i >= COUNTRIES.length}
                className="text-base leading-none opacity-80"
              >
                {c.flag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
