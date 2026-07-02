import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowRight, Camera, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { routing } from '@/i18n/routing';
import { buildAlternates } from '@/i18n/metadata';
import { COUNTRIES, countrySlug, findCountryBySlug, type DocumentSpec } from '@/lib/countries';

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    COUNTRIES.map((c) => ({ locale, country: countrySlug(c) }))
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; country: string }>;
}): Promise<Metadata> {
  const { locale, country } = await params;
  const c = findCountryBySlug(country);
  if (!c) return {};
  const t = await getTranslations({ locale, namespace: 'seo' });
  return {
    title: t('title', { country: c.name }),
    description: t('description', { country: c.name }),
    alternates: buildAlternates(locale, `/photo/${country}`),
    openGraph: {
      title: t('title', { country: c.name }),
      description: t('description', { country: c.name }),
      url: `/${locale}/photo/${country}`,
      type: 'website',
    },
  };
}

const inches = (mm: number) => (mm / 25.4).toFixed(1);

function headHeight(doc: DocumentSpec): string {
  if (doc.headHeightMm != null) return `${doc.headHeightMm} mm`;
  return `${Math.round(doc.headHeightRatio[0] * 100)}–${Math.round(doc.headHeightRatio[1] * 100)}%`;
}

export default async function CountryPhotoPage({
  params,
}: {
  params: Promise<{ locale: string; country: string }>;
}) {
  const { locale, country } = await params;
  setRequestLocale(locale);
  const c = findCountryBySlug(country);
  if (!c) notFound();

  const t = await getTranslations('seo');
  const name = c.name;

  const faq = [
    { q: t('faqQ1', { country: name }), a: t('faqA1', { country: name }) },
    { q: t('faqQ2'), a: t('faqA2') },
  ];

  // Structured data — BreadcrumbList + FAQPage. Content is server-controlled
  // (country data + localized copy); escape `<` defensively for the inline tag.
  const site = 'https://visapassphoto.com';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${site}/${locale}` },
          {
            '@type': 'ListItem',
            position: 2,
            name: t('title', { country: name }),
            item: `${site}/${locale}/photo/${country}`,
          },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: faq.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  };

  return (
    <div className="container max-w-4xl py-10 md:py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />

      {/* Hero */}
      <div className="space-y-4">
        <Badge variant="brand" className="gap-2 px-3 py-1.5 text-sm font-semibold">
          <span className="text-lg leading-none">{c.flag}</span>
          <span className="uppercase tracking-wide">{c.code}</span>
        </Badge>
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-5xl">
          {t('title', { country: name })}
        </h1>
        <p className="max-w-2xl text-muted-foreground md:text-lg">{t('intro', { country: name })}</p>
        <div className="flex flex-wrap gap-3 pt-1">
          <Button asChild size="lg" variant="brand">
            <Link href="/editor">
              <Camera className="size-4" /> {t('cta', { country: name })}
              <ArrowRight className="size-4 rtl:rotate-180" />
            </Link>
          </Button>
          <span className="inline-flex items-center gap-1.5 self-center text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-emerald-600" /> {t('guarantee')}
          </span>
        </div>
      </div>

      {/* Requirements */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">{t('requirements', { country: name })}</h2>
        <div className="mt-4 space-y-4">
          {c.documents.map((doc) => (
            <Card key={doc.id}>
              <CardContent className="p-5">
                <p className="mb-3 text-sm font-semibold capitalize">
                  {doc.label} · {doc.type.replace('_', ' ')}
                </p>
                <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  <SpecRow label={t('labels.size')} value={`${doc.widthMm}×${doc.heightMm} mm (${inches(doc.widthMm)}×${inches(doc.heightMm)} in)`} />
                  <SpecRow label={t('labels.head')} value={headHeight(doc)} />
                  <SpecRow
                    label={t('labels.background')}
                    value={
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="inline-block size-3 rounded-full border"
                          style={{ background: doc.background }}
                        />
                        {doc.background}
                      </span>
                    }
                  />
                  <SpecRow label={t('labels.glasses')} value={t(`glasses.${doc.glasses}`)} />
                  <SpecRow label={t('labels.expression')} value={t(`expression.${doc.expression}`)} />
                  <SpecRow label={t('labels.dpi')} value={`${doc.dpi} DPI`} />
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">{t('howTo')}</h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-3">
          {[t('step1'), t('step2', { country: name }), t('step3')].map((step, i) => (
            <li key={i} className="rounded-xl border bg-muted/30 p-4">
              <span className="mb-2 inline-grid size-7 place-items-center rounded-full bg-brand-500/15 text-sm font-bold text-brand-600">
                {i + 1}
              </span>
              <p className="text-sm text-muted-foreground">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* FAQ */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">{t('faqHeading')}</h2>
        <div className="mt-4 space-y-3">
          {faq.map((f, i) => (
            <div key={i} className="rounded-xl border p-4">
              <p className="flex items-start gap-2 font-semibold">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-500" /> {f.q}
              </p>
              <p className="ms-6 mt-1 text-sm text-muted-foreground">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA + other countries */}
      <section className="mt-12 rounded-2xl border bg-gradient-to-tr from-brand-600/10 to-brand-400/5 p-6 text-center">
        <Sparkles className="mx-auto size-6 text-brand-500" />
        <p className="mt-2 font-display text-xl font-semibold">{t('cta', { country: name })}</p>
        <div className="mt-4">
          <Button asChild size="lg" variant="brand">
            <Link href="/editor">
              <Camera className="size-4" /> {t('cta', { country: name })}
            </Link>
          </Button>
        </div>
      </section>

      <div className="mt-10">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{t('browseAll')}</h2>
        <div className="flex flex-wrap gap-2">
          {COUNTRIES.filter((o) => o.code !== c.code).map((o) => (
            <Link
              key={o.code}
              href={`/photo/${countrySlug(o)}`}
              className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs transition-colors hover:border-brand-500/40 hover:text-brand-600"
            >
              <span>{o.flag}</span> {o.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b py-1.5 last:border-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}
