'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type ErrorKey = 'invalid_email' | 'too_many' | 'send_failed' | 'not_configured' | 'link' | null;

/**
 * Email-only sign-in. Posts to /api/auth/request-link; on success shows a
 * "check your inbox" state. In local dev (no email provider) the API returns the
 * link itself, which we render so the flow can be completed without an inbox.
 */
export function LoginForm({ initialError = null }: { initialError?: 'link' | 'too_many' | null }) {
  const t = useTranslations('account');
  const locale = useLocale();
  const [email, setEmail] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [devUrl, setDevUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<ErrorKey>(initialError);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await fetch('/api/auth/request-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, locale }),
      });
      const data = (await r.json().catch(() => ({}))) as { ok?: boolean; devUrl?: string; error?: string };
      if (!r.ok || !data.ok) {
        const code = data.error;
        setError(
          code === 'invalid_email' || code === 'too_many' || code === 'not_configured'
            ? code
            : 'send_failed'
        );
        return;
      }
      setSentTo(email.trim().toLowerCase());
      setDevUrl(data.devUrl ?? null);
    } catch {
      setError('send_failed');
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <div className="space-y-3 rounded-xl border bg-muted/30 p-4 text-sm">
        <p className="flex items-start gap-2">
          <Mail className="mt-0.5 size-4 shrink-0 text-brand-600" />
          <span>{t('linkSent', { email: sentTo })}</span>
        </p>
        {devUrl ? (
          <p className="text-xs text-muted-foreground">
            {t('devLink')}{' '}
            <a href={devUrl} className="break-all font-medium text-brand-600 underline underline-offset-2">
              {t('devLinkCta')}
            </a>
          </p>
        ) : null}
      </div>
    );
  }

  const errorText: Record<Exclude<ErrorKey, null>, string> = {
    invalid_email: t('invalidEmail'),
    too_many: t('tooMany'),
    send_failed: t('sendFailed'),
    not_configured: t('authUnavailable'),
    link: t('linkInvalid'),
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="account-email">{t('emailLabel')}</Label>
        <Input
          id="account-email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          required
          maxLength={254}
          placeholder={t('emailPlaceholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={error === 'invalid_email' || undefined}
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {errorText[error]}
        </p>
      ) : null}
      <Button type="submit" variant="brand" size="lg" className="w-full" disabled={busy || !email}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
        {busy ? t('sending') : t('sendLink')}
      </Button>
    </form>
  );
}
