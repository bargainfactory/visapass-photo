import { setRequestLocale } from 'next-intl/server';
import { Hero } from '@/components/hero';
import { JourneyShowcase } from '@/components/journey-showcase';
import { FeatureGrid } from '@/components/feature-grid';
import { CountryShowcase } from '@/components/country-showcase';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <Hero />
      {/* Show the visitor the end-to-end journey right after the pitch — before
          they dig into the engineering features below. */}
      <JourneyShowcase />
      <FeatureGrid />
      <CountryShowcase />
    </>
  );
}
