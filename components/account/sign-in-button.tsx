'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { LogIn, ShieldCheck, UserRound } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

/** Mirror SESSION_HINT_COOKIE / OPERATOR_HINT_COOKIE in lib/auth.ts (kept here to avoid importing server-only code). */
const HINT_COOKIE = 'vp_signed_in';
const OPERATOR_COOKIE = 'vp_operator';

type Mode = 'guest' | 'customer' | 'operator';

function readMode(): Mode {
  if (typeof document === 'undefined') return 'guest';
  const parts = document.cookie.split(';').map((c) => c.trim());
  if (parts.includes(`${OPERATOR_COOKIE}=1`)) return 'operator';
  if (parts.includes(`${HINT_COOKIE}=1`)) return 'customer';
  return 'guest';
}

/**
 * Header sign-in control. Guests see "Sign in" → /account (email form); a
 * signed-in customer sees "My orders" → /account; an operator sees "Operator"
 * → /operator console. State comes from non-httpOnly hint cookies so no request
 * is needed and static pages stay static; first paint is "Sign in", then it
 * flips after mount. The server re-checks the real session on every page.
 */
export function SignInButton({ className }: { className?: string }) {
  const t = useTranslations('nav');
  const [mode, setMode] = React.useState<Mode>('guest');

  React.useEffect(() => {
    setMode(readMode());
    // Re-check when the tab regains focus (e.g. after signing in from an email link in another tab).
    const onFocus = () => setMode(readMode());
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  if (mode === 'operator') {
    return (
      <Button asChild variant="outline" size="sm" className={className}>
        <Link href="/operator" aria-label="Operator console">
          <ShieldCheck className="size-4" />
          <span className="hidden sm:inline">Operator</span>
        </Link>
      </Button>
    );
  }

  const signedIn = mode === 'customer';
  return (
    <Button asChild variant={signedIn ? 'outline' : 'brand'} size="sm" className={className}>
      <Link href="/account" aria-label={signedIn ? t('account') : t('signIn')}>
        {signedIn ? <UserRound className="size-4" /> : <LogIn className="size-4" />}
        <span className="hidden sm:inline">{signedIn ? t('account') : t('signIn')}</span>
      </Link>
    </Button>
  );
}
