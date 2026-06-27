import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { CatalogEvent } from '@/lib/types';

function verifyAdmin(req: NextRequest): boolean {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD;
}

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = await getDb();
  const events = (await db.execute({
    sql: 'SELECT * FROM events ORDER BY event_date ASC',
    args: [],
  })).rows as unknown as CatalogEvent[];

  return Response.json({ events });
}

interface EventAddBody {
  title: string;
  artist?: string;
  venue?: string;
  city?: string;
  state?: string;
  event_date?: string;
  ticketmaster_id?: string;
  seatgeek_id?: string;
  source_url?: string;
  image_url?: string;
  canonical_id?: string;
  platform_urls?: Record<string, string | null>;
}

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as EventAddBody;

  if (!body.title) {
    return Response.json({ error: 'title is required' }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.execute({
    sql: `INSERT INTO events
            (title, artist, venue, city, state, event_date,
             ticketmaster_id, seatgeek_id, source_url, image_url,
             canonical_id, platform_urls)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      body.title,
      body.artist ?? null,
      body.venue ?? null,
      body.city ?? null,
      body.state ?? null,
      body.event_date ?? null,
      body.ticketmaster_id ?? null,
      body.seatgeek_id ?? null,
      body.source_url ?? null,
      body.image_url ?? null,
      body.canonical_id ?? null,
      body.platform_urls ? JSON.stringify(body.platform_urls) : null,
    ],
  });

  return Response.json({ ok: true, id: Number(result.lastInsertRowid) });
}
