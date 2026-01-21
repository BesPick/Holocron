import { clerkClient } from '@clerk/nextjs/server';
import { and, eq } from 'drizzle-orm';

import { formatEventType } from '@/lib/announcements';
import { getEventOverrideId } from '@/lib/hosthub-events';
import {
  formatShortDateLabel,
  isFirstWednesday,
  resolveEventTime,
} from '@/lib/hosthub-schedule-utils';
import { getPrimaryEmail } from '@/server/auth';
import { db } from '@/server/db/client';
import { shiftNotifications } from '@/server/db/schema';
import {
  getScheduleRuleConfig,
  listDemoDayAssignmentsInRange,
  listScheduleEventOverridesInRange,
  listStandupAssignmentsInRange,
  toDateKey,
} from '@/server/services/hosthub-schedule';
import {
  findMattermostUserIdByEmail,
  getMattermostEventChannelId,
  isMattermostConfigured,
  postMattermostDirectMessage,
  postMattermostMessage,
} from '@/server/integrations/mattermost';
import type { ActivityType } from '@/types/db';

type MoraleAnnouncementSummary = {
  title: string;
  eventType: ActivityType;
};

type ShiftEvent = {
  eventType: 'standup' | 'demo';
  dateKey: string;
  time: string;
  userId: string;
  userName: string;
  movedFromKey?: string;
};

const STANDUP_DAYS = new Set([1, 4]);

const getAppBaseUrl = () => {
  const raw =
    process.env.APP_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_APP_BASE_URL ??
    null;
  if (!raw) return null;
  return raw.replace(/\/+$/, '');
};

const parseDateKey = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  if ([year, month, day].some((part) => Number.isNaN(part))) return null;
  return new Date(year, month - 1, day);
};

const formatTimeLabel = (time: string) => {
  if (!time || time === 'TBD') return 'TBD';
  const [hoursRaw, minutesRaw] = time.split(':').map(Number);
  if (
    Number.isNaN(hoursRaw) ||
    Number.isNaN(minutesRaw) ||
    hoursRaw < 0 ||
    hoursRaw > 23 ||
    minutesRaw < 0 ||
    minutesRaw > 59
  ) {
    return time;
  }
  const suffix = hoursRaw >= 12 ? 'PM' : 'AM';
  const hours = hoursRaw % 12 || 12;
  return `${hours}:${String(minutesRaw).padStart(2, '0')} ${suffix}`;
};

const resolveMattermostUserId = async (
  clerkUserId: string,
  cache: Map<string, string | null>,
) => {
  if (cache.has(clerkUserId)) return cache.get(clerkUserId) ?? null;
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(clerkUserId);
    const metadata = user.publicMetadata as
      | { mattermostUserId?: string | null }
      | undefined;
    const rawMetadataId = metadata?.mattermostUserId;
    const metadataId =
      typeof rawMetadataId === 'string' ? rawMetadataId.trim() : '';
    if (metadataId) {
      cache.set(clerkUserId, metadataId);
      return metadataId;
    }
    const email = getPrimaryEmail(user);
    if (!email) {
      cache.set(clerkUserId, null);
      return null;
    }
    const mattermostId = await findMattermostUserIdByEmail(email);
    cache.set(clerkUserId, mattermostId ?? null);
    return mattermostId ?? null;
  } catch (error) {
    console.error('Failed to resolve Mattermost user', error);
    cache.set(clerkUserId, null);
    return null;
  }
};

export async function notifyMoraleAnnouncementPublished(
  announcement: MoraleAnnouncementSummary,
) {
  if (!isMattermostConfigured()) return;
  const channelId = getMattermostEventChannelId();
  if (!channelId) return;
  const baseUrl = getAppBaseUrl();
  if (!baseUrl) return;
  const moraleUrl = new URL('/morale', baseUrl).toString();
  const label =
    announcement.eventType === 'announcements'
      ? 'Announcement'
      : formatEventType(announcement.eventType);
  const message = `New ${label} posted on Morale: **${announcement.title}**\n${moraleUrl}`;
  await postMattermostMessage(channelId, message);
}

export async function notifyHostHubShiftsForTomorrow() {
  const baseUrl = getAppBaseUrl();
  if (!baseUrl || !isMattermostConfigured()) {
    return { sent: 0, skipped: 0, errors: 0 };
  }

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 1);
  const targetKey = toDateKey(targetDate);
  const scheduleRules = await Promise.all([
    getScheduleRuleConfig('demo-day'),
    getScheduleRuleConfig('standup'),
  ]);
  const demoDefaultTime = scheduleRules[0].defaultTime;
  const standupDefaultTime = scheduleRules[1].defaultTime;

  const overrides = await listScheduleEventOverridesInRange({
    startDate: targetDate,
    endDate: targetDate,
  });
  const overridesById = new Map(
    overrides.map((override) => [
      getEventOverrideId(override.date, override.eventType),
      override,
    ]),
  );
  const demoMoveTargets = overrides.filter(
    (override) =>
      override.eventType === 'demo' && override.movedToDate === targetKey,
  );
  const demoMoveSources = new Set(
    overrides
      .filter(
        (override) =>
          override.eventType === 'demo' &&
          override.movedToDate &&
          override.movedToDate !== override.date,
      )
      .map((override) => override.date),
  );

  const demoSourceDates = new Set<string>(
    demoMoveTargets.map((override) => override.date),
  );
  if (isFirstWednesday(targetDate) && !demoMoveSources.has(targetKey)) {
    demoSourceDates.add(targetKey);
  }

  const standupAssignments =
    STANDUP_DAYS.has(targetDate.getDay())
      ? await listStandupAssignmentsInRange({
          startDate: targetDate,
          endDate: targetDate,
        })
      : [];
  const standupAssignment =
    standupAssignments.find((entry) => entry.date === targetKey) ?? null;

  let demoAssignments: Record<string, { userId: string | null; userName: string }> =
    {};
  if (demoSourceDates.size > 0) {
    const dateList = Array.from(demoSourceDates).sort();
    const startDate = parseDateKey(dateList[0]);
    const endDate = parseDateKey(dateList[dateList.length - 1]);
    if (startDate && endDate) {
      const rows = await listDemoDayAssignmentsInRange({
        startDate,
        endDate,
      });
      demoAssignments = Object.fromEntries(
        rows.map((row) => [row.date, row]),
      );
    }
  }

  const events: ShiftEvent[] = [];
  if (STANDUP_DAYS.has(targetDate.getDay())) {
    const override = overridesById.get(getEventOverrideId(targetKey, 'standup'));
    if (!override?.isCanceled) {
      const userId = override?.overrideUserId ?? standupAssignment?.userId ?? null;
      const userName =
        override?.overrideUserName ?? standupAssignment?.userName ?? 'TBD';
      if (userId) {
        events.push({
          eventType: 'standup',
          dateKey: targetKey,
          time: resolveEventTime(override?.time, standupDefaultTime),
          userId,
          userName,
        });
      }
    }
  }

  demoMoveTargets.forEach((override) => {
    if (override.isCanceled) return;
    const assignment = demoAssignments[override.date];
    const userId = override.overrideUserId ?? assignment?.userId ?? null;
    const userName =
      override.overrideUserName ?? assignment?.userName ?? 'TBD';
    if (!userId) return;
    events.push({
      eventType: 'demo',
      dateKey: targetKey,
      time: resolveEventTime(override.time, demoDefaultTime),
      userId,
      userName,
      movedFromKey: override.date !== targetKey ? override.date : undefined,
    });
  });

  if (isFirstWednesday(targetDate) && !demoMoveSources.has(targetKey)) {
    const override = overridesById.get(getEventOverrideId(targetKey, 'demo'));
    if (!override?.isCanceled) {
      const assignment = demoAssignments[targetKey];
      const userId = override?.overrideUserId ?? assignment?.userId ?? null;
      const userName =
        override?.overrideUserName ?? assignment?.userName ?? 'TBD';
      if (userId) {
        events.push({
          eventType: 'demo',
          dateKey: targetKey,
          time: resolveEventTime(override?.time, demoDefaultTime),
          userId,
          userName,
        });
      }
    }
  }

  let sent = 0;
  let skipped = 0;
  let errors = 0;
  const userCache = new Map<string, string | null>();
  const docsUrl = new URL('/hosthub/docs', baseUrl).toString();

  for (const event of events) {
    const notificationId = `${event.eventType}:${event.dateKey}:${event.userId}`;
    const existing = await db
      .select()
      .from(shiftNotifications)
      .where(
        and(
          eq(shiftNotifications.id, notificationId),
          eq(shiftNotifications.userId, event.userId),
        ),
      )
      .get();
    if (existing) {
      skipped += 1;
      continue;
    }

    const mattermostUserId = await resolveMattermostUserId(
      event.userId,
      userCache,
    );
    if (!mattermostUserId) {
      skipped += 1;
      continue;
    }

    const dateLabel = formatShortDateLabel(targetDate);
    const timeLabel = formatTimeLabel(event.time);
    const movedLabel = event.movedFromKey
      ? (() => {
          const movedDate = parseDateKey(event.movedFromKey);
          return movedDate
            ? ` (moved from ${formatShortDateLabel(movedDate)})`
            : '';
        })()
      : '';
    const label = event.eventType === 'demo' ? 'Demo Day' : 'Standup';
    const message = `Reminder: You are scheduled for ${label} on ${dateLabel} at ${timeLabel}${movedLabel}. Details: ${docsUrl}`;

    const result = await postMattermostDirectMessage(
      mattermostUserId,
      message,
    );
    if (!result) {
      errors += 1;
      continue;
    }

    await db.insert(shiftNotifications).values({
      id: notificationId,
      eventType: event.eventType,
      eventDate: event.dateKey,
      userId: event.userId,
      sentAt: Date.now(),
    });
    sent += 1;
  }

  return { sent, skipped, errors };
}
