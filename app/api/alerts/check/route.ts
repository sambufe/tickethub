// This endpoint should be called on a schedule — once per hour is ideal,
// timed to run after new ticket cache data is expected (e.g., triggered by
// a cron job or a webhook from the cache-refresh flow). Call via:
//   POST /api/alerts/check
//   Authorization: Bearer <ADMIN_PASSWORD>

import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { sendPriceAlert } from '@/lib/email';
import { TicketListing } from '@/lib/ticket-sources/types';
import { CatalogEvent } from '@/lib/types';

function verifyAdmin(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') ?? '';
  return auth === `Bearer ${process.env.ADMIN_PASSWORD}`;
}

interface PriceAlert {
  id: number;
  event_id: number;
  name: string;
  email: string;
  target_price: number;
  quantity: number;
}

interface CacheRow {
  raw_json: string;
  fetched_at: string;
}

interface CachedPayload {
  listings?: TicketListing[];
}

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  const alerts = db
    .prepare('SELECT * FROM price_alerts WHERE is_active = 1')
    .all() as PriceAlert[];

  let notified = 0;

  for (const alert of alerts) {
    // Use the most recent cache entry for this event+qty combination
    const cacheRow = db
      .prepare(
        'SELECT raw_json, fetched_at FROM ticket_cache WHERE event_id = ? AND qty = ? ORDER BY fetched_at DESC LIMIT 1'
      )
      .get(alert.event_id, alert.quantity) as CacheRow | null;

    if (!cacheRow) continue;

    let payload: CachedPayload;
    try { payload = JSON.parse(cacheRow.raw_json) as CachedPayload; }
    catch { continue; }

    const listings: TicketListing[] = payload.listings ?? [];

    // Find listings at or below target for the requested quantity
    const matches = listings.filter(
      (l) =>
        l.all_in_price <= alert.target_price &&
        (l.quantity === 0 || l.quantity >= alert.quantity)
    ) as (TicketListing & { url: string })[];

    if (matches.length === 0) continue;

    // Look up event title for the email
    const event = db
      .prepare('SELECT title FROM events WHERE id = ?')
      .get(alert.event_id) as Pick<CatalogEvent, 'title'> | null;

    try {
      await sendPriceAlert({
        to: alert.email,
        name: alert.name,
        eventTitle: event?.title ?? 'your event',
        targetPrice: alert.target_price,
        quantity: alert.quantity,
        matches,
      });

      // Deactivate after one notification — user must re-register
      db.prepare(
        'UPDATE price_alerts SET is_active = 0, last_notified_at = CURRENT_TIMESTAMP, notified_price = ? WHERE id = ?'
      ).run(matches[0].all_in_price, alert.id);

      notified++;
    } catch {
      // Email failed — leave alert active so it retries next run
    }
  }

  return Response.json({ checked: alerts.length, notified });
}
