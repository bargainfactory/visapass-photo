import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Hero } from '@/components/hero';
import { FeatureGrid } from '@/components/feature-grid';
import { CountryShowcase } from '@/components/country-showcase';
import { PricingSection } from '@/components/pricing-section';
import { buildAlternates } from '@/i18n/metadata';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: buildAlternates(locale, '') };
}

// JourneyShowcase has been folded into <Hero/> as the hero's background image,
// so the standalone band is no longer rendered. The component file is kept in
// the repo for re-use if a future section wants the same step-pill treatment.
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <Hero />
      <FeatureGrid />
      <PricingSection />
      <CountryShowcase />
    </>
  );
}
