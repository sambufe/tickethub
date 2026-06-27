import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { CatalogEvent, parsePlatformUrls } from '@/lib/types';
import { fetchListings as fetchTM } from '@/lib/ticket-sources/ticketmaster';
import { fetchListings as fetchSG } from '@/lib/ticket-sources/seatgeek';
import { fetchListings as fetchSH } from '@/lib/ticket-sources/stubhub';
import { fetchListings as fetchVS } from '@/lib/ticket-sources/vividseats';
import { fetchListings as fetchAXS } from '@/lib/ticket-sources/axs';
import { fetchListings as fetchGT } from '@/lib/ticket-sources/gametime';
import { fetchListings as fetchTP } from '@/lib/ticket-sources/tickpick';
import type { SourceResult } from '@/lib/ticket-sources/types';

function verifyAdmin(req: NextRequest): boolean {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD;
}

export interface PlatformConnectionResult {
  platform: string;
  key: string;
  status: 'connected' | 'no_url' | 'error';
  listingCount?: number;
  summary: string;
  url: string | null;
}

const NO_URL_PHRASES = [
  'not configured',
  'access pending',
  'no ticketmaster',
  'no seatgeek',
  'no axs url',
  'not stored',
  'not found on',
  'not publicly accessible',
  'requires partner',
  'requires gametime',
];

function isNoUrlError(error: string): boolean {
  const lower = error.toLowerCase();
  return NO_URL_PHRASES.some((p) => lower.includes(p));
}

function interpretResult(result: SourceResult, url: string | null): Omit<PlatformConnectionResult, 'platform' | 'key'> {
  const { listings, error } = result;

  if (error && isNoUrlError(error)) {
    return { status: 'no_url', summary: error, url };
  }

  if (listings.length > 0) {
    return {
      status: 'connected',
      listingCount: listings.length,
      summary: `${listings.length} listing${listings.length !== 1 ? 's' : ''} found`,
      url,
    };
  }

  if (error?.includes('ticketed through the venue') || error?.includes('Buy at:')) {
    return { status: 'connected', summary: 'Connected (venue-ticketed event)', url };
  }

  if (error) {
    return { status: 'error', summary: error, url };
  }

  return { status: 'connected', summary: '0 listings (may be sold out)', url };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdmin(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const db = await getDb();
  const event = ((await db.execute({ sql: 'SELECT * FROM events WHERE id = ?', args: [id] })).rows[0] ?? undefined) as unknown as CatalogEvent | undefined;
  if (!event) {
    return Response.json({ error: 'Event not found' }, { status: 404 });
  }

  const urls = parsePlatformUrls(event);

  type PlatformDef = {
    key: string;
    platform: string;
    hasData: boolean;
    url: string | null;
    fetcher: (e: CatalogEvent) => Promise<SourceResult>;
  };

  const defs: PlatformDef[] = [
    { key: 'ticketmaster', platform: 'Ticketmaster', hasData: !!event.ticketmaster_id, url: urls.ticketmaster ?? null, fetcher: fetchTM },
    { key: 'seatgeek', platform: 'SeatGeek', hasData: !!event.seatgeek_id, url: urls.seatgeek ?? null, fetcher: fetchSG },
    { key: 'stubhub', platform: 'StubHub', hasData: true, url: urls.stubhub ?? null, fetcher: fetchSH },
    { key: 'vividseats', platform: 'Vivid Seats', hasData: !!urls.vividseats, url: urls.vividseats ?? null, fetcher: fetchVS },
    { key: 'axs', platform: 'AXS', hasData: !!urls.axs, url: urls.axs ?? null, fetcher: fetchAXS },
    { key: 'gametime', platform: 'Gametime', hasData: !!urls.gametime, url: urls.gametime ?? null, fetcher: fetchGT },
    { key: 'tickpick', platform: 'TickPick', hasData: !!urls.tickpick, url: urls.tickpick ?? null, fetcher: fetchTP },
  ];

  const settled = await Promise.allSettled(
    defs.map(async ({ key, platform, hasData, url, fetcher }): Promise<PlatformConnectionResult> => {
      if (!hasData) {
        return { platform, key, status: 'no_url', summary: 'No URL or ID stored', url };
      }
      try {
        const result = await fetcher(event);
        return { platform, key, ...interpretResult(result, url) };
      } catch (err) {
        return {
          platform, key, status: 'error',
          summary: err instanceof Error ? err.message : String(err),
          url,
        };
      }
    })
  );

  const results: PlatformConnectionResult[] = settled.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { platform: defs[i].platform, key: defs[i].key, status: 'error', summary: String(r.reason), url: defs[i].url }
  );

  return Response.json({ results });
}
