import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowLeft, ExternalLink, FolderDown, Mail, ShieldCheck } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LoginForm } from '@/components/account/login-form';
import { SignOutButton } from '@/components/account/sign-out-button';
import { getSessionEmail } from '@/lib/auth';
import { listOrdersForEmail, type CustomerOrder } from '@/lib/orders';

/**
 * /account — optional order history for returning buyers.
 *
 * Accounts are NOT required to buy: checkout is guest-only. This page exists so
 * a customer can later find their orders (receipt, what they bought, and a way
 * back to the download page) by proving control of their checkout email via a
 * one-time sign-in link. Dynamic because it reads the session cookie.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { error } = await searchParams;
  const t = await getTranslations('account');
  const email = await getSessionEmail();

  if (!email) {
    return (
      <div className="container max-w-xl py-14 md:py-20">
        <BackLink label={t('backToHome')} />
        <Card>
          <CardContent className="space-y-6 p-8">
            <div className="space-y-2 text-center">
              <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-500/15 text-brand-600">
                <Mail className="size-6" />
              </div>
              <h1 className="font-display text-3xl font-semibold">{t('title')}</h1>
              <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
            </div>
            <LoginForm initialError={error === 'link' ? 'link' : error === 'too_many' ? 'too_many' : null} />
            <p className="flex items-start gap-2 rounded-xl border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
              <span>{t('guestNote')}</span>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  let result: Awaited<ReturnType<typeof listOrdersForEmail>> | null = null;
  let loadFailed = false;
  try {
    result = await listOrdersForEmail(email);
  } catch (e: any) {
    console.error('[account] orders lookup failed:', e?.message ?? e);
    loadFailed = true;
  }

  const fmtDate = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  const fmtMoney = (cents: number, currency: string) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);

  return (
    <div className="container max-w-2xl py-14 md:py-20">
      <BackLink label={t('backToHome')} />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('signedInAs', { email })}</p>
        </div>
        <SignOutButton />
      </div>

      {loadFailed ? (
        <Notice>{t('loadFailed')}</Notice>
      ) : result && !result.configured ? (
        <Notice>{t('notConfigured')}</Notice>
      ) : result && result.orders.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 p-8 text-center">
            <p className="font-medium">{t('noOrders')}</p>
            <p className="text-sm text-muted-foreground">{t('noOrdersHint')}</p>
            <Button asChild variant="brand" className="mt-2">
              <Link href="/editor">{t('startPhoto')}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : result ? (
        <div className="space-y-3">
          {result.orders.map((o) => (
            <OrderRow
              key={o.sessionId}
              order={o}
              date={fmtDate.format(o.createdAt)}
              amount={fmtMoney(o.amountCents, o.currency)}
              charged={
                o.chargedAmountCents != null && o.chargedCurrency && o.chargedCurrency !== o.currency
                  ? fmtMoney(o.chargedAmountCents, o.chargedCurrency)
                  : null
              }
              labels={{ paid: t('paid'), reopen: t('reopenDownloads'), receipt: t('receipt') }}
            />
          ))}
        </div>
      ) : null}

      <p className="mt-6 flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
        <span>{t('deviceNote')}</span>
      </p>
    </div>
  );
}

function BackLink({ label }: { label: string }) {
  return (
    <Link
      href="/"
      className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4 rtl:rotate-180" /> {label}
    </Link>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
      {children}
    </p>
  );
}

function OrderRow({
  order,
  date,
  amount,
  charged,
  labels,
}: {
  order: CustomerOrder;
  date: string;
  /** Listed USD price. */
  amount: string;
  /** Local-currency amount the card was charged (Adaptive Pricing), or null. */
  charged: string | null;
  labels: { paid: string; reopen: string; receipt: string };
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{order.packageName ?? order.packageId ?? '—'}</span>
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-600">
              {labels.paid}
            </Badge>
          </div>
          {order.documentLabel ? (
            <p className="text-sm text-muted-foreground">{order.documentLabel}</p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {date} · {amount}
            {charged ? ` (${charged})` : ''}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {order.receiptUrl ? (
            <Button asChild variant="outline" size="sm">
              <a href={order.receiptUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" /> {labels.receipt}
              </a>
            </Button>
          ) : null}
          <Button asChild variant="brand" size="sm">
            <Link href={`/success?session_id=${encodeURIComponent(order.sessionId)}`}>
              <FolderDown className="size-4" /> {labels.reopen}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
