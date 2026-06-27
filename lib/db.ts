import { createClient, type Client } from '@libsql/client';

let _clientPromise: Promise<Client> | null = null;

async function createAndInit(): Promise<Client> {
  const url = process.env.TURSO_DATABASE_URL ?? `file:${process.cwd()}/tickethub.db`;
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

  await client.execute(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      artist TEXT,
      venue TEXT,
      city TEXT,
      state TEXT,
      event_date DATETIME,
      ticketmaster_id TEXT,
      seatgeek_id TEXT,
      source_url TEXT,
      image_url TEXT,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_active BOOLEAN DEFAULT 1
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS ticket_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER REFERENCES events(id),
      fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      raw_json TEXT
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS api_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      called_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      credits_used INTEGER,
      event_id INTEGER REFERENCES events(id),
      endpoint TEXT
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS price_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER REFERENCES events(id),
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      target_price NUMERIC NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_active BOOLEAN DEFAULT 1,
      last_notified_at DATETIME,
      notified_price NUMERIC
    )
  `);

  const migrations = [
    'ALTER TABLE events ADD COLUMN source_url TEXT',
    'ALTER TABLE events ADD COLUMN canonical_id TEXT',
    'ALTER TABLE events ADD COLUMN platform_urls TEXT',
    'ALTER TABLE ticket_cache ADD COLUMN qty INTEGER NOT NULL DEFAULT 2',
    'ALTER TABLE price_alerts ADD COLUMN date_window TEXT',
    'ALTER TABLE price_alerts ADD COLUMN event_ids TEXT',
    'ALTER TABLE price_alerts ADD COLUMN label TEXT',
    'ALTER TABLE price_alerts ADD COLUMN market_price_at_signup NUMERIC',
    'ALTER TABLE price_alerts ADD COLUMN platforms_checked_at_signup INTEGER',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_events_canonical_id ON events(canonical_id) WHERE canonical_id IS NOT NULL',
  ];

  for (const sql of migrations) {
    try { await client.execute(sql); } catch {}
  }

  return client;
}

export function getDb(): Promise<Client> {
  if (!_clientPromise) _clientPromise = createAndInit();
  return _clientPromise;
}
