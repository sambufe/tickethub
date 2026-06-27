// Called on a schedule — once per hour after ticket cache refreshes.
//   POST /api/alerts/check
//   Authorization: Bearer <ADMIN_PASSWORD>

import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { sendPriceAlert, PriceMatch } from '@/lib/email';
import { TicketListing } from '@/lib/ticket-sources/types';

function verifyAdmin(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') ?? '';
  return auth === `Bearer ${process.env.ADMIN_PASSWORD}`;
}

interface PriceAlert {
  id: number;
  event_id: number | null;
  event_ids: string | null;
  name: string;
  email: string;
  target_price: number;
  quantity: number;
}

interface EventRow {
  id: number;
  title: string;
  event_date: string | null;
  venue: string | null;
}

interface CacheRow {
  raw_json: string;
}

interface CachedPayload {
  listings?: TicketListing[];
}

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  const alerts = db
    .prepare('SELECT id, event_id, event_ids, name, email, target_price, quantity FROM price_alerts WHERE is_active = 1')
    .all() as PriceAlert[];

  let notified = 0;

  for (const alert of alerts) {
    // Resolve the list of event IDs this alert covers
    let eventIdList: number[] = [];
    if (alert.event_ids) {
      try { eventIdList = JSON.parse(alert.event_ids) as number[]; } catch {}
    }
    if (eventIdList.length === 0 && alert.event_id != null) {
      eventIdList = [alert.event_id];
    }
    if (eventIdList.length === 0) continue; // general alert with no events — skip

    const allMatches: PriceMatch[] = [];

    for (const eid of eventIdList) {
      const event = db
        .prepare('SELECT id, title, event_date, venue FROM events WHERE id = ?')
        .get(eid) as EventRow | null;
      if (!event) continue;

      const cacheRow = db
        .prepare(
          'SELECT raw_json FROM ticket_cache WHERE event_id = ? AND qty = ? ORDER BY fetched_at DESC LIMIT 1'
        )
        .get(eid, alert.quantity) as CacheRow | null;
      if (!cacheRow) continue;

      let payload: CachedPayload;
      try { payload = JSON.parse(cacheRow.raw_json) as CachedPayload; }
      catch { continue; }

      const listings: TicketListing[] = payload.listings ?? [];

      const eventMatches = listings.filter(
        (l) =>
          l.all_in_price <= alert.target_price &&
          (l.quantity === 0 || l.quantity >= alert.quantity) &&
          l.url
      );

      for (const l of eventMatches) {
        allMatches.push({
          eventTitle: event.title,
          eventDate: event.event_date,
          venue: event.venue,
          platform: l.platform,
          price: l.all_in_price,
          url: l.url!,
        });
      }
    }

    if (allMatches.length === 0) continue;

    try {
      await sendPriceAlert(alert.email, alert.target_price, allMatches);

      db.prepare(
        'UPDATE price_alerts SET is_active = 0, last_notified_at = CURRENT_TIMESTAMP, notified_price = ? WHERE id = ?'
      ).run(Math.min(...allMatches.map((m) => m.price)), alert.id);

      notified++;
    } catch {
      // Email failed — leave active so it retries next run
    }
  }

  return Response.json({ checked: alerts.length, notified });
}
