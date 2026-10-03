import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { ArrowLeft, CheckCircle2, ExternalLink, FolderDown, LogIn, Search, ShieldAlert, XCircle } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { RefundButton } from '@/components/operator/refund-button';
import { SignOutButton } from '@/components/account/sign-out-button';
import { getSessionEmail } from '@/lib/auth';
import { configHealth, isOperator, operatorStats } from '@/lib/operator';

/**
 * /operator — back-office console. Internal tool, English only, noindex.
 *
 * Access: the signed-in email must be on OPERATOR_EMAILS. Everything shown is
 * read live from Stripe; the only write is the per-order full refund.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Operator console',
  robots: { index: false, follow: false },
};

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default async function OperatorPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { q } = await searchParams;
  const email = await getSessionEmail();

  if (!email || !isOperator(email)) {
    return (
      <div className="container max-w-xl py-14 md:py-20">
        <Back />
        <Card>
          <CardContent className="space-y-4 p-8 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-amber-500/15 text-amber-600">
              <ShieldAlert className="size-6" />
            </div>
            <h1 className="font-display text-2xl font-semibold">Operator console</h1>
            {email ? (
              <>
                <p className="text-sm text-muted-foreground">
                  You are signed in as <span className="font-medium text-foreground">{email}</span>, which is not on the
                  operator allow-list. Add it to <code className="rounded bg-muted px-1">OPERATOR_EMAILS</code> and reload.
                </p>
                <div className="flex justify-center">
                  <SignOutButton />
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Sign in with an operator email to continue.</p>
                <Button asChild variant="brand">
                  <Link href="/account">
                    <LogIn className="size-4" /> Sign in
                  </Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const health = configHealth();
  let stats: Awaited<ReturnType<typeof operatorStats>> | null = null;
  let loadError: string | null = null;
  try {
    stats = await operatorStats({ windowDays: 30, query: q });
  } catch (e: any) {
    loadError = e?.message ?? 'Stripe lookup failed';
  }
  const fmtDate = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="container max-w-6xl py-10 md:py-14">
      <Back />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Operator console</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Signed in as {email}
            {stats?.livemode === false ? (
              <Badge variant="outline" className="ms-2 border-amber-500/40 text-amber-600">Stripe TEST mode</Badge>
            ) : stats?.livemode ? (
              <Badge variant="outline" className="ms-2 border-emerald-500/40 text-emerald-600">Stripe LIVE</Badge>
            ) : null}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/account">My orders</Link>
          </Button>
          <SignOutButton />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Revenue today" value={usd(stats?.revenue.today ?? 0)} sub={`${stats?.counts.today ?? 0} orders`} />
        <Kpi label="Last 7 days" value={usd(stats?.revenue.last7d ?? 0)} sub={`${stats?.counts.last7d ?? 0} orders`} />
        <Kpi label="Last 30 days" value={usd(stats?.revenue.last30d ?? 0)} sub={`${stats?.counts.last30d ?? 0} orders · ${stats?.counts.refunded ?? 0} refunded`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {/* Orders */}
          <Card>
            <CardContent className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-semibold">Orders · last {stats?.windowDays ?? 30} days</h2>
                <form className="flex items-center gap-2" method="get">
                  <Input name="q" defaultValue={q ?? ''} placeholder="Search email or session id" className="h-9 w-64" />
                  <Button type="submit" variant="outline" size="sm">
                    <Search className="size-4" /> Search
                  </Button>
                </form>
              </div>

              {loadError ? (
                <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
                  Couldn&apos;t load orders from Stripe: {loadError}
                </p>
              ) : !stats?.configured ? (
                <p className="mt-4 text-sm text-muted-foreground">Stripe is not configured in this environment (demo mode) — no orders to show.</p>
              ) : stats.orders.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">No paid orders{q ? ` matching “${q}”` : ''} in this window.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-start text-xs uppercase tracking-wide text-muted-foreground">
                      <tr className="border-b">
                        <th className="py-2 pe-3 text-start font-medium">When</th>
                        <th className="py-2 pe-3 text-start font-medium">Customer</th>
                        <th className="py-2 pe-3 text-start font-medium">Package · document</th>
                        <th className="py-2 pe-3 text-end font-medium">Amount</th>
                        <th className="py-2 pe-3 text-start font-medium">Status</th>
                        <th className="py-2 text-end font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.orders.map((o) => (
                        <tr key={o.sessionId} className="border-b last:border-0 align-top">
                          <td className="whitespace-nowrap py-3 pe-3 text-muted-foreground">{fmtDate.format(o.createdAt)}</td>
                          <td className="py-3 pe-3">
                            <div className="font-medium">{o.email ?? '—'}</div>
                            <div className="font-mono text-[11px] text-muted-foreground">{o.sessionId}</div>
                          </td>
                          <td className="py-3 pe-3">
                            <div>{o.packageName ?? o.packageId ?? '—'}</div>
                            <div className="text-xs text-muted-foreground">{o.documentLabel ?? o.documentId ?? '—'}</div>
                          </td>
                          <td className="whitespace-nowrap py-3 pe-3 text-end tabular-nums">
                            {usd(o.amountCents)}
                            {o.chargedAmountCents != null && o.chargedCurrency ? (
                              <div className="text-xs text-muted-foreground">
                                {new Intl.NumberFormat('en', { style: 'currency', currency: o.chargedCurrency }).format(o.chargedAmountCents / 100)}
                              </div>
                            ) : null}
                          </td>
                          <td className="py-3 pe-3">
                            {o.refunded ? (
                              <Badge variant="outline" className="border-destructive/40 text-destructive">Refunded</Badge>
                            ) : (
                              <Badge variant="outline" className="border-emerald-500/40 text-emerald-600">Paid</Badge>
                            )}
                          </td>
                          <td className="py-3">
                            <div className="flex flex-wrap justify-end gap-1.5">
                              {o.receiptUrl ? (
                                <Button asChild variant="ghost" size="sm">
                                  <a href={o.receiptUrl} target="_blank" rel="noopener noreferrer" title="Receipt">
                                    <ExternalLink className="size-4" />
                                  </a>
                                </Button>
                              ) : null}
                              <Button asChild variant="ghost" size="sm">
                                <a
                                  href={`https://dashboard.stripe.com/${o.livemode ? '' : 'test/'}payments/${o.paymentIntentId ?? ''}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Open in Stripe"
                                >
                                  <FolderDown className="size-4 rotate-180" />
                                </a>
                              </Button>
                              {!o.refunded ? <RefundButton sessionId={o.sessionId} amountLabel={usd(o.amountCents)} /> : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Breakdown */}
          {stats && stats.orders.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardContent className="p-5">
                  <h2 className="font-semibold">By package</h2>
                  <ul className="mt-3 space-y-2 text-sm">
                    {stats.byPackage.map((p) => (
                      <li key={p.id} className="flex items-center justify-between">
                        <span>{p.name}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {p.count} · {usd(p.revenueCents)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <h2 className="font-semibold">Top countries</h2>
                  <ul className="mt-3 space-y-2 text-sm">
                    {stats.byCountry.map((c) => (
                      <li key={c.code} className="flex items-center justify-between">
                        <span>{c.label}</span>
                        <span className="tabular-nums text-muted-foreground">{c.count}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>

        {/* Go-live health */}
        <Card className="h-fit">
          <CardContent className="p-5">
            <h2 className="font-semibold">Go-live checklist</h2>
            <p className="mt-1 text-xs text-muted-foreground">Read from this deployment&apos;s environment.</p>
            <ul className="mt-4 space-y-3">
              {health.map((h) => (
                <li key={h.key} className="flex items-start gap-2 text-sm">
                  {h.ok ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                  )}
                  <div>
                    <div className="font-medium">{h.label}</div>
                    <div className="text-xs text-muted-foreground">{h.detail}</div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-5 grid gap-2">
              <a className="text-xs text-brand-600 underline underline-offset-2" href="https://vercel.com/bargainfactorys-projects/visapass-photo/settings/environment-variables" target="_blank" rel="noopener noreferrer">
                Vercel environment variables
              </a>
              <a className="text-xs text-brand-600 underline underline-offset-2" href="https://dashboard.stripe.com/" target="_blank" rel="noopener noreferrer">
                Stripe dashboard
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Back() {
  return (
    <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
      <ArrowLeft className="size-4 rtl:rotate-180" /> Back to home
    </Link>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 font-display text-3xl font-semibold tabular-nums">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  );
}
