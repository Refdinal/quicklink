import { NextResponse } from 'next/server';
import { AUTH_COOKIE, makeToken, safeEqual } from '@/lib/auth';

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const expected = await makeToken();
  const cookie = request.cookies.get(AUTH_COOKIE)?.value || '';
  const authed = safeEqual(cookie, expected);

  if (pathname === '/login') {
    if (authed) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  if (!authed) {
    const url = new URL('/login', request.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
