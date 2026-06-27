import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { CatalogEvent } from '@/lib/types';
import { fetchAllListings } from '@/lib/ticket-sources';

export type { TicketListing } from '@/lib/ticket-sources';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const searchParams = new URL(req.url).searchParams;
  const force = searchParams.get('force') === '1';
  const qty = Math.max(1, Math.min(6, parseInt(searchParams.get('qty') ?? '2', 10))) || 2;
  const db = await getDb();

  const event = ((await db.execute({ sql: 'SELECT * FROM events WHERE id = ?', args: [id] })).rows[0] ?? null) as unknown as CatalogEvent | null;
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

  const result = await fetchAllListings(event, qty);

  const payload = {
    listings: result.listings,
    sources: result.sources.map((s) => ({
      platform: s.platform,
      count: s.listings.length,
      error: s.error ?? null,
    })),
  };

  const fetchedAt = new Date().toISOString();

  await db.execute({ sql: 'DELETE FROM ticket_cache WHERE event_id = ? AND qty = ?', args: [id, qty] });
  await db.execute({
    sql: 'INSERT INTO ticket_cache (event_id, qty, raw_json, fetched_at) VALUES (?, ?, ?, ?)',
    args: [id, qty, JSON.stringify(payload), fetchedAt],
  });

  const apiSources = result.sources.filter((s) => s.listings.length > 0);
  if (apiSources.length > 0) {
    await db.execute({
      sql: 'INSERT INTO api_usage (credits_used, event_id, endpoint) VALUES (0, ?, ?)',
      args: [id, apiSources.map((s) => s.platform).join(',')],
    });
  }

  return Response.json({ ...payload, from_cache: false, fetched_at: fetchedAt });
}
