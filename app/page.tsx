import { Hero } from '@/components/hero';
import { FeatureGrid } from '@/components/feature-grid';
import { CountryShowcase } from '@/components/country-showcase';

export default function HomePage() {
  return (
    <>
      <Hero />
      <FeatureGrid />
      <CountryShowcase />
    </>
  );
}
