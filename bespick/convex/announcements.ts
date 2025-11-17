import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

type VotingParticipant = {
  userId: string;
  firstName: string;
  lastName: string;
  group?: string | null;
  portfolio?: string | null;
  votes?: number | null;
};

type VotingLeaderboardMode = 'all' | 'group' | 'group_portfolio';

function normalizeVotingParticipants(
  participants: VotingParticipant[] | undefined,
): VotingParticipant[] {
  if (!Array.isArray(participants)) return [];
  const seen = new Set<string>();
  const normalized: VotingParticipant[] = [];
  for (const participant of participants) {
    const userId = participant.userId?.trim();
    if (!userId || seen.has(userId)) continue;
    const firstName = (participant.firstName ?? '').trim();
    const lastName = (participant.lastName ?? '').trim();
    seen.add(userId);
    normalized.push({
      userId,
      firstName,
      lastName,
      group:
        typeof participant.group === 'string' || participant.group === null
          ? participant.group
          : null,
      portfolio:
        typeof participant.portfolio === 'string' ||
        participant.portfolio === null
          ? participant.portfolio
          : null,
      votes:
        typeof participant.votes === 'number' &&
        Number.isFinite(participant.votes)
          ? Math.max(0, Math.floor(participant.votes))
          : 0,
    });
  }
  return normalized;
}

function resetVotingParticipantVotes(
  participants: VotingParticipant[] | null | undefined,
) {
  if (!Array.isArray(participants)) return [];
  return participants.map((participant) => ({
    ...participant,
    votes: 0,
  }));
}

function normalizePrice(
  value: number | null | undefined,
  label: string,
): number {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
    throw new Error(`${label} must be a non-negative number.`);
  }
  return Math.round(value * 100) / 100;
}

function normalizeLeaderboardMode(
  value: unknown,
  fallback: VotingLeaderboardMode,
): VotingLeaderboardMode {
  const allowed: VotingLeaderboardMode[] = ['all', 'group', 'group_portfolio'];
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (allowed.includes(lower as VotingLeaderboardMode)) {
      return lower as VotingLeaderboardMode;
    }
  }
  return fallback;
}

export const create = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    publishAt: v.number(), // epoch ms (client decides now vs scheduled)
    autoDeleteAt: v.optional(v.union(v.number(), v.null())),
    autoArchiveAt: v.optional(v.union(v.number(), v.null())),
    pollQuestion: v.optional(v.string()),
    pollOptions: v.optional(v.array(v.string())),
    pollAnonymous: v.optional(v.boolean()),
    pollAllowAdditionalOptions: v.optional(v.boolean()),
    pollMaxSelections: v.optional(v.number()),
    pollClosesAt: v.optional(v.union(v.number(), v.null())),
    votingParticipants: v.optional(
      v.array(
        v.object({
          userId: v.string(),
          firstName: v.string(),
          lastName: v.string(),
          group: v.optional(v.union(v.string(), v.null())),
          portfolio: v.optional(v.union(v.string(), v.null())),
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
    eventType: v.optional(
      v.union(
        v.literal('announcements'),
        v.literal('poll'),
        v.literal('voting')
      )
    ),
    imageIds: v.optional(v.array(v.id('_storage'))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const now = Date.now();

    const cleanedTitle = args.title.trim();
    const cleanedDescription = args.description.trim();

    if (!cleanedTitle) throw new Error('Title is required');

    const eventType =
      args.eventType === 'poll' || args.eventType === 'voting'
        ? args.eventType
        : 'announcements';

    if (!cleanedDescription && eventType === 'announcements') {
      throw new Error('Description is required');
    }

    const status = args.publishAt <= now ? 'published' : 'scheduled';
    const normalizedAutoDeleteAt =
      typeof args.autoDeleteAt === 'number' ? args.autoDeleteAt : null;
    const normalizedAutoArchiveAt =
      typeof args.autoArchiveAt === 'number' ? args.autoArchiveAt : null;

    if (
      normalizedAutoDeleteAt !== null &&
      normalizedAutoDeleteAt <= args.publishAt
    ) {
      throw new Error('Auto delete time must be after publish time.');
    }

    if (
      normalizedAutoArchiveAt !== null &&
      normalizedAutoArchiveAt <= args.publishAt
    ) {
      throw new Error('Auto archive time must be after publish time.');
    }

    if (
      normalizedAutoDeleteAt !== null &&
      normalizedAutoArchiveAt !== null
    ) {
      throw new Error('Choose either auto delete or auto archive, not both.');
    }

    let pollQuestion: string | null = null;
    let pollOptions: string[] | null = null;
    let pollAnonymous = false;
    let pollAllowAdditionalOptions = false;
    let pollMaxSelections = 1;
    let pollClosesAt: number | null = null;
    if (eventType === 'poll') {
      const questionInput = (args.pollQuestion ?? '').trim();
      if (!questionInput) {
        throw new Error('Poll question is required.');
      }
      if (questionInput.length > 100) {
        throw new Error('Poll question must be 100 characters or fewer.');
      }
      const optionInput = (args.pollOptions ?? []).map((option) =>
        option.trim()
      );
      const filteredOptions = optionInput.filter((option) => option.length > 0);
      if (filteredOptions.length < 2) {
        throw new Error('Polls require at least two options.');
      }
      pollQuestion = questionInput;
      pollOptions = filteredOptions;
      pollAnonymous = Boolean(args.pollAnonymous);
      pollAllowAdditionalOptions = Boolean(
        args.pollAllowAdditionalOptions,
      );
      const rawMaxSelections =
        typeof args.pollMaxSelections === 'number'
          ? Math.max(1, Math.floor(args.pollMaxSelections))
          : 1;
      pollMaxSelections = Math.max(
        1,
        Math.min(rawMaxSelections, pollOptions.length),
      );
      pollClosesAt =
        typeof args.pollClosesAt === 'number' ? args.pollClosesAt : null;
      if (pollClosesAt !== null && pollClosesAt <= args.publishAt) {
        throw new Error('Poll close time must be after the publish time.');
      }
    }

    let votingParticipants: VotingParticipant[] | null = null;
    let votingAddVotePrice: number | null = null;
    let votingRemoveVotePrice: number | null = null;
    let votingAllowedGroups: string[] | null = null;
    let votingAllowedPortfolios: string[] | null = null;
    let votingAllowUngrouped = false;
    let votingAllowRemovals = true;
    let votingLeaderboardMode: VotingLeaderboardMode = 'all';
    if (eventType === 'voting') {
      const participants = normalizeVotingParticipants(
        args.votingParticipants,
      );
      if (participants.length === 0) {
        throw new Error('Voting events require at least one participant.');
      }
      votingParticipants = participants;
      votingAddVotePrice = normalizePrice(
        args.votingAddVotePrice,
        'Price to add a vote',
      );
      votingAllowRemovals =
        typeof args.votingAllowRemovals === 'boolean'
          ? args.votingAllowRemovals
          : true;
      if (votingAllowRemovals) {
        votingRemoveVotePrice = normalizePrice(
          args.votingRemoveVotePrice,
          'Price to remove a vote',
        );
      } else {
        votingRemoveVotePrice = null;
      }
      const allowedGroups = Array.isArray(args.votingAllowedGroups)
        ? Array.from(new Set(args.votingAllowedGroups))
        : [];
      const allowedPortfolios = Array.isArray(args.votingAllowedPortfolios)
        ? Array.from(new Set(args.votingAllowedPortfolios))
        : [];
      votingAllowedGroups = allowedGroups;
      votingAllowedPortfolios = allowedPortfolios;
      votingAllowUngrouped = Boolean(args.votingAllowUngrouped);
      votingLeaderboardMode = normalizeLeaderboardMode(
        args.votingLeaderboardMode,
        'all',
      );
    }

    const providedImageIds =
      Array.isArray(args.imageIds) && args.imageIds.length > 0
        ? args.imageIds
        : [];
    if (providedImageIds.length > 5) {
      throw new Error('You can upload up to five images.');
    }
    const normalizedImageIds = Array.from(new Set(providedImageIds));

    const id = await ctx.db.insert('announcements', {
      title: cleanedTitle,
      description: cleanedDescription,
      eventType,
      createdAt: now,
      publishAt: args.publishAt,
      status,
      createdBy: identity?.name?.toString(),
      autoDeleteAt: normalizedAutoDeleteAt,
      autoArchiveAt: normalizedAutoArchiveAt,
      pollQuestion: pollQuestion ?? undefined,
      pollOptions: pollOptions ?? undefined,
      pollAnonymous: eventType === 'poll' ? pollAnonymous : undefined,
      pollAllowAdditionalOptions:
        eventType === 'poll' ? pollAllowAdditionalOptions : undefined,
      pollMaxSelections:
        eventType === 'poll' ? pollMaxSelections : undefined,
      pollClosesAt:
        eventType === 'poll' ? pollClosesAt ?? undefined : undefined,
      votingParticipants:
        eventType === 'voting' ? votingParticipants ?? undefined : undefined,
      votingAddVotePrice:
        eventType === 'voting'
          ? votingAddVotePrice ?? undefined
          : undefined,
      votingRemoveVotePrice:
        eventType === 'voting'
          ? votingRemoveVotePrice ?? undefined
          : undefined,
      votingAllowedGroups:
        eventType === 'voting'
          ? votingAllowedGroups ?? undefined
          : undefined,
      votingAllowedPortfolios:
        eventType === 'voting'
          ? votingAllowedPortfolios ?? undefined
          : undefined,
      votingAllowUngrouped:
        eventType === 'voting' ? votingAllowUngrouped : undefined,
      votingAllowRemovals:
        eventType === 'voting' ? votingAllowRemovals : undefined,
      votingLeaderboardMode:
        eventType === 'voting' ? votingLeaderboardMode : undefined,
      imageIds: normalizedImageIds.length ? normalizedImageIds : undefined,
    });

    return { id, status };
  },
});

export const get = query({
  args: {
    id: v.id('announcements'),
  },
  handler: async (ctx, args) => {
    return ctx.db.get(args.id);
  },
});

export const list = query({
  args: {
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const announcements = await ctx.db
      .query('announcements')
      .filter((q) =>
        q.and(
          q.neq(q.field('status'), 'archived'),
          q.or(
            q.eq(q.field('status'), 'published'),
            q.lte(q.field('publishAt'), args.now),
          ),
        ),
      )
      .collect();
    const normalized = announcements.map((announcement) =>
      announcement.status === 'scheduled' &&
      announcement.publishAt <= args.now
        ? { ...announcement, status: 'published' as const }
        : announcement,
    );
    return normalized.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const listArchived = query({
  args: {},
  handler: async (ctx) => {
    const announcements = await ctx.db
      .query('announcements')
      .filter((q) => q.eq(q.field('status'), 'archived'))
      .collect();
    return announcements.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const listScheduled = query({
  args: {
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const scheduled = await ctx.db
      .query('announcements')
      .withIndex('by_publishAt', (q) => q.eq('status', 'scheduled'))
      .filter((q) => q.gt(q.field('publishAt'), args.now))
      .collect();
    return scheduled.sort((a, b) => a.publishAt - b.publishAt);
  },
});

export const update = mutation({
  args: {
    id: v.id('announcements'),
    title: v.string(),
    description: v.string(),
    publishAt: v.number(),
    autoDeleteAt: v.optional(v.union(v.number(), v.null())),
    autoArchiveAt: v.optional(v.union(v.number(), v.null())),
    pollQuestion: v.optional(v.string()),
    pollOptions: v.optional(v.array(v.string())),
    pollAnonymous: v.optional(v.boolean()),
    pollAllowAdditionalOptions: v.optional(v.boolean()),
    pollMaxSelections: v.optional(v.number()),
    pollClosesAt: v.optional(v.union(v.number(), v.null())),
    votingParticipants: v.optional(
      v.array(
        v.object({
          userId: v.string(),
          firstName: v.string(),
          lastName: v.string(),
          group: v.optional(v.union(v.string(), v.null())),
          portfolio: v.optional(v.union(v.string(), v.null())),
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
    eventType: v.optional(
      v.union(
        v.literal('announcements'),
        v.literal('poll'),
        v.literal('voting'),
      ),
    ),
    imageIds: v.optional(v.array(v.id('_storage'))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error('Activity not found');

    const now = Date.now();
    const cleanedTitle = args.title.trim();
    const cleanedDescription = args.description.trim();
    if (!cleanedTitle) throw new Error('Title is required');
    const eventType =
      args.eventType === 'poll' || args.eventType === 'voting'
        ? args.eventType
        : existing.eventType;
    if (!cleanedDescription && eventType === 'announcements') {
      throw new Error('Description is required');
    }

    const status = args.publishAt <= now ? 'published' : 'scheduled';

    const requestedAutoDeleteAt =
      typeof args.autoDeleteAt === 'number'
        ? args.autoDeleteAt
        : args.autoDeleteAt === null
          ? null
          : existing.autoDeleteAt ?? null;
    const requestedAutoArchiveAt =
      typeof args.autoArchiveAt === 'number'
        ? args.autoArchiveAt
        : args.autoArchiveAt === null
          ? null
          : existing.autoArchiveAt ?? null;

    if (
      requestedAutoDeleteAt !== null &&
      requestedAutoDeleteAt <= args.publishAt
    ) {
      throw new Error('Auto delete time must be after publish time.');
    }

    if (
      requestedAutoArchiveAt !== null &&
      requestedAutoArchiveAt <= args.publishAt
    ) {
      throw new Error('Auto archive time must be after publish time.');
    }

    if (
      requestedAutoDeleteAt !== null &&
      requestedAutoArchiveAt !== null
    ) {
      throw new Error('Choose either auto delete or auto archive, not both.');
    }

    let pollQuestion: string | null = null;
    let pollOptions: string[] | null = null;
    const pollAnonymous =
      typeof args.pollAnonymous === 'boolean'
        ? args.pollAnonymous
        : existing.pollAnonymous ?? false;
    const pollAllowAdditionalOptions =
      typeof args.pollAllowAdditionalOptions === 'boolean'
        ? args.pollAllowAdditionalOptions
        : existing.pollAllowAdditionalOptions ?? false;
    let pollMaxSelections =
      typeof args.pollMaxSelections === 'number'
        ? Math.max(1, Math.floor(args.pollMaxSelections))
        : existing.pollMaxSelections ?? 1;
    const pollClosesAt =
      typeof args.pollClosesAt === 'number'
        ? args.pollClosesAt
        : args.pollClosesAt === null
          ? null
          : existing.pollClosesAt ?? null;
    if (eventType === 'poll') {
      const questionInput =
        typeof args.pollQuestion === 'string'
          ? args.pollQuestion.trim()
          : existing.pollQuestion?.trim() ?? '';
      if (!questionInput) {
        throw new Error('Poll question is required.');
      }
      if (questionInput.length > 100) {
        throw new Error('Poll question must be 100 characters or fewer.');
      }
      const incomingOptions =
        args.pollOptions ??
        (Array.isArray(existing.pollOptions) ? existing.pollOptions : []);
      const cleanedOptions = incomingOptions.map((option) => option.trim());
      const filteredOptions = cleanedOptions.filter((option) => option.length > 0);
      if (filteredOptions.length < 2) {
        throw new Error('Polls require at least two options.');
      }
      pollQuestion = questionInput;
      pollOptions = filteredOptions;
      pollMaxSelections = Math.max(
        1,
        Math.min(pollMaxSelections, filteredOptions.length),
      );
      if (pollClosesAt !== null && pollClosesAt <= args.publishAt) {
        throw new Error('Poll close time must be after the publish time.');
      }
    }

    let votingParticipants: VotingParticipant[] | null = null;
    let votingAllowedGroups: string[] | null = null;
    let votingAllowedPortfolios: string[] | null = null;
    let votingAllowUngrouped = existing.votingAllowUngrouped ?? false;
    let votingAllowRemovals = existing.votingAllowRemovals ?? true;
    let votingLeaderboardMode: VotingLeaderboardMode = normalizeLeaderboardMode(
      existing.votingLeaderboardMode,
      'all',
    );
    let votingAddVotePrice: number | null = null;
    let votingRemoveVotePrice: number | null = null;
    if (eventType === 'voting') {
      const existingParticipants = normalizeVotingParticipants(
        existing.votingParticipants ?? [],
      );
      const incomingParticipants = normalizeVotingParticipants(
        args.votingParticipants,
      );
      const participantMap = new Map(
        existingParticipants.map((participant) => [participant.userId, participant]),
      );
      if (incomingParticipants.length > 0) {
        for (const participant of incomingParticipants) {
          const existingParticipant = participantMap.get(participant.userId);
          if (existingParticipant) {
            participantMap.set(participant.userId, {
              ...existingParticipant,
              firstName: participant.firstName || existingParticipant.firstName,
              lastName: participant.lastName || existingParticipant.lastName,
              group:
                typeof participant.group === 'string'
                  ? participant.group
                  : existingParticipant.group ?? null,
              portfolio:
                typeof participant.portfolio === 'string'
                  ? participant.portfolio
                  : existingParticipant.portfolio ?? null,
            });
          } else {
            participantMap.set(participant.userId, participant);
          }
        }
      }
      const participants = Array.from(participantMap.values());
      if (participants.length === 0) {
        throw new Error('Voting events require at least one participant.');
      }
      votingParticipants = participants;
      votingAddVotePrice = normalizePrice(
        typeof args.votingAddVotePrice === 'number'
          ? args.votingAddVotePrice
          : existing.votingAddVotePrice,
        'Price to add a vote',
      );
      votingAllowRemovals =
        typeof args.votingAllowRemovals === 'boolean'
          ? args.votingAllowRemovals
          : votingAllowRemovals;
      if (votingAllowRemovals) {
        votingRemoveVotePrice = normalizePrice(
          typeof args.votingRemoveVotePrice === 'number'
            ? args.votingRemoveVotePrice
            : existing.votingRemoveVotePrice,
          'Price to remove a vote',
        );
      } else {
        votingRemoveVotePrice = null;
      }
      const allowedGroupsInput =
        args.votingAllowedGroups ?? existing.votingAllowedGroups ?? [];
      const allowedPortfoliosInput =
        args.votingAllowedPortfolios ?? existing.votingAllowedPortfolios ?? [];
      votingAllowedGroups = Array.isArray(allowedGroupsInput)
        ? Array.from(new Set(allowedGroupsInput))
        : [];
      votingAllowedPortfolios = Array.isArray(allowedPortfoliosInput)
        ? Array.from(new Set(allowedPortfoliosInput))
        : [];
      votingAllowUngrouped =
        typeof args.votingAllowUngrouped === 'boolean'
          ? args.votingAllowUngrouped
          : Boolean(existing.votingAllowUngrouped);
      votingLeaderboardMode = normalizeLeaderboardMode(
        args.votingLeaderboardMode,
        votingLeaderboardMode,
      );
    }

    const providedImageIds =
      Array.isArray(args.imageIds) && args.imageIds.length > 0
        ? args.imageIds
        : existing.imageIds ?? [];
    if (providedImageIds.length > 5) {
      throw new Error('You can upload up to five images.');
    }
    const normalizedImageIds = Array.from(new Set(providedImageIds));

    const updatedBy =
      identity?.name ??
      identity?.tokenIdentifier ??
      identity?.subject ??
      'anonymous';

    await ctx.db.patch(args.id, {
      title: cleanedTitle,
      description: cleanedDescription,
      publishAt: args.publishAt,
      status,
      eventType,
      updatedAt: now,
      updatedBy,
      autoDeleteAt: requestedAutoDeleteAt,
      autoArchiveAt: requestedAutoArchiveAt,
      pollQuestion:
        eventType === 'poll'
          ? pollQuestion ?? existing.pollQuestion ?? undefined
          : undefined,
      pollOptions:
        eventType === 'poll'
          ? pollOptions ?? existing.pollOptions ?? undefined
          : undefined,
      pollAnonymous:
        eventType === 'poll'
          ? pollAnonymous
          : undefined,
      pollAllowAdditionalOptions:
        eventType === 'poll'
          ? pollAllowAdditionalOptions
          : undefined,
      pollMaxSelections:
        eventType === 'poll'
          ? pollMaxSelections
          : undefined,
      pollClosesAt:
        eventType === 'poll'
          ? pollClosesAt ?? undefined
          : undefined,
      votingParticipants:
        eventType === 'voting'
          ? votingParticipants ?? existing.votingParticipants ?? undefined
          : undefined,
      votingAddVotePrice:
        eventType === 'voting'
          ? votingAddVotePrice ?? existing.votingAddVotePrice ?? undefined
          : undefined,
      votingRemoveVotePrice:
        eventType === 'voting'
          ? votingRemoveVotePrice ?? existing.votingRemoveVotePrice ?? undefined
          : undefined,
      votingAllowedGroups:
        eventType === 'voting'
          ? votingAllowedGroups ?? existing.votingAllowedGroups ?? undefined
          : undefined,
      votingAllowedPortfolios:
        eventType === 'voting'
          ? votingAllowedPortfolios ?? existing.votingAllowedPortfolios ?? undefined
          : undefined,
      votingAllowUngrouped:
        eventType === 'voting'
          ? votingAllowUngrouped
          : undefined,
      votingAllowRemovals:
        eventType === 'voting'
          ? votingAllowRemovals
          : undefined,
      votingLeaderboardMode:
        eventType === 'voting'
          ? votingLeaderboardMode ?? existing.votingLeaderboardMode ?? 'all'
          : undefined,
      imageIds:
        normalizedImageIds.length > 0 ? normalizedImageIds : undefined,
    });

    return { id: args.id, status };
  },
});

export const publishDue = mutation({
  args: {
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const dueAnnouncements = await ctx.db
      .query('announcements')
      .withIndex('by_publishAt', (q) => q.eq('status', 'scheduled'))
      .filter((q) => q.lte(q.field('publishAt'), args.now))
      .collect();

    await Promise.all(
      dueAnnouncements.map((announcement) =>
        ctx.db.patch(announcement._id, { status: 'published' }),
      ),
    );

    const candidates = await ctx.db.query('announcements').collect();
    const deleteDue = candidates.filter(
      (announcement) =>
        typeof announcement.autoDeleteAt === 'number' &&
        announcement.autoDeleteAt <= args.now,
    );

    await Promise.all(
      deleteDue.map(async (announcement) => {
        if (announcement.eventType === 'voting') {
          await ctx.db.patch(announcement._id, {
            votingParticipants: resetVotingParticipantVotes(
              announcement.votingParticipants,
            ),
          });
        }
        await ctx.db.delete(announcement._id);
      }),
    );

    const archiveDue = candidates.filter(
      (announcement) =>
        announcement.status !== 'archived' &&
        typeof announcement.autoArchiveAt === 'number' &&
        announcement.autoArchiveAt <= args.now,
    );

    await Promise.all(
      archiveDue.map((announcement) => {
        const update: {
          status: 'archived';
          votingParticipants?: VotingParticipant[];
        } = { status: 'archived' };
        if (announcement.eventType === 'voting') {
          update.votingParticipants = resetVotingParticipantVotes(
            announcement.votingParticipants,
          );
        }
        return ctx.db.patch(announcement._id, update);
      }),
    );

    return {
      updated: dueAnnouncements.length,
      deleted: deleteDue.length,
      archived: archiveDue.length,
    };
  },
});

export const getPoll = query({
  args: {
    id: v.id('announcements'),
  },
  handler: async (ctx, args) => {
    const announcement = await ctx.db.get(args.id);
    if (!announcement || announcement.eventType !== 'poll') {
      throw new Error('Poll not found.');
    }

    const identity = await ctx.auth.getUserIdentity();
    const votes = await ctx.db
      .query('pollVotes')
      .withIndex('by_announcement', (q) => q.eq('announcementId', args.id))
      .collect();

    const counts = new Map<string, number>();
    for (const vote of votes) {
      for (const selection of vote.selections) {
        counts.set(selection, (counts.get(selection) ?? 0) + 1);
      }
    }

    const options = (announcement.pollOptions ?? []).map((option) => ({
      value: option,
      votes: counts.get(option) ?? 0,
    }));

    const totalVotes = votes.reduce(
      (sum, vote) => sum + vote.selections.length,
      0,
    );

    const currentUserId = identity?.subject;
    const currentUserSelections = currentUserId
      ? votes.find((vote) => vote.userId === currentUserId)?.selections ?? []
      : [];

    const closesAt = announcement.pollClosesAt ?? null;
    const isClosed =
      typeof closesAt === 'number' ? closesAt <= Date.now() : false;

    return {
      _id: announcement._id,
      question: announcement.pollQuestion ?? announcement.title,
      description: announcement.description,
      options,
      totalVotes,
      pollAnonymous: announcement.pollAnonymous ?? false,
      pollAllowAdditionalOptions:
        announcement.pollAllowAdditionalOptions ?? false,
      pollMaxSelections: announcement.pollMaxSelections ?? 1,
      currentUserSelections,
      closesAt,
      isClosed,
      isArchived: announcement.status === 'archived',
      imageIds: announcement.imageIds ?? [],
    };
  },
});

export const getPollVoteBreakdown = query({
  args: {
    id: v.id('announcements'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const announcement = await ctx.db.get(args.id);
    if (!announcement || announcement.eventType !== 'poll') {
      throw new Error('Poll not found.');
    }

    const votes = await ctx.db
      .query('pollVotes')
      .withIndex('by_announcement', (q) => q.eq('announcementId', args.id))
      .collect();

    const optionMap = new Map<
      string,
      {
        value: string;
        voters: { userId: string; userName: string | null }[];
      }
    >();

    for (const option of announcement.pollOptions ?? []) {
      optionMap.set(option, { value: option, voters: [] });
    }

    for (const vote of votes) {
      for (const selection of vote.selections) {
        if (!optionMap.has(selection)) {
          optionMap.set(selection, { value: selection, voters: [] });
        }
        optionMap.get(selection)!.voters.push({
          userId: vote.userId,
          userName: vote.userName ?? null,
        });
      }
    }

    const options = Array.from(optionMap.values()).map((option) => ({
      value: option.value,
      voters: option.voters,
      voteCount: option.voters.length,
    }));

    const totalVotes = votes.reduce(
      (sum, vote) => sum + vote.selections.length,
      0,
    );

    return {
      pollId: announcement._id,
      options,
      totalVotes,
    };
  },
});

export const votePoll = mutation({
  args: {
    id: v.id('announcements'),
    selections: v.array(v.string()),
    newOption: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const announcement = await ctx.db.get(args.id);
    if (!announcement || announcement.eventType !== 'poll') {
      throw new Error('Poll not found.');
    }

    const now = Date.now();
    const options = [...(announcement.pollOptions ?? [])];

    if (
      typeof announcement.pollClosesAt === 'number' &&
      announcement.pollClosesAt <= now
    ) {
      throw new Error('This poll has closed.');
    }
    if (announcement.status === 'archived') {
      throw new Error('This poll is archived and read-only.');
    }

    let newOptionValue: string | null = null;
    if (args.newOption && args.newOption.trim().length > 0) {
      if (!announcement.pollAllowAdditionalOptions) {
        throw new Error('Adding options is not allowed for this poll.');
      }
      const trimmed = args.newOption.trim();
      const exists = options.find(
        (option) => option.toLowerCase() === trimmed.toLowerCase(),
      );
      if (!exists) {
        options.push(trimmed);
        newOptionValue = trimmed;
        await ctx.db.patch(args.id, { pollOptions: options });
      } else {
        newOptionValue = exists;
      }
    }

    let selections = args.selections
      .map((selection) => selection.trim())
      .filter((selection) => selection.length > 0);
    if (newOptionValue && !selections.includes(newOptionValue)) {
      selections.push(newOptionValue);
    }
    selections = Array.from(new Set(selections));
    if (selections.length === 0) {
      throw new Error('Select at least one option.');
    }

    const maxSelections = Math.max(1, announcement.pollMaxSelections ?? 1);
    if (selections.length > maxSelections) {
      throw new Error(
        `You can select up to ${maxSelections} option${
          maxSelections > 1 ? 's' : ''
        }.`,
      );
    }

    const normalizedSelections = selections.map((selection) => {
      if (!options.includes(selection)) {
        throw new Error('Selected option is not available.');
      }
      return selection;
    });

    const existingVote = await ctx.db
      .query('pollVotes')
      .withIndex('by_announcement_user', (q) =>
        q.eq('announcementId', args.id).eq('userId', identity.subject),
      )
      .unique();
    const displayName =
      identity.name ??
      identity.email ??
      identity.tokenIdentifier ??
      identity.subject;

    if (existingVote) {
      await ctx.db.patch(existingVote._id, {
        selections: normalizedSelections,
        updatedAt: now,
        userName: displayName,
      });
    } else {
      await ctx.db.insert('pollVotes', {
        announcementId: args.id,
        userId: identity.subject,
        userName: displayName,
        selections: normalizedSelections,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const purchaseVotes = mutation({
  args: {
    id: v.id('announcements'),
    adjustments: v.array(
      v.object({
        userId: v.string(),
        add: v.number(),
        remove: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const announcement = await ctx.db.get(args.id);
    if (!announcement || announcement.eventType !== 'voting') {
      throw new Error('Voting event not found.');
    }

    const allowRemovals = announcement.votingAllowRemovals ?? true;
    const participants = (announcement.votingParticipants ?? []).map(
      (participant) => ({
        ...participant,
        votes:
          typeof participant.votes === 'number' &&
          Number.isFinite(participant.votes)
            ? Math.max(0, Math.floor(participant.votes))
            : 0,
      }),
    );

    const participantMap = new Map(
      participants.map((participant) => [participant.userId, { ...participant }]),
    );

    let changed = false;
    for (const adjustment of args.adjustments) {
      const participant = participantMap.get(adjustment.userId);
      if (!participant) {
        throw new Error('Participant not found.');
      }
      const add = Math.max(0, Math.floor(adjustment.add));
      const remove = allowRemovals
        ? Math.max(0, Math.floor(adjustment.remove))
        : 0;
      if (!allowRemovals && adjustment.remove > 0) {
        throw new Error('Removing votes is disabled for this event.');
      }
      if (add === 0 && remove === 0) continue;
      if (remove > participant.votes) {
        throw new Error(
          `${participant.firstName ?? 'Participant'} does not have enough votes to remove.`,
        );
      }
      participant.votes = participant.votes + add - remove;
      participantMap.set(adjustment.userId, participant);
      changed = true;
    }

    if (!changed) {
      return {
        success: false,
        participants,
      };
    }

    const updatedParticipants = Array.from(participantMap.values());

    await ctx.db.patch(args.id, {
      votingParticipants: updatedParticipants,
      updatedAt: Date.now(),
      updatedBy:
        identity.name ?? identity.tokenIdentifier ?? identity.subject ?? 'anonymous',
    });

    return {
      success: true,
      participants: updatedParticipants,
    };
  },
});

export const nextPublishAt = query({
  args: { now: v.number() },
  handler: async (ctx, args) => {
    const upcoming = await ctx.db
      .query('announcements')
      .withIndex('by_publishAt', (q) => q.eq('status', 'scheduled'))
      .filter((q) => q.gt(q.field('publishAt'), args.now))
      .first();
    return upcoming?.publishAt ?? null;
  },
});

export const remove = mutation({
  args: {
    id: v.id('announcements'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error('Activity not found');
    }
    if (existing.eventType === 'poll') {
      const votes = await ctx.db
        .query('pollVotes')
        .withIndex('by_announcement', (q) => q.eq('announcementId', args.id))
        .collect();
      await Promise.all(votes.map((vote) => ctx.db.delete(vote._id)));
    } else if (existing.eventType === 'voting') {
      await ctx.db.patch(args.id, {
        votingParticipants: resetVotingParticipantVotes(
          existing.votingParticipants,
        ),
      });
    }
    await ctx.db.delete(args.id);
  },
});

export const archive = mutation({
  args: {
    id: v.id('announcements'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error('Activity not found');
    }
    const update: {
      status: 'archived';
      votingParticipants?: VotingParticipant[];
    } = { status: 'archived' };
    if (existing.eventType === 'voting') {
      update.votingParticipants = resetVotingParticipantVotes(
        existing.votingParticipants,
      );
    }
    await ctx.db.patch(args.id, update);
  },
});
