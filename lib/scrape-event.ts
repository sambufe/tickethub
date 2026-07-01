import { getDb } from '@/lib/db';
import { CatalogEvent } from '@/lib/types';
import { fetchAllListings } from '@/lib/ticket-sources';
import type { TicketListing } from '@/lib/ticket-sources';

export interface ScrapePayload {
  listings: TicketListing[];
  sources: { platform: string; count: number; error: string | null }[];
  fetched_at: string;
}

export async function scrapeAndCache(eventId: number | string, qty = 2): Promise<ScrapePayload> {
  const db = await getDb();

  const event = ((await db.execute({
    sql: 'SELECT * FROM events WHERE id = ?',
    args: [eventId],
  })).rows[0] ?? null) as unknown as CatalogEvent | null;

  if (!event) throw new Error(`Event ${eventId} not found`);

  const result = await fetchAllListings(event, qty);

  const fetched_at = new Date().toISOString();
  const payload: ScrapePayload = {
    listings: result.listings,
    sources: result.sources.map((s) => ({
      platform: s.platform,
      count: s.listings.length,
      error: s.error ?? null,
    })),
    fetched_at,
  };

  // raw_json excludes fetched_at — it lives in the ticket_cache column
  const raw_json = JSON.stringify({ listings: payload.listings, sources: payload.sources });

  await db.execute({
    sql: 'DELETE FROM ticket_cache WHERE event_id = ? AND qty = ?',
    args: [eventId, qty],
  });
  await db.execute({
    sql: 'INSERT INTO ticket_cache (event_id, qty, raw_json, fetched_at) VALUES (?, ?, ?, ?)',
    args: [eventId, qty, raw_json, fetched_at],
  });

  const activeSources = result.sources.filter((s) => s.listings.length > 0);
  if (activeSources.length > 0) {
    await db.execute({
      sql: 'INSERT INTO api_usage (credits_used, event_id, endpoint) VALUES (0, ?, ?)',
      args: [eventId, activeSources.map((s) => s.platform).join(',')],
    });
  }

  return payload;
}
