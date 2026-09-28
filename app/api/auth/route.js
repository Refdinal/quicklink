import { NextResponse } from 'next/server';
import { AUTH_COOKIE, makeToken } from '@/lib/auth';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const password = typeof body.password === 'string' ? body.password : '';
  const expected = process.env.APP_PASSWORD;

  if (!expected) {
    return NextResponse.json(
      { error: 'APP_PASSWORD belum diset di server.' },
      { status: 500 }
    );
  }

  if (password !== expected) {
    return NextResponse.json({ error: 'Password salah.' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE, await makeToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
}
