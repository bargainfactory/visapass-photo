import type { Metadata } from 'next';
import { routing } from './routing';

/**
 * Build a correct, per-path hreflang + canonical block for a given page.
 *
 * Previously the locale layout declared `alternates.languages` mapping every
 * locale to the *homepage* (`/${l}`) and — because it lived in the layout — that
 * map was inherited by `/editor`, `/legal/*`, etc., so e.g. `/en/legal/privacy`
 * wrongly advertised `hreflang="fr" → /fr` (the French homepage). Google drops
 * non-reciprocal hreflang clusters, so the alternates were effectively dead.
 *
 * This helper is called per page with the locale-less path (e.g. ''` for home,
 * `'/legal/privacy'`) so each URL points its alternates at the SAME page in the
 * other languages, plus a self-canonical and an `x-default` on the default
 * locale. Paths are relative — `metadataBase` (set in the root locale layout)
 * resolves them to absolute URLs.
 */
export function buildAlternates(locale: string, path = ''): Metadata['alternates'] {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) languages[l] = `/${l}${path}`;
  languages['x-default'] = `/${routing.defaultLocale}${path}`;
  return {
    canonical: `/${locale}${path}`,
    languages,
  };
}
