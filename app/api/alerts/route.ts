import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { sendAlertConfirmation } from '@/lib/email';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { event_id, name, email, target_price, quantity, date_window } = body;

  // event_id is optional (null = general/any-event alert)
  const hasEventId = event_id != null;

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

  const db = getDb();

  let eventTitle = 'any upcoming event';
  if (hasEventId) {
    const event = db.prepare('SELECT id, title FROM events WHERE id = ?').get(event_id) as { id: number; title: string } | null;
    if (!event) return Response.json({ error: 'Event not found' }, { status: 404 });
    eventTitle = event.title;
  }

  const nameStr = String(name).trim();
  const emailStr = String(email).trim().toLowerCase();
  const dateWindowStr = typeof date_window === 'string' ? date_window : null;

  db.prepare(
    'INSERT INTO price_alerts (event_id, name, email, target_price, quantity, date_window) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(hasEventId ? Number(event_id) : null, nameStr, emailStr, price, qty, dateWindowStr);

  sendAlertConfirmation({
    to: emailStr,
    name: nameStr,
    eventTitle,
    targetPrice: price,
    quantity: qty,
  }).catch(() => {});

  // PostHog server-side capture
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
          event_id: hasEventId ? Number(event_id) : null,
          quantity: qty,
          target_price: price,
          date_window: dateWindowStr,
        },
      }),
    }).catch(() => {});
  }

  return Response.json({ success: true });
}
