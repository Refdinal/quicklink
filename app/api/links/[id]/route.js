import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const linkId = Number(id);
    if (!Number.isInteger(linkId)) {
      return NextResponse.json({ error: 'ID tidak valid.' }, { status: 400 });
    }

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
      UPDATE links
      SET title = ${title || url},
          url = ${url},
          description = ${description || null},
          updated_at = now()
      WHERE id = ${linkId}
      RETURNING id, title, url, description, created_at, updated_at
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Link tidak ditemukan.' }, { status: 404 });
    }
    return NextResponse.json({ link: rows[0] });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id } = await params;
    const linkId = Number(id);
    if (!Number.isInteger(linkId)) {
      return NextResponse.json({ error: 'ID tidak valid.' }, { status: 400 });
    }

    const sql = db();
    await sql`DELETE FROM links WHERE id = ${linkId}`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
