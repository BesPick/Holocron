import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), 'data');
fs.mkdirSync(dataDir, { recursive: true });

const databasePath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(dataDir, 'bespick.sqlite');
const sqlite = new Database(databasePath);
sqlite.pragma('journal_mode = WAL');

sqlite.exec(`
CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  event_type TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  publish_at INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_by TEXT,
  updated_at INTEGER,
  updated_by TEXT,
  auto_delete_at INTEGER,
  auto_archive_at INTEGER,
  poll_question TEXT,
  poll_options_json TEXT,
  poll_anonymous INTEGER,
  poll_allow_additional_options INTEGER,
  poll_max_selections INTEGER,
  poll_closes_at INTEGER,
  voting_participants_json TEXT,
  voting_add_vote_price REAL,
  voting_remove_vote_price REAL,
  voting_allowed_groups_json TEXT,
  voting_allowed_portfolios_json TEXT,
  voting_allow_ungrouped INTEGER,
  voting_allow_removals INTEGER,
  voting_leaderboard_mode TEXT,
  image_ids_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_announcements_publish_at ON announcements(status, publish_at);
CREATE INDEX IF NOT EXISTS idx_announcements_event_type ON announcements(event_type);

CREATE TABLE IF NOT EXISTS poll_votes (
  id TEXT PRIMARY KEY,
  announcement_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT,
  selections_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_poll_votes_announcement ON poll_votes(announcement_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_user ON poll_votes(announcement_id, user_id);

CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS demo_day_assignments (
  date TEXT PRIMARY KEY,
  user_id TEXT,
  user_name TEXT NOT NULL,
  assigned_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_demo_day_assignments_user ON demo_day_assignments(user_id);

CREATE TABLE IF NOT EXISTS standup_assignments (
  date TEXT PRIMARY KEY,
  user_id TEXT,
  user_name TEXT NOT NULL,
  assigned_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_standup_assignments_user ON standup_assignments(user_id);

CREATE TABLE IF NOT EXISTS schedule_rules (
  id TEXT PRIMARY KEY,
  config_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS schedule_event_overrides (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  event_type TEXT NOT NULL,
  moved_to_date TEXT,
  time TEXT,
  is_canceled INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_schedule_event_overrides_date ON schedule_event_overrides(date);
CREATE INDEX IF NOT EXISTS idx_schedule_event_overrides_type ON schedule_event_overrides(event_type);
`);

const overrideColumns = sqlite
  .prepare("PRAGMA table_info('schedule_event_overrides')")
  .all() as Array<{ name: string }>;
const hasMovedToDate = overrideColumns.some(
  (column) => column.name === 'moved_to_date',
);
if (!hasMovedToDate) {
  sqlite.exec(
    'ALTER TABLE schedule_event_overrides ADD COLUMN moved_to_date TEXT;',
  );
}

export const db = drizzle(sqlite);
export { sqlite };
