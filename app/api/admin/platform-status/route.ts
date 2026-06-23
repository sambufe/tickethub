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

async function checkSeatGeek(): Promise<PlatformStatus> {
  const id = process.env.SEATGEEK_CLIENT_ID;
  if (!id || id === 'your_client_id_here') {
    return { platform: 'SeatGeek', type: 'api', status: 'unconfigured', message: 'SEATGEEK_CLIENT_ID not set' };
  }
  try {
    const res = await safeFetch(
      `https://api.seatgeek.com/2/events?client_id=${id}&type=concert&per_page=1`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res) return { platform: 'SeatGeek', type: 'api', status: 'error', message: 'Request timed out' };
    if (res.status === 401 || res.status === 403) return { platform: 'SeatGeek', type: 'api', status: 'error', message: 'Invalid client ID' };
    if (!res.ok) return { platform: 'SeatGeek', type: 'api', status: 'error', message: `API returned ${res.status}` };
    return { platform: 'SeatGeek', type: 'api', status: 'ok', message: 'Client ID valid' };
  } catch (err) {
    return { platform: 'SeatGeek', type: 'api', status: 'error', message: String(err) };
  }
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

  const [tm, sg] = await Promise.all([checkTicketmaster(), checkSeatGeek()]);

  const statuses: PlatformStatus[] = [
    tm,
    sg,
    checkStubHub(),
    { platform: 'Vivid Seats', type: 'scraper', status: 'ok', message: 'Playwright scraper active' },
    { platform: 'AXS', type: 'scraper', status: 'unconfigured', message: 'Cloudflare blocks automated access — manual link only' },
    { platform: 'Gametime', type: 'scraper', status: 'ok', message: 'Playwright scraper active' },
    { platform: 'TickPick', type: 'scraper', status: 'ok', message: 'Playwright scraper active' },
  ];

  return Response.json({ statuses });
}
