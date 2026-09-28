import { neon } from '@neondatabase/serverless';

let cached;

export function db() {
  if (!cached) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL belum diset. Isi file .env.local');
    }
    cached = neon(url);
  }
  return cached;
}
