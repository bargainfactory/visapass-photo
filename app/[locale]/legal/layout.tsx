import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { LegalSideNav } from '@/components/legal-side-nav';

/**
 * Shared chrome for /legal/* — sidebar with three policy links, a
 * back-to-home link, and a max-width content well. Each policy page
 * supplies its own heading + body inside `children`, fed from the
 * `legal.{terms,privacy,refunds}` namespaces in the i18n catalogs.
 *
 * Policy bodies are now translated for every supported locale via the
 * shared <LegalMarkdown> renderer. The English version remains the
 * authoritative reference for legal interpretation, but the visible
 * text now matches the visitor's language.
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
          {children}
        </article>
      </div>
    </div>
  );
}
