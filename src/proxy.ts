import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';

/**
 * Passcode gate (Next.js 16 `proxy.ts`, pengganti middleware.ts).
 * Lapisan pertama: belum unlock → diarahkan ke /unlock.
 * API tidak lewat sini; setiap route handler memeriksa sesi sendiri (requireApiSession).
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const authed = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === '/unlock') {
    // Sudah unlock tapi buka /unlock lagi → langsung ke peta
    if (authed) return NextResponse.redirect(new URL('/', request.url));
    return NextResponse.next();
  }

  if (!authed) {
    const url = request.nextUrl.clone();
    url.pathname = '/unlock';
    url.search = '';
    if (pathname !== '/') url.searchParams.set('next', pathname + search);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Semua halaman kecuali API, aset Next, dan file statis publik
  matcher: ['/((?!api/|_next/static|_next/image|favicon.ico|icons/|textures/|manifest.webmanifest|robots.txt).*)'],
};
