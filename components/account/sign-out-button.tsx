'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { LogOut, Loader2 } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

export function SignOutButton() {
  const t = useTranslations('account');
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      // The page is dynamic — a refresh re-reads the (now cleared) cookie and
      // renders the sign-in form.
      router.refresh();
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={signOut} disabled={busy}>
      {busy ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
      {busy ? t('signingOut') : t('signOut')}
    </Button>
  );
}
