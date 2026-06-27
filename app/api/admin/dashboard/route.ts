import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { CatalogEvent, parsePlatformUrls } from '@/lib/types';

function verifyAdmin(req: NextRequest): boolean {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD;
}

const SOCAL_CITIES = [
  'los angeles', 'la ', 'ventura', 'santa barbara', 'thousand oaks', 'anaheim',
  'long beach', 'san diego', 'oxnard', 'burbank', 'glendale', 'pasadena',
  'inglewood', 'hollywood', 'west hollywood', 'malibu', 'calabasas', 'camarillo',
];
const BAYAREA_CITIES = [
  'san francisco', ' sf ', 'oakland', 'san jose', 'berkeley', 'san mateo',
  'palo alto', 'mountain view', 'sunnyvale', 'santa clara', 'hayward', 'fremont',
  'san leandro', 'concord', 'walnut creek', 'santa cruz',
];

function getRegion(city: string | null, state: string | null): string {
  if (!city) return state === 'CA' ? 'Other CA' : 'Other';
  const c = ` ${city.toLowerCase()} `;
  if (SOCAL_CITIES.some((p) => c.includes(p))) return 'SoCal';
  if (BAYAREA_CITIES.some((p) => c.includes(p))) return 'Bay Area';
  if (state === 'CA') return 'Other CA';
  return 'Other';
}

const PLATFORM_KEYS = ['ticketmaster', 'seatgeek', 'stubhub', 'vividseats', 'axs', 'gametime', 'tickpick'] as const;
const PLATFORM_NAMES: Record<string, string> = {
  ticketmaster: 'Ticketmaster',
  seatgeek: 'SeatGeek',
  stubhub: 'StubHub',
  vividseats: 'Vivid Seats',
  axs: 'AXS',
  gametime: 'Gametime',
  tickpick: 'TickPick',
};

export interface DashboardStats {
  total: number;
  active: number;
  inactive: number;
  upcoming30d: number;
  byRegion: Record<string, number>;
}

export interface CoverageEntry {
  platform: string;
  key: string;
  linked: number;
  total: number;
}

export interface CacheStats {
  fresh: number;
  stale: number;
  none: number;
  totalActive: number;
}

export interface AlertRow {
  event_title: string;
  active_count: number;
  min_target: number;
}

export interface AlertStats {
  totalActive: number;
  byEvent: AlertRow[];
}

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = await getDb();

  const allEvents = (await db.execute({ sql: 'SELECT * FROM events', args: [] })).rows as unknown as CatalogEvent[];
  const now = new Date();
  const in30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const stats: DashboardStats = {
    total: allEvents.length,
    active: allEvents.filter((e) => e.is_active).length,
    inactive: allEvents.filter((e) => !e.is_active).length,
    upcoming30d: allEvents.filter((e) => {
      if (!e.is_active || !e.event_date) return false;
      const d = new Date(e.event_date);
      return d >= now && d <= in30d;
    }).length,
    byRegion: {},
  };

  for (const e of allEvents) {
    if (!e.is_active) continue;
    const region = getRegion(e.city, e.state);
    stats.byRegion[region] = (stats.byRegion[region] ?? 0) + 1;
  }

  const coverageMap: Record<string, number> = {};
  for (const key of PLATFORM_KEYS) coverageMap[key] = 0;

  for (const event of allEvents) {
    const urls = parsePlatformUrls(event);
    if (event.ticketmaster_id) coverageMap['ticketmaster']++;
    if (event.seatgeek_id) coverageMap['seatgeek']++;
    for (const key of ['stubhub', 'vividseats', 'axs', 'gametime', 'tickpick'] as const) {
      if (urls[key]) coverageMap[key]++;
    }
  }

  const coverage: CoverageEntry[] = PLATFORM_KEYS.map((key) => ({
    platform: PLATFORM_NAMES[key],
    key,
    linked: coverageMap[key],
    total: allEvents.length,
  }));

  const activeEvents = allEvents.filter((e) => e.is_active);
  const cacheRows = (await db.execute({
    sql: `SELECT event_id, MAX(fetched_at) as latest_fetch FROM ticket_cache GROUP BY event_id`,
    args: [],
  })).rows as unknown as Array<{ event_id: number; latest_fetch: string }>;

  const fetchMap = new Map(cacheRows.map((r) => [Number(r.event_id), r.latest_fetch]));
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const cache: CacheStats = { fresh: 0, stale: 0, none: 0, totalActive: activeEvents.length };
  for (const e of activeEvents) {
    const latest = fetchMap.get(Number(e.id));
    if (!latest) {
      cache.none++;
    } else if (new Date(latest) >= oneHourAgo) {
      cache.fresh++;
    } else {
      cache.stale++;
    }
  }

  const alertRows = (await db.execute({
    sql: `SELECT e.title as event_title, COUNT(*) as active_count, MIN(a.target_price) as min_target
          FROM price_alerts a JOIN events e ON e.id = a.event_id
          WHERE a.is_active = 1
          GROUP BY a.event_id ORDER BY active_count DESC`,
    args: [],
  })).rows as unknown as AlertRow[];

  const alerts: AlertStats = {
    totalActive: alertRows.reduce((s, r) => s + Number(r.active_count), 0),
    byEvent: alertRows,
  };

  return Response.json({ stats, coverage, cache, alerts });
}
