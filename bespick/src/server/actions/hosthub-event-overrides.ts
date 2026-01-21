'use server';

import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';

import { db } from '@/server/db/client';
import { scheduleEventOverrides } from '@/server/db/schema';
import { checkRole } from '@/server/auth/check-role';
import {
  getEventOverrideId,
  isHostHubEventType,
  isSecurityShiftEventType,
  isValidDateKey,
  isValidTimeValue,
  type HostHubEventType,
} from '@/lib/hosthub-events';

export type UpdateScheduleEventOverrideResult = {
  success: boolean;
  message: string;
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
  if (!(await checkRole('admin'))) {
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
  const ignoreTime = isSecurityShiftEventType(eventType);
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

export async function clearScheduleEventOverride({
  date,
  eventType,
}: {
  date: string;
  eventType: HostHubEventType;
}): Promise<UpdateScheduleEventOverrideResult> {
  if (!(await checkRole('admin'))) {
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
    await db
      .delete(scheduleEventOverrides)
      .where(eq(scheduleEventOverrides.id, id));
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
