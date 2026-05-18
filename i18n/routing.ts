import { defineRouting } from 'next-intl/routing';

export const LOCALES = [
  'en', // English (default)
  'es', // Español — Spain, Mexico, LATAM
  'pt', // Português — Brazil
  'fr', // Français — France, parts of Canada/Switzerland
  'de', // Deutsch — Germany, Austria, Switzerland
  'it', // Italiano — Italy
  'nl', // Nederlands — Netherlands
  'zh', // 中文 — China, Singapore
  'ja', // 日本語 — Japan
  'ko', // 한국어 — Korea
  'ar', // العربية — UAE, Middle East (RTL)
  'hi', // हिन्दी — India
  'tr', // Türkçe — Türkiye
  'ru', // Русский — Russia / CIS
] as const;

export type Locale = (typeof LOCALES)[number];

export const RTL_LOCALES: ReadonlyArray<Locale> = ['ar'];

export const LOCALE_LABELS: Record<Locale, { label: string; native: string; flag: string }> = {
  en: { label: 'English', native: 'English', flag: '🇺🇸' },
  es: { label: 'Spanish', native: 'Español', flag: '🇪🇸' },
  pt: { label: 'Portuguese', native: 'Português', flag: '🇧🇷' },
  fr: { label: 'French', native: 'Français', flag: '🇫🇷' },
  de: { label: 'German', native: 'Deutsch', flag: '🇩🇪' },
  it: { label: 'Italian', native: 'Italiano', flag: '🇮🇹' },
  nl: { label: 'Dutch', native: 'Nederlands', flag: '🇳🇱' },
  zh: { label: 'Chinese', native: '中文', flag: '🇨🇳' },
  ja: { label: 'Japanese', native: '日本語', flag: '🇯🇵' },
  ko: { label: 'Korean', native: '한국어', flag: '🇰🇷' },
  ar: { label: 'Arabic', native: 'العربية', flag: '🇦🇪' },
  hi: { label: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
  tr: { label: 'Turkish', native: 'Türkçe', flag: '🇹🇷' },
  ru: { label: 'Russian', native: 'Русский', flag: '🇷🇺' },
};

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: 'en',
  // Localized prefix strategy — `/` redirects to `/en/…`, every other locale
  // also gets a prefix. We rely on middleware Accept-Language sniffing to pick
  // the best initial locale on first visit.
  localePrefix: 'always',
});
