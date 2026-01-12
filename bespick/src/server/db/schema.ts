import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const announcements = sqliteTable(
  'announcements',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    eventType: text('event_type').notNull(),
    createdAt: integer('created_at', { mode: 'number' }).notNull(),
    publishAt: integer('publish_at', { mode: 'number' }).notNull(),
    status: text('status').notNull(),
    createdBy: text('created_by'),
    updatedAt: integer('updated_at', { mode: 'number' }),
    updatedBy: text('updated_by'),
    autoDeleteAt: integer('auto_delete_at', { mode: 'number' }),
    autoArchiveAt: integer('auto_archive_at', { mode: 'number' }),
    pollQuestion: text('poll_question'),
    pollOptionsJson: text('poll_options_json'),
    pollAnonymous: integer('poll_anonymous', { mode: 'boolean' }),
    pollAllowAdditionalOptions: integer('poll_allow_additional_options', {
      mode: 'boolean',
    }),
    pollMaxSelections: integer('poll_max_selections', { mode: 'number' }),
    pollClosesAt: integer('poll_closes_at', { mode: 'number' }),
    votingParticipantsJson: text('voting_participants_json'),
    votingAddVotePrice: real('voting_add_vote_price'),
    votingRemoveVotePrice: real('voting_remove_vote_price'),
    votingAllowedGroupsJson: text('voting_allowed_groups_json'),
    votingAllowedPortfoliosJson: text('voting_allowed_portfolios_json'),
    votingAllowUngrouped: integer('voting_allow_ungrouped', {
      mode: 'boolean',
    }),
    votingAllowRemovals: integer('voting_allow_removals', { mode: 'boolean' }),
    votingLeaderboardMode: text('voting_leaderboard_mode'),
    imageIdsJson: text('image_ids_json'),
  },
  (table) => ({
    publishAtIdx: index('idx_announcements_publish_at').on(
      table.status,
      table.publishAt,
    ),
    eventTypeIdx: index('idx_announcements_event_type').on(table.eventType),
  }),
);

export const pollVotes = sqliteTable(
  'poll_votes',
  {
    id: text('id').primaryKey(),
    announcementId: text('announcement_id').notNull(),
    userId: text('user_id').notNull(),
    userName: text('user_name'),
    selectionsJson: text('selections_json').notNull(),
    createdAt: integer('created_at', { mode: 'number' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
  },
  (table) => ({
    announcementIdx: index('idx_poll_votes_announcement').on(table.announcementId),
    userIdx: index('idx_poll_votes_user').on(
      table.announcementId,
      table.userId,
    ),
  }),
);

export const uploads = sqliteTable('uploads', {
  id: text('id').primaryKey(),
  filename: text('filename').notNull(),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
});

export type AnnouncementRow = typeof announcements.$inferSelect;
export type AnnouncementInsert = typeof announcements.$inferInsert;
export type PollVoteRow = typeof pollVotes.$inferSelect;
export type PollVoteInsert = typeof pollVotes.$inferInsert;
