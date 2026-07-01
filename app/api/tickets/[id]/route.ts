import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { scrapeAndCache } from '@/lib/scrape-event';

export type { TicketListing } from '@/lib/ticket-sources';

const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const searchParams = new URL(req.url).searchParams;
  const force = searchParams.get('force') === '1';
  const qty = Math.max(1, Math.min(6, parseInt(searchParams.get('qty') ?? '2', 10))) || 2;

  const db = await getDb();

  // Verify event exists
  const event = (await db.execute({ sql: 'SELECT id FROM events WHERE id = ?', args: [id] })).rows[0];
  if (!event) {
    return Response.json({ error: 'Event not found' }, { status: 404 });
  }

  if (!force) {
    const cached = ((await db.execute({
      sql: 'SELECT raw_json, fetched_at FROM ticket_cache WHERE event_id = ? AND qty = ? ORDER BY fetched_at DESC LIMIT 1',
      args: [id, qty],
    })).rows[0] ?? null) as unknown as { raw_json: string; fetched_at: string } | null;

    if (cached) {
      const ageMs = Date.now() - new Date(cached.fetched_at).getTime();
      if (ageMs < CACHE_TTL_MS) {
        return Response.json({
          ...JSON.parse(cached.raw_json),
          from_cache: true,
          fetched_at: cached.fetched_at,
        });
      }
    }
  }

  const { listings, sources, fetched_at } = await scrapeAndCache(id, qty);
  return Response.json({ listings, sources, from_cache: false, fetched_at });
}
