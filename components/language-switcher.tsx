'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, Languages } from 'lucide-react';
import { LOCALES, LOCALE_LABELS, type Locale } from '@/i18n/routing';
import { usePathname, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export function LanguageSwitcher() {
  const t = useTranslations('languageSwitcher');
  const currentLocale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const current = LOCALE_LABELS[currentLocale as Locale] ?? LOCALE_LABELS.en;

  const change = (locale: Locale) => {
    setOpen(false);
    // next-intl's locale-aware router rewrites the URL prefix automatically.
    router.replace(pathname, { locale });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          aria-label={t('select')}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <Languages className="size-4" aria-hidden />
          <span className="hidden text-base leading-none sm:inline">{current.flag}</span>
          <span className="hidden text-xs font-semibold uppercase tracking-wider sm:inline">
            {currentLocale}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-1">
        <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t('label')}
        </p>
        <ScrollArea className="h-72">
          <ul role="listbox" aria-label={t('select')}>
            {LOCALES.map((l) => {
              const meta = LOCALE_LABELS[l];
              const active = l === currentLocale;
              return (
                <li key={l}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => change(l)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                      active ? 'bg-brand-500/10' : 'hover:bg-accent'
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm">
                      <span className="text-base leading-none">{meta.flag}</span>
                      <span className="font-medium">{meta.native}</span>
                      <span className="text-xs text-muted-foreground">({l})</span>
                    </span>
                    {active && <Check className="size-4 text-brand-600" aria-hidden />}
                  </button>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
