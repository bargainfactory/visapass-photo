'use client';

import { useTranslations } from 'next-intl';
import { FileText, Lock, RefreshCcw } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/legal/terms', icon: FileText, key: 'terms' },
  { href: '/legal/privacy', icon: Lock, key: 'privacy' },
  { href: '/legal/refunds', icon: RefreshCcw, key: 'refunds' },
] as const;

export function LegalSideNav() {
  const t = useTranslations('legal.nav');
  const pathname = usePathname();

  return (
    <nav aria-label="Legal documents" className="lg:sticky lg:top-24 lg:self-start">
      <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        {t('heading')}
      </p>
      <ul className="space-y-1">
        {ITEMS.map(({ href, icon: Icon, key }) => {
          const active = pathname.endsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-brand-500/10 font-semibold text-brand-700 dark:text-brand-300'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="size-4" /> {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
