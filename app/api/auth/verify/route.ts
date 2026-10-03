/**
 * Sign-in link landing. GET /api/auth/verify?token=…&locale=en
 *
 * A valid, unexpired login token mints the session cookie and redirects to the
 * localized /account page. Anything else redirects there with ?error=link so
 * the page can offer a fresh link. Route handler (not a page) because only
 * handlers / server actions may set cookies.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { hasLocale } from 'next-intl';
import { routing } from '@/i18n/routing';
import {
  OPERATOR_HINT_COOKIE,
  SESSION_COOKIE,
  SESSION_HINT_COOKIE,
  createSessionToken,
  hintCookieOptions,
  sessionCookieOptions,
  verifyLoginToken,
} from '@/lib/auth';
import { isOperator } from '@/lib/operator';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const requested = req.nextUrl.searchParams.get('locale');
  const locale = requested && hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const account = new URL(`/${locale}/account`, req.nextUrl.origin);

  const rl = rateLimit(`auth-verify:${clientIp(req)}`, 20, 15 * 60_000);
  if (!rl.ok) {
    account.searchParams.set('error', 'too_many');
    return NextResponse.redirect(account, { status: 303 });
  }

  let email: string | null = null;
  try {
    email = verifyLoginToken(req.nextUrl.searchParams.get('token'));
  } catch (e: any) {
    console.error('[auth] verify failed:', e?.message ?? e);
  }
  if (!email) {
    account.searchParams.set('error', 'link');
    return NextResponse.redirect(account, { status: 303 });
  }

  // Operators land on the console; everyone else on their orders.
  const operator = isOperator(email);
  const dest = operator ? new URL(`/${locale}/operator`, req.nextUrl.origin) : account;
  const res = NextResponse.redirect(dest, { status: 303 });
  res.cookies.set(SESSION_COOKIE, createSessionToken(email), sessionCookieOptions());
  res.cookies.set(SESSION_HINT_COOKIE, '1', hintCookieOptions());
  if (operator) {
    res.cookies.set(OPERATOR_HINT_COOKIE, '1', hintCookieOptions());
  } else {
    res.cookies.set(OPERATOR_HINT_COOKIE, '', { httpOnly: false, path: '/', maxAge: 0 });
  }
  return res;
}
