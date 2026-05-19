import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { LegalSideNav } from '@/components/legal-side-nav';

/**
 * Shared chrome for /legal/* — sidebar with three policy links on desktop,
 * a back-to-home link, and a max-width content well. Each policy page
 * supplies its own heading + body inside `children`.
 *
 * Legal copy is authored in English only and rendered identically across
 * every locale. Translating binding legal text is risky (mistranslation
 * can change meaning), so we keep one authoritative source. Non-English
 * locales see a small notice at the top of each page directing readers to
 * the English version as the controlling document.
 */
export default async function LegalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tLegal = await getTranslations('legal');

  const isEnglish = locale === 'en';

  return (
    <div className="container py-10 md:py-14">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" /> {tLegal('backToHome')}
      </Link>

      <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
        <LegalSideNav />

        <article className="prose prose-zinc max-w-3xl dark:prose-invert">
          {!isEnglish && (
            <aside className="not-prose mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
              {tLegal('englishOnlyNotice')}
            </aside>
          )}
          {children}
        </article>
      </div>
    </div>
  );
}
