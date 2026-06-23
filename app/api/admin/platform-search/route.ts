import { NextRequest } from 'next/server';
import { CatalogEvent } from '@/lib/types';
import { findEventCandidates as findVSCandidates } from '@/lib/ticket-sources/vividseats';
import { findEventCandidates as findTPCandidates } from '@/lib/ticket-sources/tickpick';
import { findEventCandidates as findGTCandidates } from '@/lib/ticket-sources/gametime';
import { findEventCandidates as findSHCandidates } from '@/lib/ticket-sources/stubhub';
import { findEventCandidates as findSGCandidates } from '@/lib/ticket-sources/seatgeek';
import { findEventCandidates as findAXSCandidates } from '@/lib/ticket-sources/axs';
import { urlToLabel } from '@/lib/venue-match';

function verifyAdmin(req: NextRequest): boolean {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD;
}

interface SearchPayload {
  platform: string;
  title: string;
  artist?: string;
  venue?: string;
  city?: string;
  state?: string;
  event_date?: string;
  ticketmaster_id?: string;
  seatgeek_id?: string;
  source_url?: string;
}

interface PlatformResult {
  url: string | null;
  found: boolean;
  candidates?: Array<{ url: string; label: string }>;
  error?: string;
}

function toEvent(p: SearchPayload): CatalogEvent {
  return {
    id: 0,
    canonical_id: null,
    title: p.title,
    artist: p.artist ?? null,
    venue: p.venue ?? null,
    city: p.city ?? null,
    state: p.state ?? null,
    event_date: p.event_date ?? null,
    ticketmaster_id: p.ticketmaster_id ?? null,
    seatgeek_id: p.seatgeek_id ?? null,
    source_url: p.source_url ?? null,
    platform_urls: null,
    image_url: null,
    added_at: new Date().toISOString(),
    is_active: 1,
  };
}

async function findTicketmaster(p: SearchPayload): Promise<PlatformResult> {
  if (p.source_url) return { url: p.source_url, found: true };
  if (p.ticketmaster_id) {
    return { url: `https://www.ticketmaster.com/event/${p.ticketmaster_id}`, found: true };
  }
  return { url: null, found: false, error: 'No Ticketmaster ID for this event' };
}

async function findSeatGeek(p: SearchPayload): Promise<PlatformResult> {
  try {
    const urls = await findSGCandidates(toEvent(p));
    if (urls.length === 0) {
      return {
        url: null,
        found: false,
        error: 'Not found via search — paste the SeatGeek event URL manually',
      };
    }
    if (urls.length === 1) return { url: urls[0], found: true };
    return { url: null, found: false, candidates: urls.map((u) => ({ url: u, label: urlToLabel(u) })) };
  } catch (err) {
    return { url: null, found: false, error: `SeatGeek search failed: ${err}` };
  }
}

async function findStubHub(p: SearchPayload): Promise<PlatformResult> {
  try {
    const urls = await findSHCandidates(toEvent(p));
    if (urls.length === 0) {
      return {
        url: null,
        found: false,
        error: 'Not found on StubHub — paste the event URL manually',
      };
    }
    if (urls.length === 1) return { url: urls[0], found: true };
    return { url: null, found: false, candidates: urls.map((u) => ({ url: u, label: urlToLabel(u) })) };
  } catch (err) {
    return { url: null, found: false, error: `StubHub search failed: ${err}` };
  }
}

async function findVividSeats(p: SearchPayload): Promise<PlatformResult> {
  try {
    const urls = await findVSCandidates(toEvent(p));
    if (urls.length === 0) return { url: null, found: false, error: 'Event not found on Vivid Seats' };
    if (urls.length === 1) return { url: urls[0], found: true };
    return { url: null, found: false, candidates: urls.map((u) => ({ url: u, label: urlToLabel(u) })) };
  } catch (err) {
    return { url: null, found: false, error: `Vivid Seats search failed: ${err}` };
  }
}

async function findAXS(p: SearchPayload): Promise<PlatformResult> {
  try {
    const urls = await findAXSCandidates(toEvent(p));
    if (urls.length === 0) {
      return {
        url: null,
        found: false,
        error: 'Not found via search — paste the AXS event URL manually',
      };
    }
    if (urls.length === 1) return { url: urls[0], found: true };
    return { url: null, found: false, candidates: urls.map((u) => ({ url: u, label: urlToLabel(u) })) };
  } catch (err) {
    return { url: null, found: false, error: `AXS search failed: ${err}` };
  }
}

async function findGametime(p: SearchPayload): Promise<PlatformResult> {
  try {
    const urls = await findGTCandidates(toEvent(p));
    if (urls.length === 0) return { url: null, found: false, error: 'Event not found on Gametime' };
    if (urls.length === 1) return { url: urls[0], found: true };
    return { url: null, found: false, candidates: urls.map((u) => ({ url: u, label: urlToLabel(u) })) };
  } catch (err) {
    return { url: null, found: false, error: `Gametime search failed: ${err}` };
  }
}

async function findTickPick(p: SearchPayload): Promise<PlatformResult> {
  try {
    const urls = await findTPCandidates(toEvent(p));
    if (urls.length === 0) return { url: null, found: false, error: 'Event not found on TickPick' };
    if (urls.length === 1) return { url: urls[0], found: true };
    return { url: null, found: false, candidates: urls.map((u) => ({ url: u, label: urlToLabel(u) })) };
  } catch (err) {
    return { url: null, found: false, error: `TickPick search failed: ${err}` };
  }
}

const FINDERS: Record<string, (p: SearchPayload) => Promise<PlatformResult>> = {
  ticketmaster: findTicketmaster,
  seatgeek: findSeatGeek,
  stubhub: findStubHub,
  vividseats: findVividSeats,
  axs: findAXS,
  gametime: findGametime,
  tickpick: findTickPick,
};

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as SearchPayload;
  const finder = FINDERS[body.platform?.toLowerCase()];

  if (!finder) {
    return Response.json({ error: `Unknown platform: ${body.platform}` }, { status: 400 });
  }

  const result = await finder(body);
  return Response.json(result);
}
