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

  const db = getDb();
  const events = db
    .prepare('SELECT * FROM events ORDER BY event_date ASC')
    .all() as CatalogEvent[];

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

  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO events
         (title, artist, venue, city, state, event_date,
          ticketmaster_id, seatgeek_id, source_url, image_url,
          canonical_id, platform_urls)
       VALUES
         (@title, @artist, @venue, @city, @state, @event_date,
          @ticketmaster_id, @seatgeek_id, @source_url, @image_url,
          @canonical_id, @platform_urls)`
    )
    .run({
      title: body.title,
      artist: body.artist ?? null,
      venue: body.venue ?? null,
      city: body.city ?? null,
      state: body.state ?? null,
      event_date: body.event_date ?? null,
      ticketmaster_id: body.ticketmaster_id ?? null,
      seatgeek_id: body.seatgeek_id ?? null,
      source_url: body.source_url ?? null,
      image_url: body.image_url ?? null,
      canonical_id: body.canonical_id ?? null,
      platform_urls: body.platform_urls ? JSON.stringify(body.platform_urls) : null,
    });

  return Response.json({ ok: true, id: result.lastInsertRowid });
}

