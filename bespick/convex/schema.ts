import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  announcements: defineTable({
    title: v.string(),
    description: v.string(),
    eventType: v.union(
      v.literal('announcements'),
      v.literal('poll'),
      v.literal('voting')
    ),
    createdAt: v.number(), // epoch ms
    publishAt: v.number(), // epoch ms
    status: v.union(
      v.literal('published'),
      v.literal('scheduled'),
      v.literal('archived')
    ),
    createdBy: v.optional(v.string()),
    updatedAt: v.optional(v.number()),
    updatedBy: v.optional(v.string()),
    autoDeleteAt: v.optional(v.union(v.number(), v.null())),
    autoArchiveAt: v.optional(v.union(v.number(), v.null())),
    pollQuestion: v.optional(v.string()),
    pollOptions: v.optional(v.array(v.string())),
    pollAnonymous: v.optional(v.boolean()),
    pollAllowAdditionalOptions: v.optional(v.boolean()),
    pollMaxSelections: v.optional(v.number()),
    pollClosesAt: v.optional(v.number()),
    votingParticipants: v.optional(
      v.array(
        v.object({
          userId: v.string(),
          firstName: v.string(),
          lastName: v.string(),
          group: v.optional(v.union(v.string(), v.null())),
          portfolio: v.optional(v.union(v.string(), v.null())),
          votes: v.optional(v.number()),
        }),
      ),
    ),
    votingAddVotePrice: v.optional(v.number()),
    votingRemoveVotePrice: v.optional(v.number()),
    votingAllowedGroups: v.optional(v.array(v.string())),
    votingAllowedPortfolios: v.optional(v.array(v.string())),
    votingAllowUngrouped: v.optional(v.boolean()),
    votingAllowRemovals: v.optional(v.boolean()),
    votingLeaderboardMode: v.optional(v.string()),
    imageIds: v.optional(v.array(v.id('_storage'))),
  })
    .index('by_publishAt', ['status', 'publishAt']) // for schedulers/feeds
    .index('by_type', ['eventType']),
  pollVotes: defineTable({
    announcementId: v.id('announcements'),
    userId: v.string(),
    userName: v.optional(v.string()),
    selections: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_announcement', ['announcementId'])
    .index('by_announcement_user', ['announcementId', 'userId']),
});
