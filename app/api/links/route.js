import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sql = db();
    const links = await sql`
      SELECT id, title, url, description, created_at, updated_at
      FROM links
      ORDER BY created_at DESC
    `;
    return NextResponse.json({ links });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const title = String(body.title || '').trim();
    let url = String(body.url || '').trim();
    const description = String(body.description || '').trim();

    if (!url) {
      return NextResponse.json({ error: 'URL wajib diisi.' }, { status: 400 });
    }
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }

    const sql = db();
    const rows = await sql`
      INSERT INTO links (title, url, description)
      VALUES (${title || url}, ${url}, ${description || null})
      RETURNING id, title, url, description, created_at, updated_at
    `;
    return NextResponse.json({ link: rows[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
