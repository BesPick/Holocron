import { clerkClient, currentUser } from '@clerk/nextjs/server';
import { and, desc, eq, gt, gte, inArray, lt, lte, or } from 'drizzle-orm';

import { db } from '@/server/db/client';
import {
  demoDayAssignments,
  scheduleEventOverrides,
  scheduleRefresh,
  scheduleRules,
  securityShiftAssignments,
  standupAssignments,
} from '@/server/db/schema';
import {
  isValidRankCategory,
  isValidRankForCategory,
  type EnlistedRank,
  type OfficerRank,
  type Rank,
  type RankCategory,
} from '@/lib/org';
import {
  SECURITY_SHIFT_EVENT_TYPES,
  type SecurityShiftEventType,
  isHostHubEventType,
  isValidDateKey,
  type HostHubEventType,
} from '@/lib/hosthub-events';
import {
  DEFAULT_SCHEDULE_RULES,
  normalizeScheduleRuleConfig,
  type ScheduleRuleConfig,
  type ScheduleRuleId,
} from '@/lib/hosthub-schedule-rules';

export type DemoDayAssignee = {
  userId: string;
  name: string;
};

export type StandupAssignee = {
  userId: string;
  name: string;
};

export type SecurityShiftAssignee = {
  userId: string;
  name: string;
};

export type HostHubRosterMember = {
  userId: string;
  name: string;
};

export type DemoDayAssignment = {
  date: string;
  userId: string | null;
  userName: string;
  assignedAt: number;
};

export type StandupAssignment = {
  date: string;
  userId: string | null;
  userName: string;
  assignedAt: number;
};

export type SecurityShiftAssignment = {
  id: string;
  date: string;
  eventType: SecurityShiftEventType;
  userId: string | null;
  userName: string;
  assignedAt: number;
};

export type ScheduleEventOverride = {
  id: string;
  date: string;
  eventType: HostHubEventType;
  movedToDate: string | null;
  time: string | null;
  isCanceled: boolean;
  overrideUserId: string | null;
  overrideUserName: string | null;
  updatedAt: number;
  updatedBy: string | null;
};

export type RefreshAssignmentsSummary = {
  checked: number;
  kept: number;
  updated: number;
  replaced: number;
  filled: number;
};

export type ScheduleRefreshNotice = {
  pendingSince: number;
  nextRefreshAt: number;
};

const MONTH_WINDOW = [-1, 0, 1, 2, 3];
const HISTORY_MONTH_LIMIT = 12;
const DEMO_DAY_WEEKDAY = 3;
const STANDUP_DAYS = new Set([1, 4]);
const SECURITY_SHIFT_DAYS = new Set([1, 2, 3, 4, 5]);
const RULE_IDS: ScheduleRuleId[] = [
  'demo-day',
  'standup',
  'security-shift',
];
const SCHEDULE_REFRESH_ID = 'hosthub';

const pad2 = (value: number) => value.toString().padStart(2, '0');

export const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate(),
  )}`;

const getDefaultRule = (ruleId: ScheduleRuleId) =>
  DEFAULT_SCHEDULE_RULES[ruleId];

export async function getScheduleRuleConfig(
  ruleId: ScheduleRuleId,
): Promise<ScheduleRuleConfig> {
  const defaultRule = getDefaultRule(ruleId);
  if (!RULE_IDS.includes(ruleId)) {
    return defaultRule;
  }

  const rows = await db
    .select()
    .from(scheduleRules)
    .where(eq(scheduleRules.id, ruleId))
    .limit(1);
  const row = rows[0];
  if (!row) return defaultRule;

  try {
    return normalizeScheduleRuleConfig(
      JSON.parse(row.configJson),
      defaultRule,
    );
  } catch (error) {
    console.error('Failed to parse schedule rule config', error);
    return defaultRule;
  }
}

export async function saveScheduleRuleConfig({
  ruleId,
  config,
  updatedBy,
}: {
  ruleId: ScheduleRuleId;
  config: ScheduleRuleConfig;
  updatedBy?: string | null;
}): Promise<ScheduleRuleConfig> {
  const normalized = normalizeScheduleRuleConfig(
    config,
    getDefaultRule(ruleId),
  );
  const payload = {
    id: ruleId,
    configJson: JSON.stringify(normalized),
    updatedAt: Date.now(),
    updatedBy: updatedBy ?? null,
  };

  await db
    .insert(scheduleRules)
    .values(payload)
    .onConflictDoUpdate({
      target: scheduleRules.id,
      set: {
        configJson: payload.configJson,
        updatedAt: payload.updatedAt,
        updatedBy: payload.updatedBy,
      },
    });

  return normalized;
}

const isEligibleForRule = ({
  rule,
  rankCategory,
  rank,
}: {
  rule: ScheduleRuleConfig;
  rankCategory: RankCategory | null;
  rank: Rank | null;
}) => {
  if (!isValidRankCategory(rankCategory)) return false;
  if (!rule.eligibleRankCategories.includes(rankCategory)) return false;
  if (rankCategory === 'Civilian') return true;
  if (!isValidRankForCategory(rankCategory, rank)) return false;
  if (rankCategory === 'Enlisted') {
    return rule.eligibleEnlistedRanks.includes(rank as EnlistedRank);
  }
  return rule.eligibleOfficerRanks.includes(rank as OfficerRank);
};

const getHistoryCutoffKey = (baseDate: Date) => {
  const cutoff = new Date(baseDate);
  cutoff.setMonth(cutoff.getMonth() - HISTORY_MONTH_LIMIT);
  return toDateKey(cutoff);
};

const addMonths = (date: Date, offset: number) =>
  new Date(date.getFullYear(), date.getMonth() + offset, 1);

const getMonthRange = (date: Date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start, end };
};

const getNextMonthStart = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth() + 1, 1);

export async function markScheduleRefreshPending(timestamp = Date.now()) {
  await db
    .insert(scheduleRefresh)
    .values({
      id: SCHEDULE_REFRESH_ID,
      pendingSince: timestamp,
      refreshedAt: null,
    })
    .onConflictDoUpdate({
      target: scheduleRefresh.id,
      set: {
        pendingSince: timestamp,
      },
    });
}

export async function clearScheduleAssignments() {
  await db.delete(scheduleEventOverrides);
  await db.delete(demoDayAssignments);
  await db.delete(standupAssignments);
  await db.delete(securityShiftAssignments);
  await db.delete(scheduleRefresh);
}

export async function markScheduleRefreshComplete(timestamp = Date.now()) {
  await db
    .insert(scheduleRefresh)
    .values({
      id: SCHEDULE_REFRESH_ID,
      pendingSince: null,
      refreshedAt: timestamp,
    })
    .onConflictDoUpdate({
      target: scheduleRefresh.id,
      set: {
        pendingSince: null,
        refreshedAt: timestamp,
      },
    });
}

export async function getScheduleRefreshNotice(
  now: Date = new Date(),
): Promise<ScheduleRefreshNotice | null> {
  const row = await db
    .select()
    .from(scheduleRefresh)
    .where(eq(scheduleRefresh.id, SCHEDULE_REFRESH_ID))
    .get();
  if (!row?.pendingSince) return null;
  const pendingDate = new Date(row.pendingSince);
  const nextRefresh = getNextMonthStart(pendingDate);
  if (now >= nextRefresh) {
    await db
      .update(scheduleRefresh)
      .set({ pendingSince: null })
      .where(eq(scheduleRefresh.id, SCHEDULE_REFRESH_ID));
    return null;
  }
  return {
    pendingSince: row.pendingSince,
    nextRefreshAt: nextRefresh.getTime(),
  };
}

export async function clearFutureAssignmentsForRule(
  ruleId: ScheduleRuleId,
  baseDate: Date = new Date(),
) {
  const { end: currentMonthEnd } = getMonthRange(baseDate);
  const currentMonthEndKey = toDateKey(currentMonthEnd);
  if (ruleId === 'demo-day') {
    await db
      .delete(demoDayAssignments)
      .where(gt(demoDayAssignments.date, currentMonthEndKey));
    return;
  }
  if (ruleId === 'standup') {
    await db
      .delete(standupAssignments)
      .where(gt(standupAssignments.date, currentMonthEndKey));
    return;
  }
  if (ruleId === 'security-shift') {
    await db
      .delete(securityShiftAssignments)
      .where(gt(securityShiftAssignments.date, currentMonthEndKey));
  }
}

const getFirstWednesdayKey = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const offset =
    (DEMO_DAY_WEEKDAY - firstDay.getDay() + 7) % 7;
  const day = 1 + offset;
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
};

const mulberry32 = (seed: number) => {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let result = Math.imul(t ^ (t >>> 15), 1 | t);
    result ^= result + Math.imul(result ^ (result >>> 7), 61 | result);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
};

const pickRandom = <T,>(items: T[], seed?: number): T | null => {
  if (items.length === 0) return null;
  const index = seed === undefined
    ? Math.floor(Math.random() * items.length)
    : Math.floor(mulberry32(seed)() * items.length);
  return items[index] ?? null;
};

const getStandupDateKeysForWindow = (baseDate: Date) => {
  const keys: string[] = [];
  for (const offset of MONTH_WINDOW) {
    const monthDate = addMonths(baseDate, offset);
    const { start, end } = getMonthRange(monthDate);
    const cursor = new Date(start);
    while (cursor <= end) {
      if (STANDUP_DAYS.has(cursor.getDay())) {
        keys.push(toDateKey(cursor));
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return keys;
};

const getStandupDateKeysForMonth = (date: Date) => {
  const keys: string[] = [];
  const { start, end } = getMonthRange(date);
  const cursor = new Date(start);
  while (cursor <= end) {
    if (STANDUP_DAYS.has(cursor.getDay())) {
      keys.push(toDateKey(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
};

const getSecurityShiftDateKeysForWindow = (baseDate: Date) => {
  const keys: string[] = [];
  for (const offset of MONTH_WINDOW) {
    const monthDate = addMonths(baseDate, offset);
    const { start, end } = getMonthRange(monthDate);
    const cursor = new Date(start);
    while (cursor <= end) {
      if (SECURITY_SHIFT_DAYS.has(cursor.getDay())) {
        keys.push(toDateKey(cursor));
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return keys;
};

const getSecurityShiftDateKeysForMonth = (date: Date) => {
  const keys: string[] = [];
  const { start, end } = getMonthRange(date);
  const cursor = new Date(start);
  while (cursor <= end) {
    if (SECURITY_SHIFT_DAYS.has(cursor.getDay())) {
      keys.push(toDateKey(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
};

const getSecurityShiftAssignmentId = (
  dateKey: string,
  eventType: SecurityShiftEventType,
) => `${eventType}-${dateKey}`;

const buildAvailability = <T extends { userId: string }>(
  eligibleUsers: T[],
  historyRows: Array<{ userId: string | null }>,
) => {
  const eligibleIds = new Set(eligibleUsers.map((user) => user.userId));
  const used = new Set<string>();
  for (const row of historyRows) {
    if (row.userId && eligibleIds.has(row.userId)) {
      used.add(row.userId);
      if (used.size >= eligibleUsers.length) break;
    }
  }
  return eligibleUsers.filter((user) => !used.has(user.userId));
};

export async function ensureDemoDayAssignmentsForWindow({
  baseDate,
  eligibleUsers,
}: {
  baseDate: Date;
  eligibleUsers: DemoDayAssignee[];
}): Promise<Record<string, DemoDayAssignment>> {
  await pruneDemoDayHistory(new Date());
  const { end: currentMonthEnd } = getMonthRange(baseDate);
  const currentMonthEndKey = toDateKey(currentMonthEnd);
  await db
    .delete(demoDayAssignments)
    .where(gt(demoDayAssignments.date, currentMonthEndKey));
  const todayKey = toDateKey(new Date());
  const dateKeys = MONTH_WINDOW.map((offset) =>
    getFirstWednesdayKey(addMonths(baseDate, offset)),
  );
  const assignableKeys = new Set([getFirstWednesdayKey(baseDate)]);

  const existingRows = await db
    .select()
    .from(demoDayAssignments)
    .where(inArray(demoDayAssignments.date, dateKeys));

  const assignments = new Map<string, DemoDayAssignment>();
  existingRows.forEach((row) => {
    const isFutureOrToday = row.date >= todayKey;
    if (!row.userId && isFutureOrToday) {
      return;
    }
    assignments.set(row.date, {
      date: row.date,
      userId: row.userId ?? null,
      userName: row.userName,
      assignedAt: row.assignedAt,
    });
  });

  const missingAssignableKeys = dateKeys.filter(
    (dateKey) => assignableKeys.has(dateKey) && !assignments.has(dateKey),
  );

  if (missingAssignableKeys.length === 0 || eligibleUsers.length === 0) {
    return Object.fromEntries(assignments.entries());
  }

  const history = await db
    .select()
    .from(demoDayAssignments)
    .orderBy(desc(demoDayAssignments.date));

  const eligibleIds = new Set(eligibleUsers.map((user) => user.userId));
  const used = new Set<string>();
  for (const row of history) {
    if (row.userId && eligibleIds.has(row.userId)) {
      used.add(row.userId);
      if (used.size >= eligibleUsers.length) break;
    }
  }

  let available = eligibleUsers.filter(
    (user) => !used.has(user.userId),
  );

  for (const dateKey of missingAssignableKeys) {
    if (assignments.has(dateKey)) continue;

    let assignee: DemoDayAssignee | null = null;
    if (eligibleUsers.length > 0) {
      if (available.length === 0) {
        available = [...eligibleUsers];
      }
      assignee = pickRandom(available);
      if (assignee) {
        available = available.filter(
          (user) => user.userId !== assignee?.userId,
        );
      }
    }

    const row: DemoDayAssignment = {
      date: dateKey,
      userId: assignee?.userId ?? null,
      userName: assignee?.name ?? 'TBD',
      assignedAt: Date.now(),
    };

    await db
      .insert(demoDayAssignments)
      .values({
        date: row.date,
        userId: row.userId,
        userName: row.userName,
        assignedAt: row.assignedAt,
      })
      .onConflictDoUpdate({
        target: demoDayAssignments.date,
        set: {
          userId: row.userId,
          userName: row.userName,
          assignedAt: row.assignedAt,
        },
      });

    assignments.set(dateKey, row);
  }

  return Object.fromEntries(assignments.entries());
}

export async function refreshDemoDayAssignmentsForWindow({
  baseDate,
  eligibleUsers,
  scope = 'month',
}: {
  baseDate: Date;
  eligibleUsers: DemoDayAssignee[];
  scope?: 'month' | 'window';
}): Promise<RefreshAssignmentsSummary> {
  await pruneDemoDayHistory(new Date());
  const { end: currentMonthEnd } = getMonthRange(baseDate);
  const currentMonthEndKey = toDateKey(currentMonthEnd);
  await db
    .delete(demoDayAssignments)
    .where(gt(demoDayAssignments.date, currentMonthEndKey));

  const todayKey = toDateKey(new Date());
  const dateKeys = MONTH_WINDOW.map((offset) =>
    getFirstWednesdayKey(addMonths(baseDate, offset)),
  );
  const assignableKeys =
    scope === 'window'
      ? dateKeys
      : [getFirstWednesdayKey(baseDate)];

  const existingRows = await db
    .select()
    .from(demoDayAssignments)
    .where(inArray(demoDayAssignments.date, dateKeys));
  const existingByDate = new Map(existingRows.map((row) => [row.date, row]));

  const eligibleIds = new Set(eligibleUsers.map((user) => user.userId));
  const futureKeys = assignableKeys.filter((dateKey) => dateKey >= todayKey);
  const toAssign: string[] = [];
  let kept = 0;

  for (const dateKey of futureKeys) {
    const row = existingByDate.get(dateKey);
    if (row?.userId && eligibleIds.has(row.userId)) {
      kept += 1;
      continue;
    }
    toAssign.push(dateKey);
  }

  const history = await db
    .select()
    .from(demoDayAssignments)
    .orderBy(desc(demoDayAssignments.date));
  let available = buildAvailability(eligibleUsers, history);
  let updated = 0;
  let replaced = 0;
  let filled = 0;

  for (const dateKey of toAssign) {
    let assignee: DemoDayAssignee | null = null;
    if (eligibleUsers.length > 0) {
      if (available.length === 0) {
        available = [...eligibleUsers];
      }
      assignee = pickRandom(available);
      if (assignee) {
        available = available.filter((user) => user.userId !== assignee?.userId);
      }
    }

    const row: DemoDayAssignment = {
      date: dateKey,
      userId: assignee?.userId ?? null,
      userName: assignee?.name ?? 'TBD',
      assignedAt: Date.now(),
    };

    await db
      .insert(demoDayAssignments)
      .values({
        date: row.date,
        userId: row.userId,
        userName: row.userName,
        assignedAt: row.assignedAt,
      })
      .onConflictDoUpdate({
        target: demoDayAssignments.date,
        set: {
          userId: row.userId,
          userName: row.userName,
          assignedAt: row.assignedAt,
        },
      });

    updated += 1;
    if (existingByDate.get(dateKey)?.userId) {
      replaced += 1;
    } else {
      filled += 1;
    }
  }

  return {
    checked: futureKeys.length,
    kept,
    updated,
    replaced,
    filled,
  };
}

export async function getEligibleDemoDayRoster(): Promise<DemoDayAssignee[]> {
  const user = await currentUser();
  if (!user) return [];
  const rule = await getScheduleRuleConfig('demo-day');

  try {
    const client = await clerkClient();
    const users = await client.users.getUserList({ limit: 200 });
    return users.data
      .map((rosterUser) => {
        const rankCategory =
          rosterUser.publicMetadata.rankCategory as RankCategory | null;
        const rank = rosterUser.publicMetadata.rank as Rank | null;
        if (!isEligibleForRule({ rule, rankCategory, rank })) {
          return null;
        }
        const fullName =
          `${rosterUser.firstName ?? ''} ${rosterUser.lastName ?? ''}`.trim();
        const name =
          fullName ||
          rosterUser.username ||
          rosterUser.emailAddresses[0]?.emailAddress ||
          null;
        if (!name) return null;
        return {
          userId: rosterUser.id,
          name,
        };
      })
      .filter((value): value is DemoDayAssignee => Boolean(value));
  } catch (error) {
    console.error('Failed to load roster names', error);
    return [];
  }
}

export async function getHostHubRoster(): Promise<HostHubRosterMember[]> {
  const user = await currentUser();
  if (!user) return [];

  try {
    const client = await clerkClient();
    const users = await client.users.getUserList({ limit: 200 });
    return users.data
      .map((rosterUser) => {
        const fullName =
          `${rosterUser.firstName ?? ''} ${rosterUser.lastName ?? ''}`.trim();
        const name =
          fullName ||
          rosterUser.username ||
          rosterUser.emailAddresses[0]?.emailAddress ||
          rosterUser.id;
        return {
          userId: rosterUser.id,
          name,
        };
      })
      .filter((value) => value.name.trim().length > 0);
  } catch (error) {
    console.error('Failed to load HostHub roster', error);
    return [];
  }
}

export async function getEligibleStandupRoster(): Promise<StandupAssignee[]> {
  const user = await currentUser();
  if (!user) return [];
  const rule = await getScheduleRuleConfig('standup');

  try {
    const client = await clerkClient();
    const users = await client.users.getUserList({ limit: 200 });
    return users.data
      .map((rosterUser) => {
        const rankCategory =
          rosterUser.publicMetadata.rankCategory as RankCategory | null;
        const rank = rosterUser.publicMetadata.rank as Rank | null;
        if (!isEligibleForRule({ rule, rankCategory, rank })) {
          return null;
        }

        const fullName =
          `${rosterUser.firstName ?? ''} ${rosterUser.lastName ?? ''}`.trim();
        const name =
          fullName ||
          rosterUser.username ||
          rosterUser.emailAddresses[0]?.emailAddress ||
          null;
        if (!name) return null;
        return {
          userId: rosterUser.id,
          name,
        };
      })
      .filter((value): value is StandupAssignee => Boolean(value));
  } catch (error) {
    console.error('Failed to load standup roster', error);
    return [];
  }
}

export async function getEligibleSecurityShiftRoster(): Promise<
  SecurityShiftAssignee[]
> {
  const user = await currentUser();
  if (!user) return [];
  const rule = await getScheduleRuleConfig('security-shift');

  try {
    const client = await clerkClient();
    const users = await client.users.getUserList({ limit: 200 });
    return users.data
      .map((rosterUser) => {
        const rankCategory =
          rosterUser.publicMetadata.rankCategory as RankCategory | null;
        const rank = rosterUser.publicMetadata.rank as Rank | null;
        if (!isEligibleForRule({ rule, rankCategory, rank })) {
          return null;
        }

        const fullName =
          `${rosterUser.firstName ?? ''} ${rosterUser.lastName ?? ''}`.trim();
        const name =
          fullName ||
          rosterUser.username ||
          rosterUser.emailAddresses[0]?.emailAddress ||
          null;
        if (!name) return null;
        return {
          userId: rosterUser.id,
          name,
        };
      })
      .filter(
        (value): value is SecurityShiftAssignee => Boolean(value),
      );
  } catch (error) {
    console.error('Failed to load security shift roster', error);
    return [];
  }
}

export async function ensureStandupAssignmentsForWindow({
  baseDate,
  eligibleUsers,
}: {
  baseDate: Date;
  eligibleUsers: StandupAssignee[];
}): Promise<Record<string, StandupAssignment>> {
  const { end: currentMonthEnd } = getMonthRange(baseDate);
  const currentMonthEndKey = toDateKey(currentMonthEnd);
  await db
    .delete(standupAssignments)
    .where(gt(standupAssignments.date, currentMonthEndKey));
  const todayKey = toDateKey(new Date());
  const dateKeys = getStandupDateKeysForWindow(baseDate);
  const assignableKeys = new Set(getStandupDateKeysForMonth(baseDate));

  const existingRows = await db
    .select()
    .from(standupAssignments)
    .where(inArray(standupAssignments.date, dateKeys));

  const assignments = new Map<string, StandupAssignment>();
  existingRows.forEach((row) => {
    const isFutureOrToday = row.date >= todayKey;
    if (!row.userId && isFutureOrToday) {
      return;
    }
    assignments.set(row.date, {
      date: row.date,
      userId: row.userId ?? null,
      userName: row.userName,
      assignedAt: row.assignedAt,
    });
  });

  const missingAssignableKeys = dateKeys.filter(
    (dateKey) => assignableKeys.has(dateKey) && !assignments.has(dateKey),
  );

  if (missingAssignableKeys.length === 0 || eligibleUsers.length === 0) {
    return Object.fromEntries(assignments.entries());
  }

  const history = await db
    .select()
    .from(standupAssignments)
    .orderBy(desc(standupAssignments.date));

  const eligibleIds = new Set(eligibleUsers.map((user) => user.userId));
  const used = new Set<string>();
  for (const row of history) {
    if (row.userId && eligibleIds.has(row.userId)) {
      used.add(row.userId);
      if (used.size >= eligibleUsers.length) break;
    }
  }

  let available = eligibleUsers.filter(
    (user) => !used.has(user.userId),
  );

  for (const dateKey of missingAssignableKeys) {
    if (assignments.has(dateKey)) continue;

    let assignee: StandupAssignee | null = null;
    if (eligibleUsers.length > 0) {
      if (available.length === 0) {
        available = [...eligibleUsers];
      }
      assignee = pickRandom(available);
      if (assignee) {
        available = available.filter(
          (user) => user.userId !== assignee?.userId,
        );
      }
    }

    const row: StandupAssignment = {
      date: dateKey,
      userId: assignee?.userId ?? null,
      userName: assignee?.name ?? 'TBD',
      assignedAt: Date.now(),
    };

    await db
      .insert(standupAssignments)
      .values({
        date: row.date,
        userId: row.userId,
        userName: row.userName,
        assignedAt: row.assignedAt,
      })
      .onConflictDoUpdate({
        target: standupAssignments.date,
        set: {
          userId: row.userId,
          userName: row.userName,
          assignedAt: row.assignedAt,
        },
      });

    assignments.set(dateKey, row);
  }

  return Object.fromEntries(assignments.entries());
}

export async function refreshStandupAssignmentsForWindow({
  baseDate,
  eligibleUsers,
  scope = 'month',
}: {
  baseDate: Date;
  eligibleUsers: StandupAssignee[];
  scope?: 'month' | 'window';
}): Promise<RefreshAssignmentsSummary> {
  const { end: currentMonthEnd } = getMonthRange(baseDate);
  const currentMonthEndKey = toDateKey(currentMonthEnd);
  await db
    .delete(standupAssignments)
    .where(gt(standupAssignments.date, currentMonthEndKey));

  const todayKey = toDateKey(new Date());
  const dateKeys = getStandupDateKeysForWindow(baseDate);
  const assignableKeys =
    scope === 'window'
      ? dateKeys
      : getStandupDateKeysForMonth(baseDate);

  const existingRows = await db
    .select()
    .from(standupAssignments)
    .where(inArray(standupAssignments.date, dateKeys));
  const existingByDate = new Map(existingRows.map((row) => [row.date, row]));

  const eligibleIds = new Set(eligibleUsers.map((user) => user.userId));
  const futureKeys = assignableKeys.filter((dateKey) => dateKey >= todayKey);
  const toAssign: string[] = [];
  let kept = 0;

  for (const dateKey of futureKeys) {
    const row = existingByDate.get(dateKey);
    if (row?.userId && eligibleIds.has(row.userId)) {
      kept += 1;
      continue;
    }
    toAssign.push(dateKey);
  }

  const history = await db
    .select()
    .from(standupAssignments)
    .orderBy(desc(standupAssignments.date));
  let available = buildAvailability(eligibleUsers, history);
  let updated = 0;
  let replaced = 0;
  let filled = 0;

  for (const dateKey of toAssign) {
    let assignee: StandupAssignee | null = null;
    if (eligibleUsers.length > 0) {
      if (available.length === 0) {
        available = [...eligibleUsers];
      }
      assignee = pickRandom(available);
      if (assignee) {
        available = available.filter((user) => user.userId !== assignee?.userId);
      }
    }

    const row: StandupAssignment = {
      date: dateKey,
      userId: assignee?.userId ?? null,
      userName: assignee?.name ?? 'TBD',
      assignedAt: Date.now(),
    };

    await db
      .insert(standupAssignments)
      .values({
        date: row.date,
        userId: row.userId,
        userName: row.userName,
        assignedAt: row.assignedAt,
      })
      .onConflictDoUpdate({
        target: standupAssignments.date,
        set: {
          userId: row.userId,
          userName: row.userName,
          assignedAt: row.assignedAt,
        },
      });

    updated += 1;
    if (existingByDate.get(dateKey)?.userId) {
      replaced += 1;
    } else {
      filled += 1;
    }
  }

  return {
    checked: futureKeys.length,
    kept,
    updated,
    replaced,
    filled,
  };
}

export async function ensureSecurityShiftAssignmentsForWindow({
  baseDate,
  eligibleUsers,
}: {
  baseDate: Date;
  eligibleUsers: SecurityShiftAssignee[];
}): Promise<Record<string, SecurityShiftAssignment>> {
  const { end: currentMonthEnd } = getMonthRange(baseDate);
  const currentMonthEndKey = toDateKey(currentMonthEnd);
  await db
    .delete(securityShiftAssignments)
    .where(gt(securityShiftAssignments.date, currentMonthEndKey));
  const todayKey = toDateKey(new Date());
  const dateKeys = getSecurityShiftDateKeysForWindow(baseDate);
  const assignableKeys = new Set(getSecurityShiftDateKeysForMonth(baseDate));

  const existingRows = await db
    .select()
    .from(securityShiftAssignments)
    .where(inArray(securityShiftAssignments.date, dateKeys));

  const assignments = new Map<string, SecurityShiftAssignment>();
  existingRows.forEach((row) => {
    const eventType = row.eventType as SecurityShiftEventType;
    if (!SECURITY_SHIFT_EVENT_TYPES.includes(eventType)) return;
    const isFutureOrToday = row.date >= todayKey;
    if (!row.userId && isFutureOrToday) {
      return;
    }
    assignments.set(row.id, {
      id: row.id,
      date: row.date,
      eventType,
      userId: row.userId ?? null,
      userName: row.userName,
      assignedAt: row.assignedAt,
    });
  });

  const missingAssignableEntries: Array<{
    id: string;
    dateKey: string;
    eventType: SecurityShiftEventType;
  }> = [];

  dateKeys.forEach((dateKey) => {
    if (!assignableKeys.has(dateKey)) return;
    SECURITY_SHIFT_EVENT_TYPES.forEach((eventType) => {
      const id = getSecurityShiftAssignmentId(dateKey, eventType);
      if (assignments.has(id)) return;
      missingAssignableEntries.push({ id, dateKey, eventType });
    });
  });

  if (missingAssignableEntries.length === 0 || eligibleUsers.length === 0) {
    return Object.fromEntries(assignments.entries());
  }

  const history = await db
    .select()
    .from(securityShiftAssignments)
    .orderBy(desc(securityShiftAssignments.date));
  let available = buildAvailability(eligibleUsers, history);

  for (const entry of missingAssignableEntries) {
    if (assignments.has(entry.id)) continue;

    let assignee: SecurityShiftAssignee | null = null;
    if (eligibleUsers.length > 0) {
      if (available.length === 0) {
        available = [...eligibleUsers];
      }
      assignee = pickRandom(available);
      if (assignee) {
        available = available.filter(
          (user) => user.userId !== assignee?.userId,
        );
      }
    }

    const row: SecurityShiftAssignment = {
      id: entry.id,
      date: entry.dateKey,
      eventType: entry.eventType,
      userId: assignee?.userId ?? null,
      userName: assignee?.name ?? 'TBD',
      assignedAt: Date.now(),
    };

    await db
      .insert(securityShiftAssignments)
      .values({
        id: row.id,
        date: row.date,
        eventType: row.eventType,
        userId: row.userId,
        userName: row.userName,
        assignedAt: row.assignedAt,
      })
      .onConflictDoUpdate({
        target: securityShiftAssignments.id,
        set: {
          eventType: row.eventType,
          userId: row.userId,
          userName: row.userName,
          assignedAt: row.assignedAt,
        },
      });

    assignments.set(entry.id, row);
  }

  return Object.fromEntries(assignments.entries());
}

export async function refreshSecurityShiftAssignmentsForWindow({
  baseDate,
  eligibleUsers,
  scope = 'month',
}: {
  baseDate: Date;
  eligibleUsers: SecurityShiftAssignee[];
  scope?: 'month' | 'window';
}): Promise<RefreshAssignmentsSummary> {
  const { end: currentMonthEnd } = getMonthRange(baseDate);
  const currentMonthEndKey = toDateKey(currentMonthEnd);
  await db
    .delete(securityShiftAssignments)
    .where(gt(securityShiftAssignments.date, currentMonthEndKey));

  const todayKey = toDateKey(new Date());
  const dateKeys = getSecurityShiftDateKeysForWindow(baseDate);
  const assignableKeys =
    scope === 'window'
      ? dateKeys
      : getSecurityShiftDateKeysForMonth(baseDate);

  const existingRows = await db
    .select()
    .from(securityShiftAssignments)
    .where(inArray(securityShiftAssignments.date, dateKeys));
  const existingById = new Map(
    existingRows.map((row) => [row.id, row]),
  );

  const eligibleIds = new Set(eligibleUsers.map((user) => user.userId));
  const futureKeys = assignableKeys.filter((dateKey) => dateKey >= todayKey);
  const toAssign: Array<{
    id: string;
    dateKey: string;
    eventType: SecurityShiftEventType;
    hadUserId: boolean;
  }> = [];
  let kept = 0;

  for (const dateKey of futureKeys) {
    for (const eventType of SECURITY_SHIFT_EVENT_TYPES) {
      const id = getSecurityShiftAssignmentId(dateKey, eventType);
      const row = existingById.get(id);
      if (row?.userId && eligibleIds.has(row.userId)) {
        kept += 1;
        continue;
      }
      toAssign.push({
        id,
        dateKey,
        eventType,
        hadUserId: Boolean(row?.userId),
      });
    }
  }

  const history = await db
    .select()
    .from(securityShiftAssignments)
    .orderBy(desc(securityShiftAssignments.date));
  let available = buildAvailability(eligibleUsers, history);
  let updated = 0;
  let replaced = 0;
  let filled = 0;

  for (const entry of toAssign) {
    let assignee: SecurityShiftAssignee | null = null;
    if (eligibleUsers.length > 0) {
      if (available.length === 0) {
        available = [...eligibleUsers];
      }
      assignee = pickRandom(available);
      if (assignee) {
        available = available.filter(
          (user) => user.userId !== assignee?.userId,
        );
      }
    }

    const row: SecurityShiftAssignment = {
      id: entry.id,
      date: entry.dateKey,
      eventType: entry.eventType,
      userId: assignee?.userId ?? null,
      userName: assignee?.name ?? 'TBD',
      assignedAt: Date.now(),
    };

    await db
      .insert(securityShiftAssignments)
      .values({
        id: row.id,
        date: row.date,
        eventType: row.eventType,
        userId: row.userId,
        userName: row.userName,
        assignedAt: row.assignedAt,
      })
      .onConflictDoUpdate({
        target: securityShiftAssignments.id,
        set: {
          eventType: row.eventType,
          userId: row.userId,
          userName: row.userName,
          assignedAt: row.assignedAt,
        },
      });

    updated += 1;
    if (entry.hadUserId) {
      replaced += 1;
    } else {
      filled += 1;
    }
  }

  return {
    checked: futureKeys.length * SECURITY_SHIFT_EVENT_TYPES.length,
    kept,
    updated,
    replaced,
    filled,
  };
}

export async function listStandupAssignmentsInRange({
  startDate,
  endDate,
}: {
  startDate: Date;
  endDate: Date;
}): Promise<StandupAssignment[]> {
  const startKey = toDateKey(startDate);
  const endKey = toDateKey(endDate);
  const rows = await db
    .select()
    .from(standupAssignments)
    .where(
      and(
        gte(standupAssignments.date, startKey),
        lte(standupAssignments.date, endKey),
      ),
    )
    .orderBy(desc(standupAssignments.date));

  return rows.map((row) => ({
    date: row.date,
    userId: row.userId ?? null,
    userName: row.userName,
    assignedAt: row.assignedAt,
  }));
}

export async function listSecurityShiftAssignmentsInRange({
  startDate,
  endDate,
}: {
  startDate: Date;
  endDate: Date;
}): Promise<SecurityShiftAssignment[]> {
  const startKey = toDateKey(startDate);
  const endKey = toDateKey(endDate);
  const rows = await db
    .select()
    .from(securityShiftAssignments)
    .where(
      and(
        gte(securityShiftAssignments.date, startKey),
        lte(securityShiftAssignments.date, endKey),
      ),
    )
    .orderBy(desc(securityShiftAssignments.date));

  return rows
    .map((row) => {
      const eventType = row.eventType as SecurityShiftEventType;
      if (!SECURITY_SHIFT_EVENT_TYPES.includes(eventType)) return null;
      return {
        id: row.id,
        date: row.date,
        eventType,
        userId: row.userId ?? null,
        userName: row.userName,
        assignedAt: row.assignedAt,
      };
    })
    .filter(
      (row): row is SecurityShiftAssignment => Boolean(row),
    );
}

export async function listScheduleEventOverridesInRange({
  startDate,
  endDate,
}: {
  startDate: Date;
  endDate: Date;
}): Promise<ScheduleEventOverride[]> {
  const startKey = toDateKey(startDate);
  const endKey = toDateKey(endDate);
  const rows = await db
    .select()
    .from(scheduleEventOverrides)
    .where(
      or(
        and(
          gte(scheduleEventOverrides.date, startKey),
          lte(scheduleEventOverrides.date, endKey),
        ),
        and(
          gte(scheduleEventOverrides.movedToDate, startKey),
          lte(scheduleEventOverrides.movedToDate, endKey),
        ),
      ),
    )
    .orderBy(desc(scheduleEventOverrides.date));

  return rows
    .map((row) => {
      if (!isHostHubEventType(row.eventType)) return null;
      const movedToDate =
        row.movedToDate &&
        isValidDateKey(row.movedToDate) &&
        row.movedToDate !== row.date
          ? row.movedToDate
          : null;
      return {
        id: row.id,
        date: row.date,
        eventType: row.eventType,
        movedToDate,
        time: row.time ?? null,
        isCanceled: row.isCanceled ?? false,
        overrideUserId: row.overrideUserId ?? null,
        overrideUserName: row.overrideUserName ?? null,
        updatedAt: row.updatedAt,
        updatedBy: row.updatedBy ?? null,
      };
    })
    .filter((row): row is ScheduleEventOverride => Boolean(row));
}

export async function pruneDemoDayHistory(baseDate: Date = new Date()) {
  const cutoffKey = getHistoryCutoffKey(baseDate);
  await db
    .delete(demoDayAssignments)
    .where(lt(demoDayAssignments.date, cutoffKey));
}

export async function listDemoDayAssignmentsInRange({
  startDate,
  endDate,
}: {
  startDate: Date;
  endDate: Date;
}): Promise<DemoDayAssignment[]> {
  const startKey = toDateKey(startDate);
  const endKey = toDateKey(endDate);
  const rows = await db
    .select()
    .from(demoDayAssignments)
    .where(
      and(
        gte(demoDayAssignments.date, startKey),
        lte(demoDayAssignments.date, endKey),
      ),
    )
    .orderBy(desc(demoDayAssignments.date));

  return rows.map((row) => ({
    date: row.date,
    userId: row.userId ?? null,
    userName: row.userName,
    assignedAt: row.assignedAt,
  }));
}

export async function listDemoDayHistory({
  upToDate = new Date(),
}: {
  upToDate?: Date;
} = {}): Promise<DemoDayAssignment[]> {
  await pruneDemoDayHistory(upToDate);
  const todayKey = toDateKey(upToDate);
  const cutoffKey = getHistoryCutoffKey(upToDate);
  const rows = await db
    .select()
    .from(demoDayAssignments)
    .where(
      and(
        gte(demoDayAssignments.date, cutoffKey),
        lte(demoDayAssignments.date, todayKey),
      ),
    )
    .orderBy(desc(demoDayAssignments.date));

  return rows.map((row) => ({
    date: row.date,
    userId: row.userId ?? null,
    userName: row.userName,
    assignedAt: row.assignedAt,
  }));
}
