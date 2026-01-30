'use client';

import { useMemo, useState, useTransition } from 'react';
import type {
  HostHubRosterMember,
  ShiftEntry,
  ShiftSwapRequest,
} from './types';
import { requestShiftSwap } from '@/server/actions/hosthub-shift-swaps';
import { formatShortDateLabel } from '@/lib/hosthub-schedule-utils';
import { getSecurityShiftWindow } from '@/lib/hosthub-events';

type ShiftDetailsModalProps = {
  shift: ShiftEntry;
  onClose: () => void;
  roster: HostHubRosterMember[];
  swapRequests: ShiftSwapRequest[];
  currentUserId: string | null;
};

export function ShiftDetailsModal({
  shift,
  onClose,
  roster,
  swapRequests,
  currentUserId,
}: ShiftDetailsModalProps) {
  const [selectedRecipient, setSelectedRecipient] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const availableRoster = useMemo(
    () => roster.filter((member) => member.userId !== currentUserId),
    [roster, currentUserId],
  );
  const existingRequest = useMemo(
    () =>
      swapRequests.find(
        (request) =>
          request.eventType === shift.eventType &&
          request.eventDate === shift.eventDate &&
          request.requesterId === currentUserId,
      ) ?? null,
    [swapRequests, shift.eventType, shift.eventDate, currentUserId],
  );
  const isPastShift = useMemo(() => {
    const parts = shift.eventDate.split('-').map(Number);
    if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
      return false;
    }
    const [year, month, day] = parts;
    const now = new Date();
    const dateKey = new Date(year, month - 1, day);
    const todayKey = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (dateKey < todayKey) return true;
    if (dateKey > todayKey) return false;
    if (!shift.time || shift.time === 'TBD') return false;
    const [startRaw, endRaw] = shift.time.split('-').map((value) => value.trim());
    const endValue = endRaw || startRaw;
    const match = endValue.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return false;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return false;
    const endAt = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hours,
      minutes,
      0,
      0,
    );
    return now >= endAt;
  }, [shift.eventDate, shift.time]);
  const shiftLabel = useMemo(() => {
    if (shift.eventType === 'demo') return 'Demo Day';
    if (shift.eventType === 'standup') return 'Standup';
    if (shift.eventType === 'building-892') return '892 Manning';
    const window = getSecurityShiftWindow(shift.eventType);
    return window ? `Security Shift (${window.label})` : 'Security Shift';
  }, [shift.eventType]);
  const shiftDateLabel = useMemo(() => {
    const parts = shift.eventDate.split('-').map(Number);
    if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
      return shift.eventDate;
    }
    return formatShortDateLabel(new Date(parts[0], parts[1] - 1, parts[2]));
  }, [shift.eventDate]);

  const handleRequestSwap = () => {
    setStatus(null);
    startTransition(async () => {
      const result = await requestShiftSwap({
        eventType: shift.eventType,
        eventDate: shift.eventDate,
        recipientId: selectedRecipient,
      });
      setStatus(result.message);
    });
  };

  return (
    <div
      className='fixed inset-0 z-60 grid place-items-center bg-black/50 p-4'
      role='dialog'
      aria-modal='true'
      aria-label='Shift details'
      onClick={onClose}
    >
      <div
        className='w-full max-w-lg rounded-3xl border border-border bg-background p-6 shadow-2xl'
        onClick={(event) => event.stopPropagation()}
      >
        <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <p className='text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground'>
              Shift Details
            </p>
            <h3 className='mt-2 text-2xl font-semibold text-foreground'>
              {shift.details}
            </h3>
            <p className='mt-2 text-sm text-muted-foreground'>
              {shift.date} • {shift.time}
            </p>
          </div>
          <button
            type='button'
            onClick={onClose}
            className='rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-secondary/70'
          >
            Close
          </button>
        </div>

        <div className='mt-6'>
          <h4 className='text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground'>
            Resources
          </h4>
          {shift.resources.length === 0 ? (
            <p className='mt-2 text-sm text-muted-foreground'>
              No resources attached for this shift yet.
            </p>
          ) : (
            <ul className='mt-3 space-y-2'>
              {shift.resources.map((resource) => (
                <li key={resource.href}>
                  <a
                    href={resource.href}
                    target='_blank'
                    rel='noreferrer'
                    className='inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm font-semibold text-foreground transition hover:bg-secondary/70'
                  >
                    {resource.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!isPastShift && shift.eventType !== 'building-892' ? (
          <div className='mt-6'>
            <h4 className='text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground'>
              Shift swap
            </h4>
            <p className='mt-2 text-sm text-muted-foreground'>
              Request someone to take your {shiftLabel} on {shiftDateLabel}.
            </p>
            {existingRequest ? (
              <div className='mt-3 rounded-xl border border-border bg-background/70 px-4 py-3 text-sm'>
                <p className='font-semibold text-foreground'>
                  Swap request status: {existingRequest.status}
                </p>
                <p className='text-xs text-muted-foreground'>
                  Sent to {existingRequest.recipientName ?? 'Unknown'}.
                </p>
              </div>
            ) : (
              <div className='mt-3 space-y-3'>
                <select
                  value={selectedRecipient}
                  onChange={(event) => setSelectedRecipient(event.target.value)}
                  disabled={isPending}
                  className='w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60'
                >
                  <option value=''>Select a recipient</option>
                  {availableRoster.map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.name}
                    </option>
                  ))}
                </select>
                <button
                  type='button'
                  onClick={handleRequestSwap}
                  disabled={!selectedRecipient || isPending}
                  className='w-full rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60'
                >
                  {isPending ? 'Sending...' : 'Send swap request'}
                </button>
                {status ? (
                  <p className='text-xs text-muted-foreground'>{status}</p>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
