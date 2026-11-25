import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { normalizeMeetingInput } from '@/lib/meetings';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sql = db();
    const meetings = await sql`
      SELECT id, title, type, location, link, notes,
        to_char(start_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS start_at,
        to_char(end_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS end_at,
        created_at, updated_at
      FROM meetings
      ORDER BY start_at ASC
    `;
    return NextResponse.json({ meetings });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { meeting, error } = normalizeMeetingInput(body);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    const sql = db();
    const rows = await sql`
      INSERT INTO meetings (title, type, location, link, notes, start_at, end_at)
      VALUES (
        ${meeting.title},
        ${meeting.type},
        ${meeting.location},
        ${meeting.link},
        ${meeting.notes},
        ${meeting.start_at},
        ${meeting.end_at}
      )
      RETURNING id, title, type, location, link, notes,
        to_char(start_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS start_at,
        to_char(end_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS end_at,
        created_at, updated_at
    `;
    return NextResponse.json({ meeting: rows[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
