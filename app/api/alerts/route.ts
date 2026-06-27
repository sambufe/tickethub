import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { sendAlertConfirmation } from '@/lib/email';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { event_id, event_ids, name, email, target_price, quantity, date_window } = body;

  if (!name || !email || target_price == null || !quantity) {
    return Response.json({ error: 'Name, email, price, and quantity are required.' }, { status: 400 });
  }
  if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
    return Response.json({ error: 'Invalid email address' }, { status: 400 });
  }
  const price = Number(target_price);
  if (!Number.isFinite(price) || price <= 0) {
    return Response.json({ error: 'Target price must be greater than 0' }, { status: 400 });
  }
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 1 || qty > 6) {
    return Response.json({ error: 'Quantity must be between 1 and 6' }, { status: 400 });
  }

  let eventIdList: number[] = [];
  if (Array.isArray(event_ids) && event_ids.length > 0) {
    eventIdList = event_ids.map(Number).filter((n) => Number.isInteger(n) && n > 0);
  } else if (event_id != null) {
    eventIdList = [Number(event_id)];
  }

  const db = await getDb();

  for (const eid of eventIdList) {
    const exists = (await db.execute({ sql: 'SELECT id FROM events WHERE id = ?', args: [eid] })).rows[0];
    if (!exists) return Response.json({ error: `Event ${eid} not found` }, { status: 404 });
  }

  const nameStr = String(name).trim();
  const emailStr = String(email).trim().toLowerCase();
  const dateWindowStr = typeof date_window === 'string' ? date_window : null;
  const singleEventId = eventIdList.length > 0 ? eventIdList[0] : null;
  const eventIdsJson = eventIdList.length > 0 ? JSON.stringify(eventIdList) : null;

  let marketPrice: number | null = null;
  let platformsChecked = 0;

  if (singleEventId) {
    const cacheRows = (await db.execute({
      sql: 'SELECT raw_json FROM ticket_cache WHERE event_id = ? ORDER BY fetched_at DESC LIMIT 10',
      args: [singleEventId],
    })).rows as unknown as { raw_json: string }[];

    const seenPlatforms = new Set<string>();
    let lowestSeen = Infinity;

    for (const row of cacheRows) {
      try {
        const parsed = JSON.parse(row.raw_json) as { listings?: { all_in_price: number; platform: string; quantity: number }[] };
        for (const l of parsed.listings ?? []) {
          if (l.quantity === 0 || l.quantity >= qty) {
            seenPlatforms.add(l.platform);
            if (l.all_in_price < lowestSeen) lowestSeen = l.all_in_price;
          }
        }
      } catch {}
    }

    if (lowestSeen < Infinity) marketPrice = lowestSeen;
    platformsChecked = seenPlatforms.size;
  }

  await db.execute({
    sql: 'INSERT INTO price_alerts (event_id, event_ids, name, email, target_price, quantity, date_window, market_price_at_signup, platforms_checked_at_signup) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [singleEventId, eventIdsJson, nameStr, emailStr, price, qty, dateWindowStr, marketPrice, platformsChecked],
  });

  let eventTitle = 'any upcoming event';
  if (singleEventId) {
    const eventRow = ((await db.execute({ sql: 'SELECT title FROM events WHERE id = ?', args: [singleEventId] })).rows[0] ?? null) as unknown as { title: string } | null;
    if (eventRow) eventTitle = eventIdList.length > 1 ? `${eventRow.title} + ${eventIdList.length - 1} more` : eventRow.title;
  }

  sendAlertConfirmation({ to: emailStr, name: nameStr, eventTitle, targetPrice: price, quantity: qty }).catch(() => {});

  const phKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (phKey && phKey !== 'your_key_here') {
    fetch('https://us.i.posthog.com/capture/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: phKey,
        event: 'price_alert_created',
        distinct_id: 'server',
        properties: {
          event_id: singleEventId,
          event_ids: eventIdList,
          quantity: qty,
          target_price: price,
          date_window: dateWindowStr,
          market_price_at_signup: marketPrice,
          platforms_checked_at_signup: platformsChecked,
          discount_sought: marketPrice ? Math.round((1 - price / marketPrice) * 100) : null,
        },
      }),
    }).catch(() => {});
  }

  return Response.json({ success: true });
}
