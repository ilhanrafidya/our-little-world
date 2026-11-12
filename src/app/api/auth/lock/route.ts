import { NextResponse } from 'next/server';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/session';

/** "Kunci" aplikasi lagi (logout) di device ini. */
export async function POST() {
  const res = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  res.cookies.set(SESSION_COOKIE, '', sessionCookieOptions(0));
  return res;
}
