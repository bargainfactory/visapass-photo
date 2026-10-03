/**
 * Passwordless customer sign-in — stateless, no database. SERVER-ONLY: imports
 * node:crypto and next/headers; never import from a client component.
 *
 * WHY THIS SHAPE. The only identity VisaPass has for a buyer is the email on
 * their Stripe Checkout Session. So "an account" is simply proof of control of
 * that email: we send a one-time sign-in link, and a verified click mints a
 * signed session cookie. Orders are then read straight from Stripe by email
 * (see lib/orders.ts). Nothing is stored server-side — consistent with the
 * app's no-upload, no-DB posture.
 *
 * TOKENS. Both the sign-in link and the session cookie are HMAC-SHA256 signed
 * payloads: `base64url(json).hexSig`. The signature prevents forging another
 * customer's email; expiry bounds replay. Sign-in tokens live 15 minutes and
 * carry a `purpose` so a leaked link can never be presented as a session (or
 * vice versa). Single-use enforcement would need shared state, so we rely on
 * the short TTL + per-IP/per-email rate limits on issuance instead — the same
 * trade-off most magic-link systems make.
 *
 * SECRET. `AUTH_SECRET` must be a strong random value in production; the
 * sign/verify path FAILS CLOSED there rather than falling back to the public
 * dev key (otherwise anyone could mint a session for any email).
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'vp_session';
/**
 * Non-httpOnly companion flag ("1") set/cleared alongside the session cookie.
 * Carries no data and grants nothing — it only lets client components (the
 * header Sign-in button) render "My orders" vs "Sign in" without a request and
 * without forcing statically generated pages to read cookies on the server.
 */
export const SESSION_HINT_COOKIE = 'vp_signed_in';
const LOGIN_TTL_MS = 15 * 60 * 1000; // 15 minutes
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const DEV_FALLBACK = 'dev-only-auth-secret-change-me';

type Purpose = 'login' | 'session';

interface TokenPayload {
  /** Normalised (lower-cased, trimmed) email. */
  e: string;
  /** Expiry, epoch ms. */
  x: number;
  /** Purpose — a login token can never act as a session, and vice versa. */
  p: Purpose;
  /** Random nonce so two links for the same email in the same ms differ. */
  n: string;
}

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 16 && s !== DEV_FALLBACK) return s;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'AUTH_SECRET must be set to a strong (≥16 char) random value in production — refusing to sign sessions with a default key.'
    );
  }
  return s || DEV_FALLBACK;
}

/** True when sign-in is usable in this environment (secret present or non-production). */
export function authConfigured(): boolean {
  try {
    secret();
    return true;
  } catch {
    return false;
  }
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function sign(body: string): string {
  return createHmac('sha256', secret()).update(body).digest('hex');
}

function mint(payload: TokenPayload): string {
  const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'));
  return `${body}.${sign(body)}`;
}

function read(token: string | undefined | null, purpose: Purpose, now = Date.now()): string | null {
  if (!token || token.length > 1024) return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(body);
  if (sig.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(sig, 'utf8'), Buffer.from(expected, 'utf8'))) return null;
  let payload: TokenPayload;
  try {
    payload = JSON.parse(fromB64url(body).toString('utf8')) as TokenPayload;
  } catch {
    return null;
  }
  if (payload.p !== purpose) return null;
  if (typeof payload.x !== 'number' || payload.x < now) return null;
  if (typeof payload.e !== 'string' || !isValidEmail(payload.e)) return null;
  return payload.e;
}

/* ------------------------------ Email helpers ----------------------------- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) return null;
  return email;
}

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_RE.test(email);
}

/* ------------------------------ Login tokens ------------------------------ */

export function createLoginToken(email: string, now = Date.now()): string {
  return mint({ e: email, x: now + LOGIN_TTL_MS, p: 'login', n: b64url(randomBytes(9)) });
}

/** Email proven by a sign-in link, or null if the token is invalid/expired. */
export function verifyLoginToken(token: string | null | undefined, now = Date.now()): string | null {
  return read(token, 'login', now);
}

/* ----------------------------- Session cookies ---------------------------- */

export function createSessionToken(email: string, now = Date.now()): string {
  return mint({ e: email, x: now + SESSION_TTL_MS, p: 'session', n: b64url(randomBytes(6)) });
}

export function readSessionToken(token: string | null | undefined, now = Date.now()): string | null {
  return read(token, 'session', now);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}

/** Options for the readable hint cookie — same lifetime/scope, but NOT httpOnly. */
export function hintCookieOptions() {
  return {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}

/** The signed-in customer's email for this request, or null. Server-only. */
export async function getSessionEmail(): Promise<string | null> {
  try {
    const jar = await cookies();
    return readSessionToken(jar.get(SESSION_COOKIE)?.value);
  } catch {
    return null;
  }
}
