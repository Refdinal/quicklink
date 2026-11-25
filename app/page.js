import { db } from '@/lib/db';
import ScheduleApp from '@/components/ScheduleApp';

export const dynamic = 'force-dynamic';

export default async function Home() {
  let meetings = [];
  let error = '';

  try {
    const sql = db();
    meetings = await sql`
      SELECT id, title, type, location, link, notes,
        to_char(start_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS start_at,
        to_char(end_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS end_at,
        created_at, updated_at
      FROM meetings
      ORDER BY start_at ASC
    `;
  } catch (err) {
    error = err.message;
  }

  return (
    <main className="container wide">
      <ScheduleApp initialMeetings={meetings} initialError={error} />
    </main>
  );
}
