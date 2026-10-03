/** Sign out. POST /api/auth/logout -> { ok: true } — clears the session cookie. */
import { NextResponse } from 'next/server';
import { SESSION_COOKIE, SESSION_HINT_COOKIE } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  res.cookies.set(SESSION_HINT_COOKIE, '', { httpOnly: false, path: '/', maxAge: 0 });
  return res;
}
