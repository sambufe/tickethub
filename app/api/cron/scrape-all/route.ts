import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { scrapeAndCache } from '@/lib/scrape-event';

export async function GET(req: NextRequest) {
  if (req.headers.get('x-cron-secret') !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = await getDb();
  const events = (await db.execute({
    sql: 'SELECT id FROM events WHERE is_active = 1',
    args: [],
  })).rows as unknown as { id: number }[];

  const scrapeAll = async () => {
    for (let i = 0; i < events.length; i += 3) {
      const batch = events.slice(i, i + 3);
      const results = await Promise.allSettled(batch.map((e) => scrapeAndCache(e.id)));
      for (const r of results) {
        if (r.status === 'rejected') console.error('[cron] scrape failed:', r.reason);
      }
    }
  };

  scrapeAll().catch(console.error);
  return Response.json({ started: true, event_count: events.length });
}
