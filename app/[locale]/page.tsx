import { setRequestLocale } from 'next-intl/server';
import { Hero } from '@/components/hero';
import { FeatureGrid } from '@/components/feature-grid';
import { CountryShowcase } from '@/components/country-showcase';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <Hero />
      <FeatureGrid />
      <CountryShowcase />
    </>
  );
}
