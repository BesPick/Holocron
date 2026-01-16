import crypto from 'node:crypto';
import { and, asc, eq, gt, lte, ne, or } from 'drizzle-orm';
import { db } from '@/server/db/client';
import {
  AnnouncementInsert,
  AnnouncementRow,
  announcements,
  pollVotes,
  votingPurchases,
} from '@/server/db/schema';
import { deleteUploads } from '@/server/services/storage';
import { broadcast } from '@/server/events';
import type {
  AnnouncementDoc,
  Id,
  VotingLeaderboardMode,
  VotingParticipant,
} from '@/types/db';
import type { Identity } from '../auth';

export type CreateAnnouncementArgs = {
  title: string;
  description: string;
  publishAt: number;
  autoDeleteAt?: number | null;
  autoArchiveAt?: number | null;
  pollQuestion?: string;
  pollOptions?: string[];
  pollAnonymous?: boolean;
  pollAllowAdditionalOptions?: boolean;
  pollMaxSelections?: number;
  pollClosesAt?: number | null;
  votingParticipants?: VotingParticipant[];
  votingAddVotePrice?: number;
  votingRemoveVotePrice?: number;
  votingAddVoteLimit?: number | null;
  votingRemoveVoteLimit?: number | null;
  votingAllowedGroups?: string[];
  votingAllowedPortfolios?: string[];
  votingAllowUngrouped?: boolean;
  votingAllowRemovals?: boolean;
  votingLeaderboardMode?: string;
  eventType?: 'announcements' | 'poll' | 'voting';
  imageIds?: Id<'_storage'>[];
};

export type UpdateAnnouncementArgs = CreateAnnouncementArgs & {
  id: Id<'announcements'>;
};

export type VotePollArgs = {
  id: Id<'announcements'>;
  selections: string[];
  newOption?: string;
};

export type PurchaseVotesArgs = {
  id: Id<'announcements'>;
  adjustments: { userId: string; add: number; remove: number }[];
};

export type PollDetails = {
  _id: Id<'announcements'>;
  question: string;
  description: string;
  options: { value: string; votes: number }[];
  totalVotes: number;
  pollAnonymous: boolean;
  pollAllowAdditionalOptions: boolean;
  pollMaxSelections: number;
  currentUserSelections: string[];
  closesAt: number | null;
  isClosed: boolean;
  isArchived: boolean;
  imageIds: Id<'_storage'>[];
};

export type PollBreakdown = {
  pollId: Id<'announcements'>;
  options: {
    value: string;
    voters: { userId: string; userName: string | null }[];
    voteCount: number;
  }[];
  totalVotes: number;
};

function parseJson<T>(value?: string | null): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

function serializeJson(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}

function mapAnnouncementRow(row: AnnouncementRow): AnnouncementDoc {
  return {
    _id: row.id as Id<'announcements'>,
    title: row.title,
    description: row.description,
    eventType: row.eventType as AnnouncementDoc['eventType'],
    createdAt: row.createdAt,
    publishAt: row.publishAt,
    status: row.status as AnnouncementDoc['status'],
    createdBy: row.createdBy ?? undefined,
    updatedAt: row.updatedAt ?? undefined,
    updatedBy: row.updatedBy ?? undefined,
    autoDeleteAt: row.autoDeleteAt ?? null,
    autoArchiveAt: row.autoArchiveAt ?? null,
    pollQuestion: row.pollQuestion ?? undefined,
    pollOptions: parseJson<string[]>(row.pollOptionsJson),
    pollAnonymous: row.pollAnonymous ?? undefined,
    pollAllowAdditionalOptions: row.pollAllowAdditionalOptions ?? undefined,
    pollMaxSelections: row.pollMaxSelections ?? undefined,
    pollClosesAt: row.pollClosesAt ?? null,
    votingParticipants: parseJson<VotingParticipant[]>(
      row.votingParticipantsJson,
    ),
    votingAddVotePrice: row.votingAddVotePrice ?? undefined,
    votingRemoveVotePrice: row.votingRemoveVotePrice ?? undefined,
    votingAddVoteLimit: row.votingAddVoteLimit ?? null,
    votingRemoveVoteLimit: row.votingRemoveVoteLimit ?? null,
    votingAllowedGroups: parseJson<string[]>(row.votingAllowedGroupsJson),
    votingAllowedPortfolios: parseJson<string[]>(
      row.votingAllowedPortfoliosJson,
    ),
    votingAllowUngrouped: row.votingAllowUngrouped ?? undefined,
    votingAllowRemovals: row.votingAllowRemovals ?? undefined,
    votingLeaderboardMode: (row.votingLeaderboardMode ??
      undefined) as VotingLeaderboardMode | undefined,
    imageIds: parseJson<Id<'_storage'>[]>(row.imageIdsJson),
  };
}

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

function normalizePrice(value: number | null | undefined, label: string): number {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
    throw new Error(`${label} must be a non-negative number.`);
  }
  return Math.round(value * 100) / 100;
}

function normalizeVoteLimit(
  value: number | null | undefined,
  label: string,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    Number.isNaN(value) ||
    value < 0 ||
    !Number.isInteger(value)
  ) {
    throw new Error(`${label} must be a non-negative whole number.`);
  }
  return Math.floor(value);
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

function normalizePollOptions(rawOptions: string[]) {
  const options = rawOptions
    .map((option) => option.trim())
    .filter((option) => option.length > 0);
  if (options.length < 2) {
    throw new Error('Polls require at least two options.');
  }
  const seen = new Set<string>();
  for (const option of options) {
    const key = option.toLowerCase();
    if (seen.has(key)) {
      throw new Error('Poll options must be unique.');
    }
    seen.add(key);
  }
  return options;
}

export async function getAnnouncement(
  id: Id<'announcements'>,
): Promise<AnnouncementDoc | null> {
  const row = await db
    .select()
    .from(announcements)
    .where(eq(announcements.id, id))
    .get();
  return row ? mapAnnouncementRow(row) : null;
}

export async function createAnnouncement(
  args: CreateAnnouncementArgs,
  identity: Identity | null,
) {
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

  if (normalizedAutoDeleteAt !== null && normalizedAutoArchiveAt !== null) {
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
    const filteredOptions = normalizePollOptions(args.pollOptions ?? []);
    pollQuestion = questionInput;
    pollOptions = filteredOptions;
    pollAnonymous = Boolean(args.pollAnonymous);
    pollAllowAdditionalOptions = Boolean(args.pollAllowAdditionalOptions);
    const rawMaxSelections =
      typeof args.pollMaxSelections === 'number'
        ? Math.max(1, Math.floor(args.pollMaxSelections))
        : 1;
    pollMaxSelections = Math.max(1, Math.min(rawMaxSelections, pollOptions.length));
    pollClosesAt = typeof args.pollClosesAt === 'number' ? args.pollClosesAt : null;
    if (pollClosesAt !== null && pollClosesAt <= args.publishAt) {
      throw new Error('Poll close time must be after the publish time.');
    }
  }

  let votingParticipants: VotingParticipant[] | null = null;
  let votingAddVotePrice: number | null = null;
  let votingRemoveVotePrice: number | null = null;
  let votingAddVoteLimit: number | null = null;
  let votingRemoveVoteLimit: number | null = null;
  let votingAllowedGroups: string[] | null = null;
  let votingAllowedPortfolios: string[] | null = null;
  let votingAllowUngrouped = false;
  let votingAllowRemovals = true;
  let votingLeaderboardMode: VotingLeaderboardMode = 'all';
  if (eventType === 'voting') {
    const participants = normalizeVotingParticipants(args.votingParticipants);
    if (participants.length === 0) {
      throw new Error('Voting events require at least one participant.');
    }
    votingParticipants = participants;
    votingAddVotePrice = normalizePrice(
      args.votingAddVotePrice,
      'Price to add a vote',
    );
    votingAddVoteLimit = normalizeVoteLimit(
      args.votingAddVoteLimit,
      'Add vote limit',
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
    votingRemoveVoteLimit = normalizeVoteLimit(
      args.votingRemoveVoteLimit,
      'Remove vote limit',
    );
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

  const id = crypto.randomUUID();
  const record: AnnouncementInsert = {
    id,
    title: cleanedTitle,
    description: cleanedDescription,
    eventType,
    createdAt: now,
    publishAt: args.publishAt,
    status,
    createdBy: identity?.name ?? identity?.email ?? identity?.userId,
    autoDeleteAt: normalizedAutoDeleteAt,
    autoArchiveAt: normalizedAutoArchiveAt,
    pollQuestion: pollQuestion ?? undefined,
    pollOptionsJson: pollOptions ? JSON.stringify(pollOptions) : null,
    pollAnonymous: eventType === 'poll' ? pollAnonymous : null,
    pollAllowAdditionalOptions:
      eventType === 'poll' ? pollAllowAdditionalOptions : null,
    pollMaxSelections: eventType === 'poll' ? pollMaxSelections : null,
    pollClosesAt: eventType === 'poll' ? pollClosesAt : null,
    votingParticipantsJson:
      eventType === 'voting' && votingParticipants
        ? JSON.stringify(votingParticipants)
        : null,
    votingAddVotePrice:
      eventType === 'voting' ? votingAddVotePrice ?? null : null,
    votingRemoveVotePrice:
      eventType === 'voting' ? votingRemoveVotePrice ?? null : null,
    votingAddVoteLimit: eventType === 'voting' ? votingAddVoteLimit : null,
    votingRemoveVoteLimit:
      eventType === 'voting' ? votingRemoveVoteLimit : null,
    votingAllowedGroupsJson:
      eventType === 'voting' && votingAllowedGroups
        ? JSON.stringify(votingAllowedGroups)
        : null,
    votingAllowedPortfoliosJson:
      eventType === 'voting' && votingAllowedPortfolios
        ? JSON.stringify(votingAllowedPortfolios)
        : null,
    votingAllowUngrouped:
      eventType === 'voting' ? votingAllowUngrouped : null,
    votingAllowRemovals:
      eventType === 'voting' ? votingAllowRemovals : null,
    votingLeaderboardMode:
      eventType === 'voting' ? votingLeaderboardMode : null,
    imageIdsJson: normalizedImageIds.length
      ? JSON.stringify(normalizedImageIds)
      : null,
  };

  await db.insert(announcements).values(record);
  if (eventType === 'voting') {
    broadcast(['announcements', 'voting']);
  } else {
    broadcast(['announcements']);
  }
  return { id: id as Id<'announcements'>, status };
}

export async function listAnnouncements(now: number) {
  const rows = await db
    .select()
    .from(announcements)
    .where(
      and(
        ne(announcements.status, 'archived'),
        or(
          eq(announcements.status, 'published'),
          lte(announcements.publishAt, now),
        ),
      ),
    );
  const normalized = rows.map((row) => {
    const announcement = mapAnnouncementRow(row);
    return announcement.status === 'scheduled' &&
      announcement.publishAt <= now
      ? { ...announcement, status: 'published' as const }
      : announcement;
  });
  return normalized.sort((a, b) => b.createdAt - a.createdAt);
}

export async function listArchived() {
  const rows = await db
    .select()
    .from(announcements)
    .where(eq(announcements.status, 'archived'));
  const normalized = rows.map(mapAnnouncementRow);
  return normalized.sort((a, b) => b.createdAt - a.createdAt);
}

export async function listScheduled(now: number) {
  const rows = await db
    .select()
    .from(announcements)
    .where(
      and(eq(announcements.status, 'scheduled'), gt(announcements.publishAt, now)),
    )
    .orderBy(asc(announcements.publishAt));
  return rows.map(mapAnnouncementRow);
}

export async function updateAnnouncement(
  args: UpdateAnnouncementArgs,
  identity: Identity | null,
) {
  if (!identity) throw new Error('Unauthorized');
  const existing = await getAnnouncement(args.id);
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

  if (requestedAutoDeleteAt !== null && requestedAutoDeleteAt <= args.publishAt) {
    throw new Error('Auto delete time must be after publish time.');
  }

  if (requestedAutoArchiveAt !== null && requestedAutoArchiveAt <= args.publishAt) {
    throw new Error('Auto archive time must be after publish time.');
  }

  if (requestedAutoDeleteAt !== null && requestedAutoArchiveAt !== null) {
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
    const filteredOptions = normalizePollOptions(incomingOptions);
    pollQuestion = questionInput;
    pollOptions = filteredOptions;
    pollMaxSelections = Math.max(1, Math.min(pollMaxSelections, filteredOptions.length));
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
    existing.votingLeaderboardMode ?? 'all',
    'all',
  );
  let votingAddVotePrice: number | null = null;
  let votingRemoveVotePrice: number | null = null;
  let votingAddVoteLimit: number | null = null;
  let votingRemoveVoteLimit: number | null = null;
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
    votingAddVoteLimit = normalizeVoteLimit(
      args.votingAddVoteLimit !== undefined
        ? args.votingAddVoteLimit
        : existing.votingAddVoteLimit ?? null,
      'Add vote limit',
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
    votingRemoveVoteLimit = normalizeVoteLimit(
      args.votingRemoveVoteLimit !== undefined
        ? args.votingRemoveVoteLimit
        : existing.votingRemoveVoteLimit ?? null,
      'Remove vote limit',
    );
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
      args.votingLeaderboardMode ?? existing.votingLeaderboardMode ?? 'all',
      'all',
    );
  }

  const providedImageIds = Array.isArray(args.imageIds)
    ? args.imageIds
    : existing.imageIds ?? [];
  if (providedImageIds.length > 5) {
    throw new Error('You can upload up to five images.');
  }
  const normalizedImageIds = Array.from(new Set(providedImageIds));
  const existingImageIds = existing.imageIds ?? [];
  const removedImageIds = existingImageIds.filter(
    (id) => !normalizedImageIds.includes(id),
  );

  const updatedBy =
    identity?.name ??
    identity?.email ??
    identity?.userId ??
    'anonymous';

  await db
    .update(announcements)
    .set({
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
          : null,
      pollOptionsJson:
        eventType === 'poll'
          ? serializeJson(
              pollOptions ?? existing.pollOptions ?? undefined,
            )
          : null,
      pollAnonymous: eventType === 'poll' ? pollAnonymous : null,
      pollAllowAdditionalOptions:
        eventType === 'poll' ? pollAllowAdditionalOptions : null,
      pollMaxSelections: eventType === 'poll' ? pollMaxSelections : null,
      pollClosesAt: eventType === 'poll' ? pollClosesAt ?? null : null,
      votingParticipantsJson:
        eventType === 'voting'
          ? serializeJson(
              votingParticipants ?? existing.votingParticipants ?? undefined,
            )
          : null,
      votingAddVotePrice:
        eventType === 'voting'
          ? votingAddVotePrice ?? existing.votingAddVotePrice ?? null
          : null,
      votingRemoveVotePrice:
        eventType === 'voting'
          ? votingRemoveVotePrice ?? existing.votingRemoveVotePrice ?? null
          : null,
      votingAddVoteLimit: eventType === 'voting' ? votingAddVoteLimit : null,
      votingRemoveVoteLimit:
        eventType === 'voting' ? votingRemoveVoteLimit : null,
      votingAllowedGroupsJson:
        eventType === 'voting'
          ? serializeJson(
              votingAllowedGroups ?? existing.votingAllowedGroups ?? undefined,
            )
          : null,
      votingAllowedPortfoliosJson:
        eventType === 'voting'
          ? serializeJson(
              votingAllowedPortfolios ??
                existing.votingAllowedPortfolios ??
                undefined,
            )
          : null,
      votingAllowUngrouped:
        eventType === 'voting'
          ? votingAllowUngrouped
          : null,
      votingAllowRemovals:
        eventType === 'voting'
          ? votingAllowRemovals
          : null,
      votingLeaderboardMode:
        eventType === 'voting'
          ? votingLeaderboardMode ?? existing.votingLeaderboardMode ?? 'all'
          : null,
      imageIdsJson:
        normalizedImageIds.length > 0
          ? JSON.stringify(normalizedImageIds)
          : null,
    })
    .where(eq(announcements.id, args.id));

  if (removedImageIds.length > 0) {
    await deleteUploads(removedImageIds);
  }
  broadcast([
    'announcements',
    ...(eventType === 'poll' ? ['pollVotes'] : []),
    ...(eventType === 'voting' ? ['voting'] : []),
  ]);

  return { id: args.id, status };
}

export async function publishDue(now: number) {
  const dueAnnouncements = await db
    .select()
    .from(announcements)
    .where(
      and(
        eq(announcements.status, 'scheduled'),
        lte(announcements.publishAt, now),
      ),
    );

  for (const announcement of dueAnnouncements) {
    await db
      .update(announcements)
      .set({ status: 'published' })
      .where(eq(announcements.id, announcement.id));
  }

  const candidates = await db.select().from(announcements);
  const deleteDue = candidates.filter(
    (announcement) =>
      typeof announcement.autoDeleteAt === 'number' &&
      announcement.autoDeleteAt <= now,
  );

  for (const announcement of deleteDue) {
    const imageIds = parseJson<Id<'_storage'>[]>(announcement.imageIdsJson) ?? [];
    if (announcement.eventType === 'voting') {
      await db
        .update(announcements)
        .set({
          votingParticipantsJson: serializeJson(
            resetVotingParticipantVotes(
              parseJson<VotingParticipant[]>(announcement.votingParticipantsJson),
            ),
          ),
        })
        .where(eq(announcements.id, announcement.id));
      await db
        .delete(votingPurchases)
        .where(eq(votingPurchases.announcementId, announcement.id));
    }
    if (imageIds.length) {
      await deleteUploads(imageIds);
    }
    await db.delete(announcements).where(eq(announcements.id, announcement.id));
  }

  const archiveDue = candidates.filter(
    (announcement) =>
      announcement.status !== 'archived' &&
      typeof announcement.autoArchiveAt === 'number' &&
      announcement.autoArchiveAt <= now,
  );

  for (const announcement of archiveDue) {
    const update: Partial<AnnouncementInsert> = { status: 'archived' };
    await db
      .update(announcements)
      .set(update)
      .where(eq(announcements.id, announcement.id));
  }
  if (
    dueAnnouncements.length > 0 ||
    deleteDue.length > 0 ||
    archiveDue.length > 0
  ) {
    const affectedChannels = new Set<string>(['announcements']);
    const hasVotingChange =
      deleteDue.some((a) => a.eventType === 'voting') ||
      archiveDue.some((a) => a.eventType === 'voting');
    if (hasVotingChange) {
      affectedChannels.add('voting');
    }
    broadcast(Array.from(affectedChannels));
  }

  return {
    updated: dueAnnouncements.length,
    deleted: deleteDue.length,
    archived: archiveDue.length,
  };
}

export async function getPoll(
  id: Id<'announcements'>,
  userId?: string | null,
): Promise<PollDetails> {
  const announcementRow = await db
    .select()
    .from(announcements)
    .where(eq(announcements.id, id))
    .get();
  if (!announcementRow || announcementRow.eventType !== 'poll') {
    throw new Error('Poll not found.');
  }
  const announcement = mapAnnouncementRow(announcementRow);

  const votes = await db
    .select()
    .from(pollVotes)
    .where(eq(pollVotes.announcementId, id));

  const counts = new Map<string, number>();
  for (const vote of votes) {
    const selections = parseJson<string[]>(vote.selectionsJson) ?? [];
    for (const selection of selections) {
      counts.set(selection, (counts.get(selection) ?? 0) + 1);
    }
  }

  const options = (announcement.pollOptions ?? []).map((option) => ({
    value: option,
    votes: counts.get(option) ?? 0,
  }));

  const totalVotes = votes.reduce((sum, vote) => {
    const selections = parseJson<string[]>(vote.selectionsJson) ?? [];
    return sum + selections.length;
  }, 0);

  const currentUserSelections = userId
    ? parseJson<string[]>(
        votes.find((vote) => vote.userId === userId)?.selectionsJson,
      ) ?? []
    : [];

  const closesAt = announcement.pollClosesAt ?? null;
  const isClosed = typeof closesAt === 'number' ? closesAt <= Date.now() : false;

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
}

export async function getPollVoteBreakdown(
  id: Id<'announcements'>,
  identity: Identity | null,
): Promise<PollBreakdown> {
  if (!identity) throw new Error('Unauthorized');
  const announcement = await db
    .select()
    .from(announcements)
    .where(eq(announcements.id, id))
    .get();
  if (!announcement || announcement.eventType !== 'poll') {
    throw new Error('Poll not found.');
  }

  const votes = await db
    .select()
    .from(pollVotes)
    .where(eq(pollVotes.announcementId, id));

  const optionMap = new Map<
    string,
    {
      value: string;
      voters: { userId: string; userName: string | null }[];
    }
  >();

  for (const option of parseJson<string[]>(announcement.pollOptionsJson) ?? []) {
    optionMap.set(option, { value: option, voters: [] });
  }

  for (const vote of votes) {
    const selections = parseJson<string[]>(vote.selectionsJson) ?? [];
    for (const selection of selections) {
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

  const totalVotes = votes.reduce((sum, vote) => {
    const selections = parseJson<string[]>(vote.selectionsJson) ?? [];
    return sum + selections.length;
  }, 0);

  return {
    pollId: id,
    options,
    totalVotes,
  };
}

export async function votePoll(
  args: VotePollArgs,
  identity: Identity | null,
): Promise<void> {
  if (!identity) throw new Error('Unauthorized');

  const announcementRow = await db
    .select()
    .from(announcements)
    .where(eq(announcements.id, args.id))
    .get();
  if (!announcementRow || announcementRow.eventType !== 'poll') {
    throw new Error('Poll not found.');
  }

  const announcement = mapAnnouncementRow(announcementRow);
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
      await db
        .update(announcements)
        .set({ pollOptionsJson: JSON.stringify(options) })
        .where(eq(announcements.id, args.id));
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
      `You can select up to ${maxSelections} option${maxSelections > 1 ? 's' : ''}.`,
    );
  }

  const normalizedSelections = selections.map((selection) => {
    if (!options.includes(selection)) {
      throw new Error('Selected option is not available.');
    }
    return selection;
  });

  const existingVote = await db
    .select()
    .from(pollVotes)
    .where(
      and(
        eq(pollVotes.announcementId, args.id),
        eq(pollVotes.userId, identity.userId),
      ),
    )
    .get();
  const displayName =
    identity.name ?? identity.email ?? identity.userId;

  if (existingVote) {
    await db
      .update(pollVotes)
      .set({
        selectionsJson: JSON.stringify(normalizedSelections),
        updatedAt: now,
        userName: displayName,
      })
      .where(eq(pollVotes.id, existingVote.id));
  } else {
  await db.insert(pollVotes).values({
      id: crypto.randomUUID(),
      announcementId: args.id,
      userId: identity.userId,
      userName: displayName,
      selectionsJson: JSON.stringify(normalizedSelections),
      createdAt: now,
      updatedAt: now,
    });
  }
  broadcast(['announcements', 'pollVotes']);
}

export async function purchaseVotes(
  args: PurchaseVotesArgs,
  identity: Identity | null,
) {
  if (!identity) throw new Error('Unauthorized');

  const announcement = await getAnnouncement(args.id);
  if (!announcement || announcement.eventType !== 'voting') {
    throw new Error('Voting event not found.');
  }

  const allowRemovals = announcement.votingAllowRemovals ?? true;
  const addVoteLimit =
    typeof announcement.votingAddVoteLimit === 'number'
      ? Math.max(0, Math.floor(announcement.votingAddVoteLimit))
      : null;
  const removeVoteLimit =
    typeof announcement.votingRemoveVoteLimit === 'number'
      ? Math.max(0, Math.floor(announcement.votingRemoveVoteLimit))
      : null;
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

  const purchaseRecord = await db
    .select()
    .from(votingPurchases)
    .where(
      and(
        eq(votingPurchases.announcementId, args.id),
        eq(votingPurchases.userId, identity.userId),
      ),
    )
    .get();
  const purchasedAdd = purchaseRecord?.addVotes ?? 0;
  const purchasedRemove = purchaseRecord?.removeVotes ?? 0;

  let requestedAdd = 0;
  let requestedRemove = 0;
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
    participant.votes = (participant.votes ?? 0) + add - remove;
    participantMap.set(adjustment.userId, participant);
    requestedAdd += add;
    requestedRemove += remove;
    changed = true;
  }

  if (!changed) {
    return {
      success: false,
      participants,
    };
  }

  if (typeof addVoteLimit === 'number') {
    const remaining = Math.max(0, addVoteLimit - purchasedAdd);
    if (requestedAdd > remaining) {
      throw new Error(
        `You can purchase up to ${remaining} more add votes for this event.`,
      );
    }
  }

  if (allowRemovals && typeof removeVoteLimit === 'number') {
    const remaining = Math.max(0, removeVoteLimit - purchasedRemove);
    if (requestedRemove > remaining) {
      throw new Error(
        `You can purchase up to ${remaining} more remove votes for this event.`,
      );
    }
  }

  const updatedParticipants = Array.from(participantMap.values());

  await db
    .update(announcements)
    .set({
      votingParticipantsJson: JSON.stringify(updatedParticipants),
      updatedAt: Date.now(),
      updatedBy:
        identity.name ?? identity.email ?? identity.userId ?? 'anonymous',
    })
    .where(eq(announcements.id, args.id));

  const now = Date.now();
  if (purchaseRecord) {
    await db
      .update(votingPurchases)
      .set({
        addVotes: purchasedAdd + requestedAdd,
        removeVotes: purchasedRemove + requestedRemove,
        updatedAt: now,
      })
      .where(eq(votingPurchases.id, purchaseRecord.id));
  } else {
    await db.insert(votingPurchases).values({
      id: `${args.id}:${identity.userId}`,
      announcementId: args.id,
      userId: identity.userId,
      addVotes: requestedAdd,
      removeVotes: requestedRemove,
      updatedAt: now,
    });
  }

  broadcast(['announcements', 'voting']);
  return {
    success: true,
    participants: updatedParticipants,
  };
}

export async function nextPublishAt(now: number) {
  const upcoming = await db
    .select()
    .from(announcements)
    .where(
      and(eq(announcements.status, 'scheduled'), gt(announcements.publishAt, now)),
    )
    .orderBy(asc(announcements.publishAt))
    .limit(1);
  const next = upcoming[0];
  return next?.publishAt ?? null;
}

export async function removeAnnouncement(
  id: Id<'announcements'>,
  identity: Identity | null,
) {
  if (!identity) {
    throw new Error('Unauthorized');
  }
  const existing = await getAnnouncement(id);
  if (!existing) {
    throw new Error('Activity not found');
  }
  const imageIds = existing.imageIds ?? [];
  if (existing.eventType === 'poll') {
    await db.delete(pollVotes).where(eq(pollVotes.announcementId, id));
  } else if (existing.eventType === 'voting') {
    await db
      .update(announcements)
      .set({
        votingParticipantsJson: JSON.stringify(
          resetVotingParticipantVotes(existing.votingParticipants),
        ),
      })
      .where(eq(announcements.id, id));
    await db
      .delete(votingPurchases)
      .where(eq(votingPurchases.announcementId, id));
  }
  if (imageIds.length) {
    await deleteUploads(imageIds);
  }
  await db.delete(announcements).where(eq(announcements.id, id));
  broadcast([
    'announcements',
    ...(existing.eventType === 'voting' ? ['voting'] : []),
    ...(existing.eventType === 'poll' ? ['pollVotes'] : []),
  ]);
}

export async function archiveAnnouncement(
  id: Id<'announcements'>,
  identity: Identity | null,
) {
  if (!identity) {
    throw new Error('Unauthorized');
  }
  const existing = await getAnnouncement(id);
  if (!existing) {
    throw new Error('Activity not found');
  }
  const update: Partial<AnnouncementInsert> = { status: 'archived' };
  await db.update(announcements).set(update).where(eq(announcements.id, id));
  broadcast([
    'announcements',
    ...(existing.eventType === 'voting' ? ['voting'] : []),
    ...(existing.eventType === 'poll' ? ['pollVotes'] : []),
  ]);
}
