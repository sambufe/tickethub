import Database from 'better-sqlite3';
import path from 'path';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(path.join(process.cwd(), 'tickethub.db'));
    db.pragma('journal_mode = WAL');
    db.exec(`
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
      );

      CREATE TABLE IF NOT EXISTS ticket_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER REFERENCES events(id),
        fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        raw_json TEXT
      );

      CREATE TABLE IF NOT EXISTS api_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        called_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        credits_used INTEGER,
        event_id INTEGER REFERENCES events(id),
        endpoint TEXT
      );

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
      );
    `);

    // Migrations — try/catch so re-running on an existing DB is safe
    try { db.exec('ALTER TABLE events ADD COLUMN source_url TEXT'); } catch {}
    try { db.exec('ALTER TABLE events ADD COLUMN canonical_id TEXT'); } catch {}
    try { db.exec('ALTER TABLE events ADD COLUMN platform_urls TEXT'); } catch {}
    // qty column on ticket_cache: each entry is keyed per event_id + qty
    try { db.exec('ALTER TABLE ticket_cache ADD COLUMN qty INTEGER NOT NULL DEFAULT 2'); } catch {}
    try {
      db.exec(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_events_canonical_id ON events(canonical_id) WHERE canonical_id IS NOT NULL'
      );
    } catch {}
    try { db.exec('ALTER TABLE price_alerts ADD COLUMN date_window TEXT'); } catch {}
    try { db.exec('ALTER TABLE price_alerts ADD COLUMN event_ids TEXT'); } catch {}
    try { db.exec('ALTER TABLE price_alerts ADD COLUMN label TEXT'); } catch {}
  }
  return db;
}
