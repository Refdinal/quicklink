import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { normalizeMeetingInput } from '@/lib/meetings';

export const dynamic = 'force-dynamic';

function parseId(id) {
  const value = Number(id);
  return Number.isInteger(value) && value > 0 ? value : null;
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const meetingId = parseId(id);
    if (!meetingId) {
      return NextResponse.json({ error: 'ID tidak valid.' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const { meeting, error } = normalizeMeetingInput(body);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    const sql = db();
    const rows = await sql`
      UPDATE meetings
      SET title = ${meeting.title},
          type = ${meeting.type},
          location = ${meeting.location},
          link = ${meeting.link},
          notes = ${meeting.notes},
          start_at = ${meeting.start_at},
          end_at = ${meeting.end_at},
          updated_at = now()
      WHERE id = ${meetingId}
      RETURNING id, title, type, location, link, notes, start_at, end_at, created_at, updated_at
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Jadwal tidak ditemukan.' }, { status: 404 });
    }
    return NextResponse.json({ meeting: rows[0] });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id } = await params;
    const meetingId = parseId(id);
    if (!meetingId) {
      return NextResponse.json({ error: 'ID tidak valid.' }, { status: 400 });
    }

    const sql = db();
    await sql`DELETE FROM meetings WHERE id = ${meetingId}`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
