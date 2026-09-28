export const AUTH_COOKIE = 'ql_auth';

const encoder = new TextEncoder();

async function sha256Hex(input) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function makeToken() {
  const password = process.env.APP_PASSWORD || '';
  const secret = process.env.AUTH_SECRET || 'quick-link-default-secret';
  return sha256Hex(`${password}:${secret}`);
}

export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
