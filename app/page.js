import { db } from '@/lib/db';
import QuickLinks from '@/components/QuickLinks';

export const dynamic = 'force-dynamic';

export default async function Home() {
  let links = [];
  let error = '';

  try {
    const sql = db();
    links = await sql`
      SELECT id, title, url, description, created_at, updated_at
      FROM links
      ORDER BY created_at DESC
    `;
  } catch (err) {
    error = err.message;
  }

  return (
    <main className="container">
      <QuickLinks initialLinks={links} initialError={error} />
    </main>
  );
}
