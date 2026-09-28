import { readFileSync, existsSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL belum diset. Isi file .env.local lalu jalankan lagi.');
  process.exit(1);
}

const sql = neon(url);

await sql`
  CREATE TABLE IF NOT EXISTS links (
    id          SERIAL PRIMARY KEY,
    title       TEXT NOT NULL,
    url         TEXT NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

await sql`CREATE INDEX IF NOT EXISTS links_created_at_idx ON links (created_at DESC)`;

console.log('Selesai. Tabel "links" siap digunakan.');
