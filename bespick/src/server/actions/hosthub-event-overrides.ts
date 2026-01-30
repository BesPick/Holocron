'use server';

import { auth, clerkClient } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

import { db } from '@/server/db/client';
import { broadcast } from '@/server/events';
import {
  building892Assignments,
  demoDayAssignments,
  scheduleEventOverrideHistory,
  scheduleEventOverrides,
  securityShiftAssignments,
  standupAssignments,
} from '@/server/db/schema';
import { checkRole } from '@/server/auth/check-role';
import {
  getEventOverrideId,
  isHostHubEventType,
  isSecurityShiftEventType,
  isValidDateKey,
  isValidTimeValue,
  type HostHubEventType,
} from '@/lib/hosthub-events';
import {
  notifyHostHubBuilding892OverrideChange,
  notifyHostHubScheduleChanges,
} from '@/server/services/mattermost-notifications';

export type UpdateScheduleEventOverrideResult = {
  success: boolean;
  message: string;
};

export type ScheduleEventOverrideHistoryEntry = {
  id: string;
  date: string;
  eventType: HostHubEventType;
  changedAt: number;
  changedById: string | null;
  changedByName: string;
  previousOverrideUserId: string | null;
  previousOverrideUserName: string | null;
  previousTime: string | null;
  previousMovedToDate: string | null;
  previousIsCanceled: boolean | null;
  nextOverrideUserId: string | null;
  nextOverrideUserName: string | null;
  nextTime: string | null;
  nextMovedToDate: string | null;
  nextIsCanceled: boolean | null;
};

const normalizeOverrideTime = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return isValidTimeValue(trimmed) ? trimmed : null;
};

const normalizeMoveDate = (value: string, sourceDate: string) => {
  const trimmed = value.trim();
  if (!trimmed) return { value: null, valid: true };
  if (!isValidDateKey(trimmed)) return { value: null, valid: false };
  if (trimmed === sourceDate) return { value: null, valid: true };
  return { value: trimmed, valid: true };
};

const resolveUserLabel = async (
  userId: string | null,
  cache: Map<string, string>,
) => {
  if (!userId) return 'Unknown';
  if (cache.has(userId)) return cache.get(userId) ?? 'Unknown';
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const fullName =
      `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
    const label =
      fullName ||
      user.username ||
      user.emailAddresses[0]?.emailAddress ||
      userId;
    cache.set(userId, label);
    return label;
  } catch (error) {
    console.error('Failed to resolve override history user', error);
    cache.set(userId, userId);
    return userId;
  }
};

const recordOverrideHistory = async ({
  date,
  eventType,
  userId,
  previous,
  next,
}: {
  date: string;
  eventType: HostHubEventType;
  userId: string | null;
  previous: {
    overrideUserId: string | null;
    overrideUserName: string | null;
    time: string | null;
    movedToDate: string | null;
    isCanceled: boolean | null;
  };
  next: {
    overrideUserId: string | null;
    overrideUserName: string | null;
    time: string | null;
    movedToDate: string | null;
    isCanceled: boolean | null;
  };
}) => {
  await db.insert(scheduleEventOverrideHistory).values({
    id: randomUUID(),
    date,
    eventType,
    changedAt: Date.now(),
    changedBy: userId,
    previousOverrideUserId: previous.overrideUserId,
    previousOverrideUserName: previous.overrideUserName,
    previousTime: previous.time,
    previousMovedToDate: previous.movedToDate,
    previousIsCanceled: previous.isCanceled,
    nextOverrideUserId: next.overrideUserId,
    nextOverrideUserName: next.overrideUserName,
    nextTime: next.time,
    nextMovedToDate: next.movedToDate,
    nextIsCanceled: next.isCanceled,
  });
};

const getBaseAssignmentUserId = async (
  eventType: HostHubEventType,
  dateKey: string,
) => {
  if (eventType === 'building-892') {
    return null;
  }
  if (eventType === 'demo') {
    const row = await db
      .select({ userId: demoDayAssignments.userId })
      .from(demoDayAssignments)
      .where(eq(demoDayAssignments.date, dateKey))
      .get();
    return row?.userId ?? null;
  }
  if (eventType === 'standup') {
    const row = await db
      .select({ userId: standupAssignments.userId })
      .from(standupAssignments)
      .where(eq(standupAssignments.date, dateKey))
      .get();
    return row?.userId ?? null;
  }

  const row = await db
    .select({ userId: securityShiftAssignments.userId })
    .from(securityShiftAssignments)
    .where(eq(securityShiftAssignments.id, getEventOverrideId(dateKey, eventType)))
    .get();
  return row?.userId ?? null;
};

const getBaseAssignmentTeam = async (dateKey: string) => {
  const row = await db
    .select({ team: building892Assignments.team })
    .from(building892Assignments)
    .where(eq(building892Assignments.weekStart, dateKey))
    .get();
  return row?.team ?? null;
};

export async function updateScheduleEventOverride({
  date,
  eventType,
  time,
  isCanceled,
  movedToDate,
  overrideUserId,
  overrideUserName,
}: {
  date: string;
  eventType: HostHubEventType;
  time: string;
  isCanceled: boolean;
  movedToDate?: string | null;
  overrideUserId?: string | null;
  overrideUserName?: string | null;
}): Promise<UpdateScheduleEventOverrideResult> {
  if (!(await checkRole(['admin', 'moderator', 'scheduler']))) {
    return {
      success: false,
      message: 'You are not authorized to perform this action.',
    };
  }

  if (!isHostHubEventType(eventType) || !isValidDateKey(date)) {
    return {
      success: false,
      message: 'Invalid event selection.',
    };
  }

  const normalizedTime = normalizeOverrideTime(time);
  const ignoreTime =
    isSecurityShiftEventType(eventType) || eventType === 'building-892';
  if (!ignoreTime && time.trim() && !normalizedTime) {
    return {
      success: false,
      message: 'Enter a valid time in HH:MM format.',
    };
  }

  const moveInput = eventType === 'demo' ? movedToDate ?? '' : '';
  const { value: normalizedMoveDate, valid: isMoveDateValid } =
    normalizeMoveDate(moveInput, date);
  if (moveInput.trim() && !isMoveDateValid) {
    return {
      success: false,
      message: 'Enter a valid move date in YYYY-MM-DD format.',
    };
  }

  const normalizedOverrideUserId =
    typeof overrideUserId === 'string' && overrideUserId.trim()
      ? overrideUserId.trim()
      : null;
  const normalizedOverrideUserName =
    normalizedOverrideUserId &&
    typeof overrideUserName === 'string' &&
    overrideUserName.trim()
      ? overrideUserName.trim()
      : null;

  try {
    const { userId } = await auth();
    const id = getEventOverrideId(date, eventType);
    const existingOverride = await db
      .select()
      .from(scheduleEventOverrides)
      .where(eq(scheduleEventOverrides.id, id))
      .get();
    const payload = {
      id,
      date,
      eventType,
      movedToDate: normalizedMoveDate,
      time: ignoreTime ? null : normalizedTime,
      isCanceled,
      overrideUserId: normalizedOverrideUserId,
      overrideUserName: normalizedOverrideUserName,
      updatedAt: Date.now(),
      updatedBy: userId ?? null,
    };

    await db
      .insert(scheduleEventOverrides)
      .values(payload)
      .onConflictDoUpdate({
        target: scheduleEventOverrides.id,
        set: {
          movedToDate: payload.movedToDate,
          time: payload.time,
          isCanceled: payload.isCanceled,
          overrideUserId: payload.overrideUserId,
          overrideUserName: payload.overrideUserName,
          updatedAt: payload.updatedAt,
          updatedBy: payload.updatedBy,
        },
      });

    await recordOverrideHistory({
      date,
      eventType,
      userId: userId ?? null,
      previous: {
        overrideUserId: existingOverride?.overrideUserId ?? null,
        overrideUserName: existingOverride?.overrideUserName ?? null,
        time: existingOverride?.time ?? null,
        movedToDate: existingOverride?.movedToDate ?? null,
        isCanceled: existingOverride?.isCanceled ?? null,
      },
      next: {
        overrideUserId: payload.overrideUserId,
        overrideUserName: payload.overrideUserName,
        time: payload.time,
        movedToDate: payload.movedToDate,
        isCanceled: payload.isCanceled,
      },
    });

    if (eventType === 'building-892') {
      const baseAssignmentTeam = await getBaseAssignmentTeam(date);
      const previousEffectiveTeam =
        existingOverride?.overrideUserId ?? baseAssignmentTeam;
      const nextEffectiveTeam =
        normalizedOverrideUserId ?? baseAssignmentTeam;
      if (
        !payload.isCanceled &&
        previousEffectiveTeam !== nextEffectiveTeam
      ) {
        try {
          await notifyHostHubBuilding892OverrideChange({
            dateKey: date,
            oldTeam: previousEffectiveTeam,
            newTeam: nextEffectiveTeam,
            oldTeamLabel: existingOverride?.overrideUserName ?? null,
            newTeamLabel: payload.overrideUserName ?? null,
          });
        } catch (error) {
          console.error(
            'Failed to notify HostHub 892 override changes',
            error,
          );
        }
      }
    } else {
      const previousOverrideUserId =
        existingOverride?.overrideUserId ?? null;
      const baseAssignmentUserId = await getBaseAssignmentUserId(
        eventType,
        date,
      );
      const previousEffectiveUserId =
        previousOverrideUserId ?? baseAssignmentUserId;
      const nextEffectiveUserId =
        normalizedOverrideUserId ?? baseAssignmentUserId;
      if (previousEffectiveUserId !== nextEffectiveUserId) {
        try {
          await notifyHostHubScheduleChanges(
            [
              {
                eventType,
                dateKey: date,
                oldUserId: previousEffectiveUserId,
                newUserId: nextEffectiveUserId,
              },
            ],
            { allowOverrideAssignee: true },
          );
        } catch (error) {
          console.error('Failed to notify HostHub override changes', error);
        }
      }
    }

    revalidatePath('/hosthub');
    revalidatePath('/hosthub/calendar');
    revalidatePath('/hosthub/schedule');
    broadcast('hosthubSchedule');

    return {
      success: true,
      message: 'Event updated successfully.',
    };
  } catch (error) {
    console.error('Failed to update schedule event', error);
    return {
      success: false,
      message: 'Updating the event failed. Please try again.',
    };
  }
}

export async function getScheduleEventOverrideHistory({
  date,
  eventType,
}: {
  date: string;
  eventType: HostHubEventType;
}): Promise<
  | { success: true; entries: ScheduleEventOverrideHistoryEntry[] }
  | { success: false; message: string }
> {
  if (!isHostHubEventType(eventType) || !isValidDateKey(date)) {
    return { success: false, message: 'Invalid event selection.' };
  }

  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, message: 'You must be signed in.' };
    }
    const rows = await db
      .select()
      .from(scheduleEventOverrideHistory)
      .where(
        and(
          eq(scheduleEventOverrideHistory.date, date),
          eq(scheduleEventOverrideHistory.eventType, eventType),
        ),
      )
      .orderBy(scheduleEventOverrideHistory.changedAt);
    const nameCache = new Map<string, string>();
    const entries: ScheduleEventOverrideHistoryEntry[] = [];
    for (const row of rows) {
      const changedByName = await resolveUserLabel(
        row.changedBy ?? null,
        nameCache,
      );
      entries.push({
        id: row.id,
        date: row.date,
        eventType: row.eventType as HostHubEventType,
        changedAt: row.changedAt,
        changedById: row.changedBy ?? null,
        changedByName,
        previousOverrideUserId: row.previousOverrideUserId ?? null,
        previousOverrideUserName: row.previousOverrideUserName ?? null,
        previousTime: row.previousTime ?? null,
        previousMovedToDate: row.previousMovedToDate ?? null,
        previousIsCanceled: row.previousIsCanceled ?? null,
        nextOverrideUserId: row.nextOverrideUserId ?? null,
        nextOverrideUserName: row.nextOverrideUserName ?? null,
        nextTime: row.nextTime ?? null,
        nextMovedToDate: row.nextMovedToDate ?? null,
        nextIsCanceled: row.nextIsCanceled ?? null,
      });
    }

    return { success: true, entries };
  } catch (error) {
    console.error('Failed to load override history', error);
    return {
      success: false,
      message: 'Loading history failed. Please try again.',
    };
  }
}

export async function clearScheduleEventOverride({
  date,
  eventType,
}: {
  date: string;
  eventType: HostHubEventType;
}): Promise<UpdateScheduleEventOverrideResult> {
  if (!(await checkRole(['admin', 'moderator', 'scheduler']))) {
    return {
      success: false,
      message: 'You are not authorized to perform this action.',
    };
  }

  if (!isHostHubEventType(eventType) || !isValidDateKey(date)) {
    return {
      success: false,
      message: 'Invalid event selection.',
    };
  }

  try {
    const id = getEventOverrideId(date, eventType);
    const existingOverride = await db
      .select()
      .from(scheduleEventOverrides)
      .where(eq(scheduleEventOverrides.id, id))
      .get();
    await db
      .delete(scheduleEventOverrides)
      .where(eq(scheduleEventOverrides.id, id));

    if (existingOverride) {
      const { userId } = await auth();
      await recordOverrideHistory({
        date,
        eventType,
        userId: userId ?? null,
        previous: {
          overrideUserId: existingOverride.overrideUserId ?? null,
          overrideUserName: existingOverride.overrideUserName ?? null,
          time: existingOverride.time ?? null,
          movedToDate: existingOverride.movedToDate ?? null,
          isCanceled: existingOverride.isCanceled ?? null,
        },
        next: {
          overrideUserId: null,
          overrideUserName: null,
          time: null,
          movedToDate: null,
          isCanceled: null,
        },
      });
    }

    if (existingOverride) {
      if (eventType === 'building-892') {
        const baseAssignmentTeam = await getBaseAssignmentTeam(date);
        const previousEffectiveTeam =
          existingOverride.overrideUserId ?? baseAssignmentTeam;
        const nextEffectiveTeam = baseAssignmentTeam;
        if (previousEffectiveTeam !== nextEffectiveTeam) {
          try {
            await notifyHostHubBuilding892OverrideChange({
              dateKey: date,
              oldTeam: previousEffectiveTeam,
              newTeam: nextEffectiveTeam,
              oldTeamLabel: existingOverride.overrideUserName ?? null,
              newTeamLabel: null,
            });
          } catch (error) {
            console.error(
              'Failed to notify HostHub 892 override changes',
              error,
            );
          }
        }
      } else {
        const baseAssignmentUserId = await getBaseAssignmentUserId(
          eventType,
          date,
        );
        const previousEffectiveUserId =
          existingOverride.overrideUserId ?? baseAssignmentUserId;
        const nextEffectiveUserId = baseAssignmentUserId;
        if (previousEffectiveUserId !== nextEffectiveUserId) {
          try {
            await notifyHostHubScheduleChanges(
              [
                {
                  eventType,
                  dateKey: date,
                  oldUserId: previousEffectiveUserId,
                  newUserId: nextEffectiveUserId,
                },
              ],
              { allowOverrideAssignee: true },
            );
          } catch (error) {
            console.error('Failed to notify HostHub override changes', error);
          }
        }
      }
    }

    revalidatePath('/hosthub');
    revalidatePath('/hosthub/calendar');
    revalidatePath('/hosthub/schedule');
    broadcast('hosthubSchedule');

    return {
      success: true,
      message: 'Event reset to default.',
    };
  } catch (error) {
    console.error('Failed to clear event override', error);
    return {
      success: false,
      message: 'Resetting the event failed. Please try again.',
    };
  }
}
