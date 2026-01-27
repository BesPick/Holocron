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
    votingAddVoteLimit: integer('voting_add_vote_limit', { mode: 'number' }),
    votingRemoveVoteLimit: integer('voting_remove_vote_limit', {
      mode: 'number',
    }),
    votingAllowedGroupsJson: text('voting_allowed_groups_json'),
    votingAllowedPortfoliosJson: text('voting_allowed_portfolios_json'),
    votingAllowUngrouped: integer('voting_allow_ungrouped', {
      mode: 'boolean',
    }),
    votingAllowRemovals: integer('voting_allow_removals', { mode: 'boolean' }),
    votingLeaderboardMode: text('voting_leaderboard_mode'),
    formQuestionsJson: text('form_questions_json'),
    formSubmissionLimit: text('form_submission_limit'),
    formPrice: real('form_price'),
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

export const votingPurchases = sqliteTable(
  'voting_purchases',
  {
    id: text('id').primaryKey(),
    announcementId: text('announcement_id').notNull(),
    userId: text('user_id').notNull(),
    addVotes: integer('add_votes', { mode: 'number' }).notNull(),
    removeVotes: integer('remove_votes', { mode: 'number' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
  },
  (table) => ({
    announcementIdx: index('idx_voting_purchases_announcement').on(
      table.announcementId,
    ),
    userIdx: index('idx_voting_purchases_user').on(
      table.announcementId,
      table.userId,
    ),
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

export const formSubmissions = sqliteTable(
  'form_submissions',
  {
    id: text('id').primaryKey(),
    announcementId: text('announcement_id').notNull(),
    userId: text('user_id').notNull(),
    userName: text('user_name'),
    answersJson: text('answers_json').notNull(),
    createdAt: integer('created_at', { mode: 'number' }).notNull(),
    paypalOrderId: text('paypal_order_id'),
    paymentAmount: real('payment_amount'),
  },
  (table) => ({
    announcementIdx: index('idx_form_submissions_announcement').on(
      table.announcementId,
    ),
    userIdx: index('idx_form_submissions_user').on(
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

export const siteSettings = sqliteTable('site_settings', {
  id: text('id').primaryKey(),
  configJson: text('config_json').notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
  updatedBy: text('updated_by'),
});

export const demoDayAssignments = sqliteTable(
  'demo_day_assignments',
  {
    date: text('date').primaryKey(),
    userId: text('user_id'),
    userName: text('user_name').notNull(),
    assignedAt: integer('assigned_at', { mode: 'number' }).notNull(),
  },
  (table) => ({
    userIdx: index('idx_demo_day_assignments_user').on(table.userId),
  }),
);

export const standupAssignments = sqliteTable(
  'standup_assignments',
  {
    date: text('date').primaryKey(),
    userId: text('user_id'),
    userName: text('user_name').notNull(),
    assignedAt: integer('assigned_at', { mode: 'number' }).notNull(),
  },
  (table) => ({
    userIdx: index('idx_standup_assignments_user').on(table.userId),
  }),
);

export const securityShiftAssignments = sqliteTable(
  'security_shift_assignments',
  {
    id: text('id').primaryKey(),
    date: text('date').notNull(),
    eventType: text('event_type').notNull(),
    userId: text('user_id'),
    userName: text('user_name').notNull(),
    assignedAt: integer('assigned_at', { mode: 'number' }).notNull(),
  },
  (table) => ({
    dateIdx: index('idx_security_shift_assignments_date').on(table.date),
    typeIdx: index('idx_security_shift_assignments_type').on(table.eventType),
    userIdx: index('idx_security_shift_assignments_user').on(table.userId),
  }),
);

export const building892Assignments = sqliteTable(
  'building_892_assignments',
  {
    weekStart: text('week_start').primaryKey(),
    team: text('team').notNull(),
    assignedAt: integer('assigned_at', { mode: 'number' }).notNull(),
  },
  (table) => ({
    teamIdx: index('idx_building_892_assignments_team').on(table.team),
  }),
);

export const scheduleRules = sqliteTable('schedule_rules', {
  id: text('id').primaryKey(),
  configJson: text('config_json').notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
  updatedBy: text('updated_by'),
});

export const scheduleRefresh = sqliteTable('schedule_refresh', {
  id: text('id').primaryKey(),
  pendingSince: integer('pending_since', { mode: 'number' }),
  refreshedAt: integer('refreshed_at', { mode: 'number' }),
});

export const scheduleEventOverrides = sqliteTable(
  'schedule_event_overrides',
  {
    id: text('id').primaryKey(),
    date: text('date').notNull(),
    eventType: text('event_type').notNull(),
    movedToDate: text('moved_to_date'),
    time: text('time'),
    isCanceled: integer('is_canceled', { mode: 'boolean' }).notNull(),
    overrideUserId: text('override_user_id'),
    overrideUserName: text('override_user_name'),
    updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
    updatedBy: text('updated_by'),
  },
  (table) => ({
    dateIdx: index('idx_schedule_event_overrides_date').on(table.date),
    typeIdx: index('idx_schedule_event_overrides_type').on(table.eventType),
  }),
);

export const scheduleEventOverrideHistory = sqliteTable(
  'schedule_event_override_history',
  {
    id: text('id').primaryKey(),
    date: text('date').notNull(),
    eventType: text('event_type').notNull(),
    changedAt: integer('changed_at', { mode: 'number' }).notNull(),
    changedBy: text('changed_by'),
    previousOverrideUserId: text('previous_override_user_id'),
    previousOverrideUserName: text('previous_override_user_name'),
    previousTime: text('previous_time'),
    previousMovedToDate: text('previous_moved_to_date'),
    previousIsCanceled: integer('previous_is_canceled', { mode: 'boolean' }),
    nextOverrideUserId: text('next_override_user_id'),
    nextOverrideUserName: text('next_override_user_name'),
    nextTime: text('next_time'),
    nextMovedToDate: text('next_moved_to_date'),
    nextIsCanceled: integer('next_is_canceled', { mode: 'boolean' }),
  },
  (table) => ({
    eventIdx: index('idx_schedule_event_override_history_event').on(
      table.date,
      table.eventType,
    ),
    changedAtIdx: index('idx_schedule_event_override_history_changed').on(
      table.changedAt,
    ),
  }),
);

export const shiftNotifications = sqliteTable(
  'shift_notifications',
  {
    id: text('id').primaryKey(),
    eventType: text('event_type').notNull(),
    eventDate: text('event_date').notNull(),
    userId: text('user_id').notNull(),
    sentAt: integer('sent_at', { mode: 'number' }).notNull(),
  },
  (table) => ({
    eventIdx: index('idx_shift_notifications_event').on(
      table.eventDate,
      table.eventType,
    ),
    userIdx: index('idx_shift_notifications_user').on(table.userId),
  }),
);

export type AnnouncementRow = typeof announcements.$inferSelect;
export type AnnouncementInsert = typeof announcements.$inferInsert;
export type VotingPurchaseRow = typeof votingPurchases.$inferSelect;
export type VotingPurchaseInsert = typeof votingPurchases.$inferInsert;
export type PollVoteRow = typeof pollVotes.$inferSelect;
export type PollVoteInsert = typeof pollVotes.$inferInsert;
export type FormSubmissionRow = typeof formSubmissions.$inferSelect;
export type FormSubmissionInsert = typeof formSubmissions.$inferInsert;
export type SiteSettingRow = typeof siteSettings.$inferSelect;
export type SiteSettingInsert = typeof siteSettings.$inferInsert;
export type DemoDayAssignmentRow = typeof demoDayAssignments.$inferSelect;
export type DemoDayAssignmentInsert = typeof demoDayAssignments.$inferInsert;
export type StandupAssignmentRow = typeof standupAssignments.$inferSelect;
export type StandupAssignmentInsert = typeof standupAssignments.$inferInsert;
export type SecurityShiftAssignmentRow =
  typeof securityShiftAssignments.$inferSelect;
export type SecurityShiftAssignmentInsert =
  typeof securityShiftAssignments.$inferInsert;
export type Building892AssignmentRow =
  typeof building892Assignments.$inferSelect;
export type Building892AssignmentInsert =
  typeof building892Assignments.$inferInsert;
export type ScheduleRuleRow = typeof scheduleRules.$inferSelect;
export type ScheduleRuleInsert = typeof scheduleRules.$inferInsert;
export type ScheduleRefreshRow = typeof scheduleRefresh.$inferSelect;
export type ScheduleRefreshInsert = typeof scheduleRefresh.$inferInsert;
export type ScheduleEventOverrideRow =
  typeof scheduleEventOverrides.$inferSelect;
export type ScheduleEventOverrideInsert =
  typeof scheduleEventOverrides.$inferInsert;
export type ScheduleEventOverrideHistoryRow =
  typeof scheduleEventOverrideHistory.$inferSelect;
export type ScheduleEventOverrideHistoryInsert =
  typeof scheduleEventOverrideHistory.$inferInsert;
export type ShiftNotificationRow = typeof shiftNotifications.$inferSelect;
export type ShiftNotificationInsert = typeof shiftNotifications.$inferInsert;
