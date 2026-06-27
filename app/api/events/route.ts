import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { CatalogEvent } from '@/lib/types';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim() || '';

  const db = await getDb();

  const events = q
    ? ((await db.execute({
        sql: `SELECT * FROM events
              WHERE is_active = 1
                AND (title LIKE ? OR artist LIKE ? OR venue LIKE ? OR city LIKE ?)
              ORDER BY event_date ASC`,
        args: [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`],
      })).rows as unknown as CatalogEvent[])
    : ((await db.execute({
        sql: `SELECT * FROM events WHERE is_active = 1 ORDER BY event_date ASC`,
        args: [],
      })).rows as unknown as CatalogEvent[]);

  return Response.json({ events });
}
