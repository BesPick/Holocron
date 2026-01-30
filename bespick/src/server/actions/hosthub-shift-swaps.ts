'use server';

import { revalidatePath } from 'next/cache';

import { broadcast } from '@/server/events';
import {
  createShiftSwapRequest,
  cancelShiftSwapRequest,
  countPendingSwapRequestsForUser,
  respondToShiftSwapRequest,
  type ShiftSwapRequest,
} from '@/server/services/hosthub-shift-swaps';
import { currentUser } from '@clerk/nextjs/server';
import type { HostHubEventType } from '@/lib/hosthub-events';

export type ShiftSwapActionResult = {
  success: boolean;
  message: string;
  request?: ShiftSwapRequest;
};

export async function requestShiftSwap({
  eventType,
  eventDate,
  recipientId,
}: {
  eventType: HostHubEventType;
  eventDate: string;
  recipientId: string;
}): Promise<ShiftSwapActionResult> {
  const result = await createShiftSwapRequest({
    eventType,
    eventDate,
    recipientId,
  });

  if (result.success) {
    broadcast('hosthubSchedule');
    revalidatePath('/hosthub');
    revalidatePath('/hosthub/calendar');
  }

  return result;
}

export async function respondShiftSwapRequest({
  requestId,
  action,
}: {
  requestId: string;
  action: 'accept' | 'deny';
}): Promise<ShiftSwapActionResult> {
  const result = await respondToShiftSwapRequest({ requestId, action });

  if (result.success) {
    broadcast('hosthubSchedule');
    revalidatePath('/hosthub');
    revalidatePath('/hosthub/calendar');
  }

  return result;
}

export async function cancelShiftSwapRequestAction({
  requestId,
}: {
  requestId: string;
}): Promise<ShiftSwapActionResult> {
  const result = await cancelShiftSwapRequest({ requestId });

  if (result.success) {
    broadcast('hosthubSchedule');
    revalidatePath('/hosthub');
    revalidatePath('/hosthub/calendar');
  }

  return result;
}

export async function getPendingSwapRequestCountAction(): Promise<{
  count: number;
}> {
  const user = await currentUser();
  if (!user) {
    return { count: 0 };
  }
  const count = await countPendingSwapRequestsForUser({
    userId: user.id,
  });
  return { count };
}
