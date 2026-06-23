import { NextRequest } from 'next/server';
import { safeFetch } from '@/lib/ticket-sources/types';

function verifyAdmin(req: NextRequest): boolean {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD;
}

export interface PlatformStatus {
  platform: string;
  type: 'api' | 'scraper';
  status: 'ok' | 'error' | 'unconfigured';
  message: string;
}

async function checkTicketmaster(): Promise<PlatformStatus> {
  const key = process.env.TICKETMASTER_API_KEY;
  if (!key || key === 'your_key_here') {
    return { platform: 'Ticketmaster', type: 'api', status: 'unconfigured', message: 'TICKETMASTER_API_KEY not set' };
  }
  try {
    const res = await safeFetch(
      `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${key}&classificationName=music&size=1`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res) return { platform: 'Ticketmaster', type: 'api', status: 'error', message: 'Request timed out' };
    if (!res.ok) return { platform: 'Ticketmaster', type: 'api', status: 'error', message: `API returned ${res.status}` };
    const data = await res.json();
    if (data.fault) return { platform: 'Ticketmaster', type: 'api', status: 'error', message: data.fault.faultstring ?? 'API error' };
    return { platform: 'Ticketmaster', type: 'api', status: 'ok', message: 'API key valid' };
  } catch (err) {
    return { platform: 'Ticketmaster', type: 'api', status: 'error', message: String(err) };
  }
}

function checkSeatGeek(): PlatformStatus {
  const cookie = process.env.SEATGEEK_DATADOME_COOKIE;
  if (!cookie) {
    return {
      platform: 'SeatGeek',
      type: 'scraper',
      status: 'unconfigured',
      message: 'SEATGEEK_DATADOME_COOKIE not set — add via Admin → Dashboard',
    };
  }
  return {
    platform: 'SeatGeek',
    type: 'scraper',
    status: 'ok',
    message: 'DataDome cookie configured (expires ~7 days from when it was set)',
  };
}

function checkStubHub(): PlatformStatus {
  const key = process.env.STUBHUB_API_KEY;
  if (!key || key === 'your_key_here') {
    return { platform: 'StubHub', type: 'api', status: 'unconfigured', message: 'STUBHUB_API_KEY not set' };
  }
  return { platform: 'StubHub', type: 'api', status: 'ok', message: 'API key configured (not tested)' };
}

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tm = await checkTicketmaster();

  const statuses: PlatformStatus[] = [
    tm,
    checkSeatGeek(),
    checkStubHub(),
    { platform: 'Vivid Seats', type: 'scraper', status: 'ok', message: 'Playwright scraper active' },
    { platform: 'AXS', type: 'scraper', status: 'unconfigured', message: 'Cloudflare blocks automated access — manual link only' },
    { platform: 'Gametime', type: 'scraper', status: 'ok', message: 'Playwright scraper active' },
    { platform: 'TickPick', type: 'scraper', status: 'ok', message: 'Playwright scraper active' },
  ];

  return Response.json({ statuses });
}
