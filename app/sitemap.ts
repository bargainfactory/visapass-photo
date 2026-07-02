import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { COUNTRIES, countrySlug } from '@/lib/countries';

const SITE = 'https://visapassphoto.com';

// Indexable content routes only (locale-less paths). The editor/checkout/
// success flow is transactional and disallowed in robots.txt, so it's omitted.
// The per-country programmatic-SEO landing pages (/photo/<slug>) are the bulk.
const CONTENT_PATHS = [
  '',
  '/legal/privacy',
  '/legal/terms',
  '/legal/refunds',
  ...COUNTRIES.map((c) => `/photo/${countrySlug(c)}`),
] as const;

/**
 * Enumerates every content route × locale, and attaches the full hreflang
 * cluster (`alternates.languages`) so crawlers see the reciprocal cross-locale
 * relationships. Mirrors buildAlternates() used in per-page metadata.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const path of CONTENT_PATHS) {
    const languages: Record<string, string> = {};
    for (const l of routing.locales) languages[l] = `${SITE}/${l}${path}`;
    languages['x-default'] = `${SITE}/${routing.defaultLocale}${path}`;

    const isHome = path === '';
    const isPhoto = path.startsWith('/photo/');
    for (const locale of routing.locales) {
      entries.push({
        url: `${SITE}/${locale}${path}`,
        changeFrequency: isHome || isPhoto ? 'weekly' : 'monthly',
        priority: isHome ? 1 : isPhoto ? 0.8 : 0.4,
        alternates: { languages },
      });
    }
  }

  return entries;
}
