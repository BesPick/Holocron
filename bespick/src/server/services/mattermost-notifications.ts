import { clerkClient } from '@clerk/nextjs/server';
import { and, eq } from 'drizzle-orm';

import { formatEventType } from '@/lib/announcements';
import {
  SECURITY_SHIFT_EVENT_TYPES,
  getEventOverrideId,
  getSecurityShiftWindow,
  isSecurityShiftEventType,
  type HostHubEventType,
} from '@/lib/hosthub-events';
import {
  formatShortDateLabel,
  isSecondWednesday,
  resolveEventTime,
} from '@/lib/hosthub-schedule-utils';
import { getPrimaryEmail } from '@/server/auth';
import { db } from '@/server/db/client';
import { shiftNotifications } from '@/server/db/schema';
import {
  getScheduleRuleConfig,
  listDemoDayAssignmentsInRange,
  listScheduleEventOverridesInRange,
  listSecurityShiftAssignmentsInRange,
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
import { getMattermostNotificationConfig } from '@/server/services/site-settings';
import type { ActivityType } from '@/types/db';

type MoraleAnnouncementSummary = {
  title: string;
  eventType: ActivityType;
};

type ShiftEvent = {
  eventType: HostHubEventType;
  dateKey: string;
  time: string;
  userId: string;
  userName: string;
  movedFromKey?: string;
};

export type HostHubScheduleChange = {
  eventType: HostHubEventType;
  dateKey: string;
  oldUserId: string | null;
  newUserId: string | null;
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

const formatTimeRangeLabel = (startTime: string, endTime: string) => {
  const startLabel = formatTimeLabel(startTime);
  const endLabel = formatTimeLabel(endTime);
  if (startLabel === 'TBD' || endLabel === 'TBD') return 'TBD';
  return `${startLabel} - ${endLabel}`;
};

const shouldNotifyEventType = (
  eventType: HostHubEventType,
  config: Awaited<ReturnType<typeof getMattermostNotificationConfig>>,
) => {
  if (eventType === 'standup') return config.hosthubStandupEnabled;
  if (eventType === 'demo') return config.hosthubDemoEnabled;
  if (eventType === 'security-am') return config.hosthubSecurityAmEnabled;
  if (eventType === 'security-pm') return config.hosthubSecurityPmEnabled;
  return false;
};

const resolveMattermostUserId = async (
  clerkUserId: string,
  cache: Map<string, string | null>,
) => {
  if (cache.has(clerkUserId)) return cache.get(clerkUserId) ?? null;
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(clerkUserId);
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
  const notificationConfig = await getMattermostNotificationConfig();
  if (!notificationConfig.moraleEnabled) return;
  const channelId = getMattermostEventChannelId();
  if (!channelId) return;
  const baseUrl = getAppBaseUrl();
  if (!baseUrl) return;
  const moraleUrl = new URL('/morale', baseUrl).toString();
  const label =
    announcement.eventType === 'announcements'
      ? 'Announcement'
      : formatEventType(announcement.eventType);
  const message = `New ${label} card posted: **${announcement.title}**\n${moraleUrl}`;
  await postMattermostMessage(channelId, message);
}

export async function notifyHostHubShiftsForTomorrow() {
  const baseUrl = getAppBaseUrl();
  if (!baseUrl || !isMattermostConfigured()) {
    return { sent: 0, skipped: 0, errors: 0 };
  }
  const notificationConfig = await getMattermostNotificationConfig();
  const canNotifyStandup = notificationConfig.hosthubStandupEnabled;
  const canNotifyDemo = notificationConfig.hosthubDemoEnabled;
  const canNotifySecurity =
    notificationConfig.hosthubSecurityAmEnabled ||
    notificationConfig.hosthubSecurityPmEnabled;
  if (!canNotifyStandup && !canNotifyDemo && !canNotifySecurity) {
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
  const demoMoveTargets = canNotifyDemo
    ? overrides.filter(
        (override) =>
          override.eventType === 'demo' && override.movedToDate === targetKey,
      )
    : [];
  const demoMoveSources = new Set(
    (canNotifyDemo ? overrides : [])
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
  if (isSecondWednesday(targetDate) && !demoMoveSources.has(targetKey)) {
    demoSourceDates.add(targetKey);
  }

  const standupAssignments =
    canNotifyStandup && STANDUP_DAYS.has(targetDate.getDay())
      ? await listStandupAssignmentsInRange({
          startDate: targetDate,
          endDate: targetDate,
        })
      : [];
  const standupAssignment =
    standupAssignments.find((entry) => entry.date === targetKey) ?? null;

  const securityAssignments = canNotifySecurity
    ? await listSecurityShiftAssignmentsInRange({
        startDate: targetDate,
        endDate: targetDate,
      })
    : [];
  const securityAssignmentsByType = new Map(
    securityAssignments.map((assignment) => [
      assignment.eventType,
      assignment,
    ]),
  );

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
  if (canNotifyStandup && STANDUP_DAYS.has(targetDate.getDay())) {
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

  if (canNotifySecurity) {
    const securityTypes = SECURITY_SHIFT_EVENT_TYPES.filter(
      (eventType) =>
        eventType === 'security-am'
          ? notificationConfig.hosthubSecurityAmEnabled
          : notificationConfig.hosthubSecurityPmEnabled,
    );
    securityTypes.forEach((eventType) => {
      const override = overridesById.get(getEventOverrideId(targetKey, eventType));
      if (override?.isCanceled) return;
      const assignment = securityAssignmentsByType.get(eventType) ?? null;
      const userId = override?.overrideUserId ?? assignment?.userId ?? null;
      const userName =
        override?.overrideUserName ?? assignment?.userName ?? 'TBD';
      if (!userId) return;
      const window = getSecurityShiftWindow(eventType);
      events.push({
        eventType,
        dateKey: targetKey,
        time: window?.startTime ?? 'TBD',
        userId,
        userName,
      });
    });
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

  if (isSecondWednesday(targetDate) && !demoMoveSources.has(targetKey)) {
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
    const timeLabel = isSecurityShiftEventType(event.eventType)
      ? (() => {
          const window = getSecurityShiftWindow(event.eventType);
          return window
            ? formatTimeRangeLabel(window.startTime, window.endTime)
            : 'TBD';
        })()
      : formatTimeLabel(event.time);
    const movedLabel = event.movedFromKey
      ? (() => {
          const movedDate = parseDateKey(event.movedFromKey);
          return movedDate
            ? ` (moved from ${formatShortDateLabel(movedDate)})`
            : '';
        })()
      : '';
    const label = (() => {
      if (isSecurityShiftEventType(event.eventType)) {
        const window = getSecurityShiftWindow(event.eventType);
        return window ? `${window.label} Security` : 'Security Shift';
      }
      return event.eventType === 'demo' ? 'Demo Day' : 'Standup';
    })();
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

export async function notifyHostHubScheduleChanges(
  changes: HostHubScheduleChange[],
  options?: { allowOverrideAssignee?: boolean },
) {
  if (!isMattermostConfigured()) {
    return { sent: 0, skipped: 0, errors: 0 };
  }
  if (changes.length === 0) {
    return { sent: 0, skipped: 0, errors: 0 };
  }

  const notificationConfig = await getMattermostNotificationConfig();
  const now = new Date();
  const todayKey = toDateKey(now);
  const endOfMonthKey = toDateKey(
    new Date(now.getFullYear(), now.getMonth() + 1, 0),
  );
  const filteredChanges = changes.filter((change) => {
    if (change.oldUserId === change.newUserId) return false;
    if (!change.oldUserId && !change.newUserId) return false;
    if (
      !change.dateKey ||
      change.dateKey < todayKey ||
      change.dateKey > endOfMonthKey
    ) {
      return false;
    }
    return shouldNotifyEventType(change.eventType, notificationConfig);
  });
  if (filteredChanges.length === 0) {
    return { sent: 0, skipped: 0, errors: 0 };
  }

  const dateCandidates = filteredChanges
    .map((change) => parseDateKey(change.dateKey))
    .filter((value): value is Date => Boolean(value));
  if (dateCandidates.length === 0) {
    return { sent: 0, skipped: filteredChanges.length, errors: 0 };
  }

  const timestamps = dateCandidates.map((date) => date.getTime());
  const startDate = new Date(Math.min(...timestamps));
  const endDate = new Date(Math.max(...timestamps));
  const overrides = await listScheduleEventOverridesInRange({
    startDate,
    endDate,
  });
  const overridesById = new Map(
    overrides.map((override) => [
      getEventOverrideId(override.date, override.eventType),
      override,
    ]),
  );

  const needsDemoRule = filteredChanges.some(
    (change) => change.eventType === 'demo',
  );
  const needsStandupRule = filteredChanges.some(
    (change) => change.eventType === 'standup',
  );
  const [demoRule, standupRule] = await Promise.all([
    needsDemoRule ? getScheduleRuleConfig('demo-day') : Promise.resolve(null),
    needsStandupRule ? getScheduleRuleConfig('standup') : Promise.resolve(null),
  ]);

  const baseUrl = getAppBaseUrl();
  const scheduleUrl = baseUrl
    ? new URL('/hosthub', baseUrl).toString()
    : null;
  const userCache = new Map<string, string | null>();
  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const change of filteredChanges) {
    const override = overridesById.get(
      getEventOverrideId(change.dateKey, change.eventType),
    );
    if (override?.isCanceled) {
      skipped += 1;
      continue;
    }
    if (!options?.allowOverrideAssignee && override?.overrideUserId) {
      skipped += 1;
      continue;
    }

    const originalDate = parseDateKey(change.dateKey);
    if (!originalDate) {
      skipped += 1;
      continue;
    }

    let effectiveDate = originalDate;
    let movedLabel = '';
    if (change.eventType === 'demo' && override?.movedToDate) {
      const movedDate = parseDateKey(override.movedToDate);
      if (movedDate) {
        effectiveDate = movedDate;
        movedLabel = ` (moved from ${formatShortDateLabel(originalDate)})`;
      }
    }

    const dateLabel = formatShortDateLabel(effectiveDate);
    const label = (() => {
      if (isSecurityShiftEventType(change.eventType)) {
        const window = getSecurityShiftWindow(change.eventType);
        return window ? `${window.label} Security` : 'Security Shift';
      }
      return change.eventType === 'demo' ? 'Demo Day' : 'Standup';
    })();

    const timeLabel = (() => {
      if (isSecurityShiftEventType(change.eventType)) {
        const window = getSecurityShiftWindow(change.eventType);
        return window
          ? formatTimeRangeLabel(window.startTime, window.endTime)
          : 'TBD';
      }
      const ruleTime =
        change.eventType === 'demo'
          ? demoRule?.defaultTime
          : standupRule?.defaultTime;
      if (!ruleTime) return 'TBD';
      return formatTimeLabel(resolveEventTime(override?.time, ruleTime));
    })();

    const buildMessage = (status: 'assigned' | 'removed') => {
      const action =
        status === 'assigned'
          ? 'You are now scheduled for'
          : 'You are no longer scheduled for';
      const details = `Schedule update: ${action} ${label} on ${dateLabel} at ${timeLabel}${movedLabel}.`;
      return scheduleUrl
        ? `${details} View schedule: ${scheduleUrl}`
        : details;
    };

    const notifyUser = async (userId: string, status: 'assigned' | 'removed') => {
      const mattermostUserId = await resolveMattermostUserId(
        userId,
        userCache,
      );
      if (!mattermostUserId) {
        skipped += 1;
        return;
      }
      const result = await postMattermostDirectMessage(
        mattermostUserId,
        buildMessage(status),
      );
      if (!result) {
        errors += 1;
        return;
      }
      sent += 1;
    };

    if (change.newUserId && change.newUserId !== change.oldUserId) {
      await notifyUser(change.newUserId, 'assigned');
    }
    if (change.oldUserId && change.oldUserId !== change.newUserId) {
      await notifyUser(change.oldUserId, 'removed');
    }
  }

  return { sent, skipped, errors };
}
