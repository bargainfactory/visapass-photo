'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { LogIn, UserRound } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

/** Mirrors SESSION_HINT_COOKIE in lib/auth.ts (kept here to avoid importing server-only code). */
const HINT_COOKIE = 'vp_signed_in';

function readHint(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some((c) => c.trim() === `${HINT_COOKIE}=1`);
}

/**
 * Header sign-in control. Guests see "Sign in"; a signed-in customer sees
 * "My orders". Both go to /account, which renders the right view server-side.
 * State comes from the non-httpOnly hint cookie so no request is needed and
 * static pages stay static; the first paint is "Sign in" and flips after mount.
 */
export function SignInButton({ className }: { className?: string }) {
  const t = useTranslations('nav');
  const [signedIn, setSignedIn] = React.useState(false);

  React.useEffect(() => {
    setSignedIn(readHint());
    // Re-check when the tab regains focus (e.g. after signing in from an email link in another tab).
    const onFocus = () => setSignedIn(readHint());
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  return (
    <Button asChild variant={signedIn ? 'outline' : 'brand'} size="sm" className={className}>
      <Link href="/account" aria-label={signedIn ? t('account') : t('signIn')}>
        {signedIn ? <UserRound className="size-4" /> : <LogIn className="size-4" />}
        <span className="hidden sm:inline">{signedIn ? t('account') : t('signIn')}</span>
      </Link>
    </Button>
  );
}
