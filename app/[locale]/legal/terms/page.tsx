import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LegalMarkdown } from '@/components/legal-markdown';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal.terms' });
  return { title: t('title') };
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'legal.terms' });
  return (
    <>
      <h1>{t('title')}</h1>
      <p className="text-sm text-muted-foreground">{t('lastUpdated')}</p>
      <LegalMarkdown source={t('body')} />
    </>
  );
}
