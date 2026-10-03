/**
 * Request a passwordless sign-in link.
 *
 * POST { email, locale } -> { ok: true }                      (link emailed)
 *                         -> { ok: true, devUrl }              (email not configured, non-production only)
 *                         -> { error } 400 / 429 / 503
 *
 * Accounts are optional — checkout is guest-only and never calls this. The link
 * just lets a buyer see past orders tied to their checkout email. We respond
 * identically whether or not the email has orders (no enumeration), and rate
 * limit per IP and per email so the endpoint can't be used to spam inboxes.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from '@/i18n/routing';
import { authConfigured, createLoginToken, normalizeEmail } from '@/lib/auth';
import { emailConfigured, sendLoginEmail } from '@/lib/email';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function siteOrigin(req: NextRequest): string {
  // Production: use the configured site URL so a spoofed Host header can never
  // steer a sign-in link to an attacker's domain. Development: use the request
  // origin so the link works on whatever port `next dev` actually picked.
  if (process.env.NODE_ENV === 'production') {
    const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '');
    if (configured) return configured;
  }
  return req.nextUrl.origin;
}

export async function POST(req: NextRequest) {
  const ipLimit = rateLimit(`auth-link:ip:${clientIp(req)}`, 8, 15 * 60_000);
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: 'too_many' },
      { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfter) } }
    );
  }

  let body: { email?: unknown; locale?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  if (!email) return NextResponse.json({ error: 'invalid_email' }, { status: 400 });

  const emailLimit = rateLimit(`auth-link:email:${email}`, 4, 15 * 60_000);
  if (!emailLimit.ok) {
    return NextResponse.json(
      { error: 'too_many' },
      { status: 429, headers: { 'Retry-After': String(emailLimit.retryAfter) } }
    );
  }

  if (!authConfigured()) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  const locale =
    typeof body.locale === 'string' && hasLocale(routing.locales, body.locale)
      ? body.locale
      : routing.defaultLocale;

  const token = createLoginToken(email);
  const url = `${siteOrigin(req)}/api/auth/verify?token=${encodeURIComponent(token)}&locale=${locale}`;

  if (!emailConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[auth] RESEND_API_KEY / EMAIL_FROM not set — cannot send sign-in links');
      return NextResponse.json({ error: 'not_configured' }, { status: 503 });
    }
    // Local development: surface the link so the flow can be exercised end-to-end.
    console.log(`[auth] dev sign-in link for ${email}: ${url}`);
    return NextResponse.json({ ok: true, devUrl: url });
  }

  try {
    const t = await getTranslations({ locale, namespace: 'account' });
    const tBrand = await getTranslations({ locale, namespace: 'brand' });
    await sendLoginEmail({
      to: email,
      url,
      brand: tBrand('name'),
      subject: t('emailSubject', { brand: tBrand('name') }),
      intro: t('emailIntro'),
      cta: t('emailCta'),
      footnote: t('emailFootnote'),
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[auth] send failed:', e?.message ?? e);
    return NextResponse.json({ error: 'send_failed' }, { status: 502 });
  }
}
