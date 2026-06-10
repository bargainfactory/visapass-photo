import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LegalMarkdown } from '@/components/legal-markdown';
import { buildAlternates } from '@/i18n/metadata';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal.refunds' });
  return { title: t('title'), alternates: buildAlternates(locale, '/legal/refunds') };
}

export default async function RefundsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'legal.refunds' });
  return (
    <>
      <h1>{t('title')}</h1>
      <p className="text-sm text-muted-foreground">{t('lastUpdated')}</p>
      <LegalMarkdown source={t('body')} />
    </>
  );
}
