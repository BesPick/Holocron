import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

const dataDir = path.join(process.cwd(), 'data');
fs.mkdirSync(dataDir, { recursive: true });

const databasePath = path.join(dataDir, 'bespick.sqlite');
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
`);

export const db = drizzle(sqlite);
export { sqlite };
