import { clerkClient, currentUser } from '@clerk/nextjs/server';
import { and, eq, gte, inArray, lt, lte, or } from 'drizzle-orm';
import { randomUUID } from 'crypto';

import { db } from '@/server/db/client';
import {
  building892Assignments,
  demoDayAssignments,
  scheduleEventOverrideHistory,
  scheduleEventOverrides,
  securityShiftAssignments,
  shiftSwapRequests,
  standupAssignments,
} from '@/server/db/schema';
import {
  getEventOverrideId,
  isHostHubEventType,
  isValidDateKey,
  type HostHubEventType,
} from '@/lib/hosthub-events';

export type ShiftSwapStatus = 'pending' | 'accepted' | 'denied' | 'expired';

export type ShiftSwapRequest = {
  id: string;
  eventType: HostHubEventType;
  eventDate: string;
  requesterId: string;
  requesterName: string | null;
  recipientId: string;
  recipientName: string | null;
  status: ShiftSwapStatus;
  createdAt: number;
  updatedAt: number;
  respondedAt: number | null;
};

const parseDateKey = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  if ([year, month, day].some((part) => Number.isNaN(part))) return null;
  return new Date(year, month - 1, day);
};

const formatDateKey = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;

const pruneExpiredRequests = async (cutoffDate: Date) => {
  const cutoffKey = formatDateKey(cutoffDate);
  await db
    .delete(shiftSwapRequests)
    .where(
      and(
        inArray(shiftSwapRequests.status, ['expired', 'pending']),
        lt(shiftSwapRequests.eventDate, cutoffKey),
      ),
    );
};

const resolveUserLabel = async (userId: string) => {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const fullName =
      `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
    return (
      fullName ||
      user.username ||
      user.emailAddresses[0]?.emailAddress ||
      userId
    );
  } catch (error) {
    console.error('Failed to resolve user label', error);
    return userId;
  }
};

const resolveUserTeam = async (userId: string) => {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const value = user.publicMetadata.team;
    return typeof value === 'string' ? value.trim() : '';
  } catch (error) {
    console.error('Failed to resolve user team', error);
    return '';
  }
};

const getOverrideForEvent = async (
  eventType: HostHubEventType,
  eventDate: string,
) =>
  db
    .select()
    .from(scheduleEventOverrides)
    .where(
      and(
        eq(scheduleEventOverrides.eventType, eventType),
        eq(scheduleEventOverrides.date, eventDate),
      ),
    )
    .get();

const getCurrentAssigneeId = async ({
  eventType,
  eventDate,
}: {
  eventType: HostHubEventType;
  eventDate: string;
}) => {
  const override = await getOverrideForEvent(eventType, eventDate);
  if (override?.isCanceled) return null;
  if (override?.overrideUserId) return override.overrideUserId;

  if (eventType === 'building-892') {
    const row = await db
      .select({ team: building892Assignments.team })
      .from(building892Assignments)
      .where(eq(building892Assignments.weekStart, eventDate))
      .get();
    return row?.team ?? null;
  }
  if (eventType === 'demo') {
    const row = await db
      .select({ userId: demoDayAssignments.userId })
      .from(demoDayAssignments)
      .where(eq(demoDayAssignments.date, eventDate))
      .get();
    return row?.userId ?? null;
  }
  if (eventType === 'standup') {
    const row = await db
      .select({ userId: standupAssignments.userId })
      .from(standupAssignments)
      .where(eq(standupAssignments.date, eventDate))
      .get();
    return row?.userId ?? null;
  }
  const row = await db
    .select({ userId: securityShiftAssignments.userId })
    .from(securityShiftAssignments)
    .where(
      eq(
        securityShiftAssignments.id,
        getEventOverrideId(eventDate, eventType),
      ),
    )
    .get();
  return row?.userId ?? null;
};

export const listShiftSwapRequestsForUser = async ({
  userId,
  startDate,
  endDate,
}: {
  userId: string;
  startDate: Date;
  endDate: Date;
}): Promise<ShiftSwapRequest[]> => {
  const now = new Date();
  const todayKey = formatDateKey(now);
  await pruneExpiredRequests(now);
  const startKey = `${startDate.getFullYear()}-${String(
    startDate.getMonth() + 1,
  ).padStart(2, '0')}-01`;
  const endKey = `${endDate.getFullYear()}-${String(
    endDate.getMonth() + 1,
  ).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

  const rows = await db
    .select()
    .from(shiftSwapRequests)
    .where(
      and(
        or(
          eq(shiftSwapRequests.requesterId, userId),
          eq(shiftSwapRequests.recipientId, userId),
        ),
        gte(shiftSwapRequests.eventDate, startKey),
        lte(shiftSwapRequests.eventDate, endKey),
      ),
    )
    .orderBy(shiftSwapRequests.createdAt);

  const expiredIds = rows
    .filter((row) => row.eventDate < todayKey && row.status !== 'accepted' && row.status !== 'denied')
    .map((row) => row.id);
  if (expiredIds.length > 0) {
    await db
      .delete(shiftSwapRequests)
      .where(inArray(shiftSwapRequests.id, expiredIds));
  }

  return rows
    .filter((row) => !(row.eventDate < todayKey && row.status !== 'accepted' && row.status !== 'denied'))
    .map((row) => ({
    id: row.id,
    eventType: row.eventType as HostHubEventType,
    eventDate: row.eventDate,
    requesterId: row.requesterId,
    requesterName: row.requesterName ?? null,
    recipientId: row.recipientId,
    recipientName: row.recipientName ?? null,
    status: row.status as ShiftSwapStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    respondedAt: row.respondedAt ?? null,
  }));
};

export const createShiftSwapRequest = async ({
  eventType,
  eventDate,
  recipientId,
}: {
  eventType: HostHubEventType;
  eventDate: string;
  recipientId: string;
}): Promise<{ success: boolean; message: string; request?: ShiftSwapRequest }> => {
  const user = await currentUser();
  if (!user) {
    return { success: false, message: 'You must be signed in.' };
  }
  if (!isHostHubEventType(eventType) || !isValidDateKey(eventDate)) {
    return { success: false, message: 'Invalid shift selection.' };
  }
  if (eventType === 'building-892') {
    return { success: false, message: '892 shifts are not swappable.' };
  }
  if (!recipientId.trim() || recipientId === user.id) {
    return { success: false, message: 'Select a valid recipient.' };
  }

  const eventDateValue = parseDateKey(eventDate);
  if (!eventDateValue) {
    return { success: false, message: 'Invalid shift date.' };
  }
  const now = new Date();
  if (
    eventDateValue.getFullYear() !== now.getFullYear() ||
    eventDateValue.getMonth() !== now.getMonth()
  ) {
    return { success: false, message: 'Swaps are only allowed this month.' };
  }

  const assigneeId = await getCurrentAssigneeId({ eventType, eventDate });
  if (!assigneeId) {
    return { success: false, message: 'This shift is not assigned yet.' };
  }

  if (assigneeId !== user.id) {
    return { success: false, message: 'You are not assigned to this shift.' };
  }

  const existing = await db
    .select({ id: shiftSwapRequests.id })
    .from(shiftSwapRequests)
    .where(
      and(
        eq(shiftSwapRequests.eventType, eventType),
        eq(shiftSwapRequests.eventDate, eventDate),
        eq(shiftSwapRequests.requesterId, user.id),
        eq(shiftSwapRequests.recipientId, recipientId),
        eq(shiftSwapRequests.status, 'pending'),
      ),
    )
    .get();
  if (existing) {
    return { success: false, message: 'A request is already pending.' };
  }

  const requesterName = await resolveUserLabel(user.id);
  const recipientName = await resolveUserLabel(recipientId);
  const nowTimestamp = Date.now();
  const request: ShiftSwapRequest = {
    id: randomUUID(),
    eventType,
    eventDate,
    requesterId: user.id,
    requesterName,
    recipientId,
    recipientName,
    status: 'pending',
    createdAt: nowTimestamp,
    updatedAt: nowTimestamp,
    respondedAt: null,
  };

  await db.insert(shiftSwapRequests).values({
    id: request.id,
    eventType: request.eventType,
    eventDate: request.eventDate,
    requesterId: request.requesterId,
    requesterName: request.requesterName,
    recipientId: request.recipientId,
    recipientName: request.recipientName,
    status: request.status,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    respondedAt: null,
  });

  return { success: true, message: 'Swap request sent.', request };
};

export const respondToShiftSwapRequest = async ({
  requestId,
  action,
}: {
  requestId: string;
  action: 'accept' | 'deny';
}): Promise<{ success: boolean; message: string; request?: ShiftSwapRequest }> => {
  const user = await currentUser();
  if (!user) {
    return { success: false, message: 'You must be signed in.' };
  }

  const existing = await db
    .select()
    .from(shiftSwapRequests)
    .where(eq(shiftSwapRequests.id, requestId))
    .get();
  if (!existing || existing.status !== 'pending') {
    return { success: false, message: 'This request is no longer active.' };
  }
  if (existing.recipientId !== user.id) {
    return { success: false, message: 'You are not the recipient.' };
  }

  const now = new Date();
  const eventDateValue = parseDateKey(existing.eventDate);
  if (!eventDateValue) {
    return { success: false, message: 'Invalid shift date.' };
  }
  if (
    eventDateValue.getFullYear() !== now.getFullYear() ||
    eventDateValue.getMonth() !== now.getMonth()
  ) {
    return { success: false, message: 'Swaps are only allowed this month.' };
  }

  if (!isHostHubEventType(existing.eventType)) {
    return { success: false, message: 'Invalid shift selection.' };
  }
  const eventType = existing.eventType;

  if (action === 'accept') {
    const currentAssignee = await getCurrentAssigneeId({
      eventType,
      eventDate: existing.eventDate,
    });
    if (!currentAssignee) {
      return {
        success: false,
        message: 'This shift is no longer assigned.',
      };
    }
    if (eventType === 'building-892') {
      const requesterTeam = await resolveUserTeam(existing.requesterId);
      if (!requesterTeam || requesterTeam !== currentAssignee) {
        return {
          success: false,
          message: 'This shift is no longer assigned to the requester.',
        };
      }
    } else if (currentAssignee !== existing.requesterId) {
      return {
        success: false,
        message: 'This shift is no longer assigned to the requester.',
      };
    }

    const previousName =
      eventType === 'building-892'
        ? await resolveUserTeam(existing.requesterId)
        : await resolveUserLabel(existing.requesterId);
    const nextName =
      eventType === 'building-892'
        ? await resolveUserTeam(user.id)
        : await resolveUserLabel(user.id);

    if (eventType === 'building-892') {
      const recipientTeam = await resolveUserTeam(user.id);
      if (!recipientTeam) {
        return {
          success: false,
          message: 'You must have a team assigned to accept this swap.',
        };
      }
      await db
        .update(building892Assignments)
        .set({ team: recipientTeam, assignedAt: Date.now() })
        .where(eq(building892Assignments.weekStart, existing.eventDate));
    } else if (eventType === 'demo') {
      await db
        .update(demoDayAssignments)
        .set({
          userId: user.id,
          userName: nextName,
          assignedAt: Date.now(),
        })
        .where(eq(demoDayAssignments.date, existing.eventDate));
    } else if (eventType === 'standup') {
      await db
        .update(standupAssignments)
        .set({
          userId: user.id,
          userName: nextName,
          assignedAt: Date.now(),
        })
        .where(eq(standupAssignments.date, existing.eventDate));
    } else {
      await db
        .update(securityShiftAssignments)
        .set({
          userId: user.id,
          userName: nextName,
          assignedAt: Date.now(),
        })
        .where(
          eq(
            securityShiftAssignments.id,
            getEventOverrideId(existing.eventDate, eventType),
          ),
        );
    }

    await db
      .delete(scheduleEventOverrides)
      .where(
        and(
          eq(scheduleEventOverrides.eventType, eventType),
          eq(scheduleEventOverrides.date, existing.eventDate),
        ),
      );

    await db.insert(scheduleEventOverrideHistory).values({
      id: randomUUID(),
      date: existing.eventDate,
      eventType,
      changedAt: Date.now(),
      changedBy: user.id,
      previousOverrideUserId: existing.requesterId,
      previousOverrideUserName: previousName,
      previousTime: null,
      previousMovedToDate: null,
      previousIsCanceled: null,
      nextOverrideUserId: user.id,
      nextOverrideUserName: nextName,
      nextTime: null,
      nextMovedToDate: null,
      nextIsCanceled: null,
    });
  }

  const status: ShiftSwapStatus = action === 'accept' ? 'accepted' : 'denied';
  const timestamp = Date.now();
  await db
    .update(shiftSwapRequests)
    .set({
      status,
      updatedAt: timestamp,
      respondedAt: timestamp,
    })
    .where(eq(shiftSwapRequests.id, requestId));

  const updated: ShiftSwapRequest = {
    id: existing.id,
    eventType: existing.eventType as HostHubEventType,
    eventDate: existing.eventDate,
    requesterId: existing.requesterId,
    requesterName: existing.requesterName ?? null,
    recipientId: existing.recipientId,
    recipientName: existing.recipientName ?? null,
    status,
    createdAt: existing.createdAt,
    updatedAt: timestamp,
    respondedAt: timestamp,
  };

  return {
    success: true,
    message: action === 'accept' ? 'Swap accepted.' : 'Swap denied.',
    request: updated,
  };
};

export const cancelShiftSwapRequest = async ({
  requestId,
}: {
  requestId: string;
}): Promise<{ success: boolean; message: string }> => {
  const user = await currentUser();
  if (!user) {
    return { success: false, message: 'You must be signed in.' };
  }

  const existing = await db
    .select()
    .from(shiftSwapRequests)
    .where(eq(shiftSwapRequests.id, requestId))
    .get();
  if (!existing) {
    return { success: false, message: 'Request not found.' };
  }
  if (existing.requesterId !== user.id) {
    return { success: false, message: 'You can only cancel your own requests.' };
  }
  if (existing.status !== 'pending') {
    return { success: false, message: 'Only pending requests can be canceled.' };
  }

  await db
    .delete(shiftSwapRequests)
    .where(eq(shiftSwapRequests.id, requestId));

  return { success: true, message: 'Swap request canceled.' };
};

export const countPendingSwapRequestsForUser = async ({
  userId,
}: {
  userId: string;
}): Promise<number> => {
  const now = new Date();
  const todayKey = formatDateKey(now);
  await pruneExpiredRequests(now);

  const pending = await db
    .select({ id: shiftSwapRequests.id })
    .from(shiftSwapRequests)
    .where(
      and(
        eq(shiftSwapRequests.recipientId, userId),
        eq(shiftSwapRequests.status, 'pending'),
        gte(shiftSwapRequests.eventDate, todayKey),
      ),
    );

  return pending.length;
};
