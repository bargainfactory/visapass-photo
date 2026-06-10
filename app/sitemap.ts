import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';

const SITE = 'https://visapassphoto.com';

// Indexable content routes only (locale-less paths). The editor/checkout/
// success flow is transactional and disallowed in robots.txt, so it's omitted.
const CONTENT_PATHS = ['', '/legal/privacy', '/legal/terms', '/legal/refunds'] as const;

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

    for (const locale of routing.locales) {
      entries.push({
        url: `${SITE}/${locale}${path}`,
        changeFrequency: path === '' ? 'weekly' : 'monthly',
        priority: path === '' ? 1 : 0.5,
        alternates: { languages },
      });
    }
  }

  return entries;
}
