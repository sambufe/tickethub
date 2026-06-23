import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { EventResult } from '@/lib/types';

function verifyAdmin(req: NextRequest): boolean {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD;
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const keyword = searchParams.get('keyword') || '';
  const city = searchParams.get('city') || '';
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';

  const tmKey = process.env.TICKETMASTER_API_KEY;
  const sgClientId = process.env.SEATGEEK_CLIENT_ID;

  const db = getDb();
  const existing = db
    .prepare('SELECT ticketmaster_id, seatgeek_id FROM events')
    .all() as Array<{ ticketmaster_id: string | null; seatgeek_id: string | null }>;

  const existingTMIds = new Set(existing.map((e) => e.ticketmaster_id).filter(Boolean));
  const existingSGIds = new Set(existing.map((e) => e.seatgeek_id).filter(Boolean));

  const results: EventResult[] = [];
  const errors: string[] = [];

  const page = parseInt(searchParams.get('page') || '0', 10);
  const PAGE_SIZE = 100;

  // --- Ticketmaster ---
  if (tmKey && tmKey !== 'your_key_here') {
    try {
      // Geo-center: Thousand Oaks area (~midpoint of LA/Ventura/Santa Barbara counties)
      // Radius of 85 miles covers all three counties
      const params = new URLSearchParams({
        apikey: tmKey,
        classificationName: 'music',
        size: String(PAGE_SIZE),
        page: String(page),
        sort: 'date,asc',
        geoPoint: '34.17,-118.84',
        radius: '85',
        unit: 'miles',
      });
      if (keyword) params.set('keyword', keyword);
      if (city) {
        params.set('city', city);
        params.delete('geoPoint');
        params.delete('radius');
        params.delete('unit');
        params.set('stateCode', 'CA');
      }
      // Convert local LA dates (PDT = UTC-7) to UTC for TM's API
      if (dateFrom) params.set('startDateTime', new Date(`${dateFrom}T00:00:00-07:00`).toISOString().slice(0, 19) + 'Z');
      if (dateTo) params.set('endDateTime', new Date(`${dateTo}T23:59:59-07:00`).toISOString().slice(0, 19) + 'Z');

      const res = await fetch(
        `https://app.ticketmaster.com/discovery/v2/events.json?${params}`
      );
      const data = await res.json();

      if (data.fault) {
        errors.push(`Ticketmaster: ${data.fault.faultstring || 'API error'}`);
      } else if (data._embedded?.events) {
        for (const e of data._embedded.events) {
          const venue = e._embedded?.venues?.[0];
          const artist = e._embedded?.attractions?.[0]?.name || '';
          const image =
            e.images?.find(
              (i: { ratio: string; width: number; url: string }) =>
                i.ratio === '16_9' && i.width >= 640
            )?.url ||
            e.images?.[0]?.url ||
            '';

          results.push({
            id: `tm_${e.id}`,
            source: 'ticketmaster',
            title: e.name,
            artist,
            venue: venue?.name || '',
            city: venue?.city?.name || '',
            state: venue?.state?.stateCode || 'CA',
            event_date: `${e.dates.start.localDate}T${e.dates.start.localTime || '00:00:00'}`,
            image_url: image,
            ticketmaster_id: e.id,
            source_url: e.url || '',
            alreadyAdded: existingTMIds.has(e.id),
          });
        }
      }
    } catch (err) {
      errors.push(`Ticketmaster: ${err instanceof Error ? err.message : 'Request failed'}`);
    }
  } else {
    errors.push('Ticketmaster API key not configured in .env.local');
  }

  // --- SeatGeek ---
  if (sgClientId && sgClientId !== 'your_client_id_here') {
    try {
      // Same geo-center as Ticketmaster (LA/Ventura/Santa Barbara counties)
      const params = new URLSearchParams({
        client_id: sgClientId,
        type: 'concert',
        per_page: String(PAGE_SIZE),
        page: String(page + 1), // SeatGeek pages are 1-indexed
        sort: 'datetime_local.asc',
        lat: '34.17',
        lon: '-118.84',
        range: '85mi',
      });
      if (keyword) params.set('q', keyword);
      if (city) {
        params.set('venue.city', city);
        params.delete('lat');
        params.delete('lon');
        params.delete('range');
      }
      // SeatGeek uses local datetime strings — no timezone conversion needed
      if (dateFrom) params.set('datetime_local.gte', `${dateFrom}T00:00:00`);
      if (dateTo) params.set('datetime_local.lte', `${dateTo}T23:59:59`);

      const res = await fetch(`https://api.seatgeek.com/2/events?${params}`);
      const data = await res.json();

      if (data.events) {
        for (const e of data.events) {
          const sgIdStr = String(e.id);
          const image = e.performers?.[0]?.image || '';
          const dateStr = e.datetime_local?.split('T')[0] || '';

          const duplicate = results.find(
            (r) =>
              r.event_date.startsWith(dateStr) &&
              normalizeTitle(r.title) === normalizeTitle(e.title)
          );

          if (duplicate) {
            duplicate.source = 'both';
            duplicate.seatgeek_id = sgIdStr;
            if (existingSGIds.has(sgIdStr)) duplicate.alreadyAdded = true;
            if (!duplicate.image_url && image) duplicate.image_url = image;
          } else {
            results.push({
              id: `sg_${e.id}`,
              source: 'seatgeek',
              title: e.title,
              artist: e.performers?.[0]?.name || '',
              venue: e.venue?.name || '',
              city: e.venue?.city || '',
              state: e.venue?.state || 'CA',
              event_date: e.datetime_local,
              image_url: image,
              seatgeek_id: sgIdStr,
              alreadyAdded: existingSGIds.has(sgIdStr),
            });
          }
        }
      }
    } catch (err) {
      errors.push(`SeatGeek: ${err instanceof Error ? err.message : 'Request failed'}`);
    }
  } else {
    errors.push('SeatGeek client ID not configured in .env.local');
  }

  results.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());

  return Response.json({ results, errors, page, has_more: results.length >= PAGE_SIZE });
}
