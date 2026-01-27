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
  voting_add_vote_limit INTEGER,
  voting_remove_vote_limit INTEGER,
  voting_allowed_groups_json TEXT,
  voting_allowed_portfolios_json TEXT,
  voting_allow_ungrouped INTEGER,
  voting_allow_removals INTEGER,
  voting_leaderboard_mode TEXT,
  form_questions_json TEXT,
  form_submission_limit TEXT,
  form_price REAL,
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

CREATE TABLE IF NOT EXISTS form_submissions (
  id TEXT PRIMARY KEY,
  announcement_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT,
  answers_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  paypal_order_id TEXT,
  payment_amount REAL
);
CREATE INDEX IF NOT EXISTS idx_form_submissions_announcement ON form_submissions(announcement_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_user ON form_submissions(announcement_id, user_id);

CREATE TABLE IF NOT EXISTS voting_purchases (
  id TEXT PRIMARY KEY,
  announcement_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  add_votes INTEGER NOT NULL,
  remove_votes INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_voting_purchases_announcement ON voting_purchases(announcement_id);
CREATE INDEX IF NOT EXISTS idx_voting_purchases_user ON voting_purchases(announcement_id, user_id);

CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS site_settings (
  id TEXT PRIMARY KEY,
  config_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT
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

CREATE TABLE IF NOT EXISTS security_shift_assignments (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  event_type TEXT NOT NULL,
  user_id TEXT,
  user_name TEXT NOT NULL,
  assigned_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_security_shift_assignments_date ON security_shift_assignments(date);
CREATE INDEX IF NOT EXISTS idx_security_shift_assignments_type ON security_shift_assignments(event_type);
CREATE INDEX IF NOT EXISTS idx_security_shift_assignments_user ON security_shift_assignments(user_id);

CREATE TABLE IF NOT EXISTS building_892_assignments (
  week_start TEXT PRIMARY KEY,
  team TEXT NOT NULL,
  assigned_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_building_892_assignments_team ON building_892_assignments(team);

CREATE TABLE IF NOT EXISTS schedule_rules (
  id TEXT PRIMARY KEY,
  config_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS schedule_refresh (
  id TEXT PRIMARY KEY,
  pending_since INTEGER,
  refreshed_at INTEGER
);

CREATE TABLE IF NOT EXISTS schedule_event_overrides (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  event_type TEXT NOT NULL,
  moved_to_date TEXT,
  time TEXT,
  is_canceled INTEGER NOT NULL,
  override_user_id TEXT,
  override_user_name TEXT,
  updated_at INTEGER NOT NULL,
  updated_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_schedule_event_overrides_date ON schedule_event_overrides(date);
CREATE INDEX IF NOT EXISTS idx_schedule_event_overrides_type ON schedule_event_overrides(event_type);

CREATE TABLE IF NOT EXISTS schedule_event_override_history (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  event_type TEXT NOT NULL,
  changed_at INTEGER NOT NULL,
  changed_by TEXT,
  previous_override_user_id TEXT,
  previous_override_user_name TEXT,
  previous_time TEXT,
  previous_moved_to_date TEXT,
  previous_is_canceled INTEGER,
  next_override_user_id TEXT,
  next_override_user_name TEXT,
  next_time TEXT,
  next_moved_to_date TEXT,
  next_is_canceled INTEGER
);
CREATE INDEX IF NOT EXISTS idx_schedule_event_override_history_event ON schedule_event_override_history(date, event_type);
CREATE INDEX IF NOT EXISTS idx_schedule_event_override_history_changed ON schedule_event_override_history(changed_at);

CREATE TABLE IF NOT EXISTS shift_notifications (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  event_date TEXT NOT NULL,
  user_id TEXT NOT NULL,
  sent_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shift_notifications_event ON shift_notifications(event_date, event_type);
CREATE INDEX IF NOT EXISTS idx_shift_notifications_user ON shift_notifications(user_id);
`);

const announcementColumns = sqlite
  .prepare("PRAGMA table_info('announcements')")
  .all() as Array<{ name: string }>;
const hasVotingAddLimit = announcementColumns.some(
  (column) => column.name === 'voting_add_vote_limit',
);
if (!hasVotingAddLimit) {
  sqlite.exec('ALTER TABLE announcements ADD COLUMN voting_add_vote_limit INTEGER;');
}
const hasVotingRemoveLimit = announcementColumns.some(
  (column) => column.name === 'voting_remove_vote_limit',
);
if (!hasVotingRemoveLimit) {
  sqlite.exec(
    'ALTER TABLE announcements ADD COLUMN voting_remove_vote_limit INTEGER;',
  );
}

const hasFormQuestions = announcementColumns.some(
  (column) => column.name === 'form_questions_json',
);
if (!hasFormQuestions) {
  sqlite.exec(
    'ALTER TABLE announcements ADD COLUMN form_questions_json TEXT;',
  );
}
const hasFormSubmissionLimit = announcementColumns.some(
  (column) => column.name === 'form_submission_limit',
);
if (!hasFormSubmissionLimit) {
  sqlite.exec(
    'ALTER TABLE announcements ADD COLUMN form_submission_limit TEXT;',
  );
}
const hasFormPrice = announcementColumns.some(
  (column) => column.name === 'form_price',
);
if (!hasFormPrice) {
  sqlite.exec('ALTER TABLE announcements ADD COLUMN form_price REAL;');
}

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
const hasOverrideUserId = overrideColumns.some(
  (column) => column.name === 'override_user_id',
);
if (!hasOverrideUserId) {
  sqlite.exec(
    'ALTER TABLE schedule_event_overrides ADD COLUMN override_user_id TEXT;',
  );
}
const hasOverrideUserName = overrideColumns.some(
  (column) => column.name === 'override_user_name',
);
if (!hasOverrideUserName) {
  sqlite.exec(
    'ALTER TABLE schedule_event_overrides ADD COLUMN override_user_name TEXT;',
  );
}

const historyTableExists = sqlite
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='schedule_event_override_history'",
  )
  .get();
if (!historyTableExists) {
  sqlite.exec(`
    CREATE TABLE schedule_event_override_history (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      event_type TEXT NOT NULL,
      changed_at INTEGER NOT NULL,
      changed_by TEXT,
      previous_override_user_id TEXT,
      previous_override_user_name TEXT,
      previous_time TEXT,
      previous_moved_to_date TEXT,
      previous_is_canceled INTEGER,
      next_override_user_id TEXT,
      next_override_user_name TEXT,
      next_time TEXT,
      next_moved_to_date TEXT,
      next_is_canceled INTEGER
    );
    CREATE INDEX idx_schedule_event_override_history_event ON schedule_event_override_history(date, event_type);
    CREATE INDEX idx_schedule_event_override_history_changed ON schedule_event_override_history(changed_at);
  `);
}

const formSubmissionsTableExists = sqlite
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='form_submissions'",
  )
  .get();
if (!formSubmissionsTableExists) {
  sqlite.exec(`
    CREATE TABLE form_submissions (
      id TEXT PRIMARY KEY,
      announcement_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT,
      answers_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      paypal_order_id TEXT,
      payment_amount REAL
    );
    CREATE INDEX idx_form_submissions_announcement ON form_submissions(announcement_id);
    CREATE INDEX idx_form_submissions_user ON form_submissions(announcement_id, user_id);
  `);
}

export const db = drizzle(sqlite);
export { sqlite };
