'use client';

import { useMemo, useState, useTransition } from 'react';
import type {
  HostHubRosterMember,
  ShiftEntry,
  ShiftSwapRequest,
} from './types';
import {
  cancelShiftSwapRequestAction,
  respondShiftSwapRequest,
} from '@/server/actions/hosthub-shift-swaps';
import { ShiftDetailsModal } from './shift-details-modal';
import { getSecurityShiftWindow, type HostHubEventType } from '@/lib/hosthub-events';
import { formatShortDateLabel } from '@/lib/hosthub-schedule-utils';

export type { ShiftEntry, ShiftResource } from './types';

type MyScheduleListProps = {
  currentShifts: ShiftEntry[];
  futureShifts: ShiftEntry[];
  pastShifts: ShiftEntry[];
  roster: HostHubRosterMember[];
  swapRequests: ShiftSwapRequest[];
  currentUserId: string | null;
  building892Weeks?: Array<{
    id: string;
    label: string;
    range: string;
    weekStart: string;
  }>;
  currentTeamLabel?: string | null;
};

type ScheduleSectionProps = {
  title: string;
  shifts: ShiftEntry[];
  emptyMessage: string;
  onSelect: (id: string) => void;
};

type SwapRequestsPanelProps = {
  currentUserId: string;
  requests: ShiftSwapRequest[];
};

const formatEventLabel = (eventType: HostHubEventType) => {
  if (eventType === 'demo') return 'Demo Day';
  if (eventType === 'standup') return 'Standup';
  if (eventType === 'building-892') return '892 Manning';
  const window = getSecurityShiftWindow(eventType);
  return window ? `Security Shift (${window.label})` : 'Security Shift';
};

const formatEventDate = (value: string) => {
  const parts = value.split('-').map(Number);
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return value;
  }
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return formatShortDateLabel(date);
};

function SwapRequestsPanel({
  currentUserId,
  requests,
}: SwapRequestsPanelProps) {
  const [isPending, startTransition] = useTransition();
  const incoming = requests.filter(
    (request) =>
      request.recipientId === currentUserId &&
      request.status === 'pending',
  );
  const outgoing = requests.filter(
    (request) => request.requesterId === currentUserId,
  );

  const handleRespond = (requestId: string, action: 'accept' | 'deny') => {
    startTransition(async () => {
      await respondShiftSwapRequest({ requestId, action });
    });
  };

  const handleCancel = (requestId: string) => {
    startTransition(async () => {
      await cancelShiftSwapRequestAction({ requestId });
    });
  };

  if (incoming.length === 0 && outgoing.length === 0) {
    return null;
  }

  return (
    <div className='rounded-2xl border border-border bg-card/70 p-4 shadow-sm sm:p-6'>
      <h3 className='mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground'>
        Swap requests
      </h3>
      {incoming.length > 0 ? (
        <div className='space-y-3'>
          <p className='text-sm font-semibold text-foreground'>
            Incoming requests
          </p>
          <ul className='divide-y divide-border rounded-xl border border-border bg-background/60'>
            {incoming.map((request) => (
              <li
                key={request.id}
                className='flex flex-col gap-3 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between'
              >
                <div>
                  <p className='font-semibold text-foreground'>
                    {formatEventLabel(request.eventType)}
                  </p>
                  <p className='text-xs text-muted-foreground'>
                    {formatEventDate(request.eventDate)} • Requested by{' '}
                    {request.requesterName ?? 'Unknown'}
                  </p>
                </div>
                <div className='flex gap-2'>
                  <button
                    type='button'
                    onClick={() => handleRespond(request.id, 'accept')}
                    disabled={isPending}
                    className='rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60'
                  >
                    Accept
                  </button>
                  <button
                    type='button'
                    onClick={() => handleRespond(request.id, 'deny')}
                    disabled={isPending}
                    className='rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary/70 disabled:cursor-not-allowed disabled:opacity-60'
                  >
                    Deny
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {outgoing.length > 0 ? (
        <div className='mt-6 space-y-3'>
          <p className='text-sm font-semibold text-foreground'>
            Sent requests
          </p>
          <ul className='divide-y divide-border rounded-xl border border-border bg-background/60'>
            {outgoing.map((request) => (
              <li
                key={request.id}
                className='flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between'
              >
                <div>
                  <p className='font-semibold text-foreground'>
                    {formatEventLabel(request.eventType)}
                  </p>
                  <p className='text-xs text-muted-foreground'>
                    {formatEventDate(request.eventDate)} • Sent to{' '}
                    {request.recipientName ?? 'Unknown'}
                  </p>
                </div>
                <div className='flex items-center gap-2'>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                      request.status === 'pending'
                        ? 'border border-amber-500/40 bg-amber-500/10 text-amber-600'
                        : request.status === 'accepted'
                          ? 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
                          : 'border border-destructive/40 bg-destructive/10 text-destructive'
                    }`}
                  >
                    {request.status}
                  </span>
                  {request.status === 'pending' && (
                    <button
                      type='button'
                      onClick={() => handleCancel(request.id)}
                      disabled={isPending}
                      className='rounded-full border border-border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground transition hover:bg-secondary/70 disabled:cursor-not-allowed disabled:opacity-60'
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ScheduleSection({
  title,
  shifts,
  emptyMessage,
  onSelect,
}: ScheduleSectionProps) {
  return (
    <div className='rounded-2xl border border-border bg-card/70 p-4 shadow-sm sm:p-6'>
      <h3 className='mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground'>
        {title}
      </h3>
      <div className='hidden grid-cols-3 gap-3 border-b border-border pb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:grid'>
        <span>Date</span>
        <span>Time</span>
        <span>Details</span>
      </div>
      {shifts.length === 0 ? (
        <div className='py-6 text-sm text-muted-foreground'>
          {emptyMessage}
        </div>
      ) : (
        <ul className='divide-y divide-border'>
          {shifts.map((shift) => (
            <li key={shift.id}>
              <button
                type='button'
                onClick={() => onSelect(shift.id)}
                className='w-full py-4 text-left text-sm text-foreground transition hover:bg-secondary/30'
              >
                <div className='flex flex-col gap-1 sm:grid sm:grid-cols-3 sm:gap-3'>
                  <span className='font-medium'>{shift.date}</span>
                  <span className='text-muted-foreground sm:text-foreground'>
                    {shift.time}
                  </span>
                  <span className='text-muted-foreground'>
                    {shift.details}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Building892SectionProps = {
  weeks: Array<{ id: string; label: string; range: string; weekStart: string }>;
  teamLabel?: string | null;
};

function Building892Section({
  weeks,
  teamLabel = null,
}: Building892SectionProps) {
  const resolvedTeamLabel = teamLabel?.trim() ? teamLabel : 'Not set';

  return (
    <div className='rounded-2xl border border-border bg-card/70 p-4 shadow-sm sm:p-6'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h3 className='mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground'>
            892 Manning
          </h3>
          <p className='text-sm text-muted-foreground'>
            Your assigned weeks for the current month.
          </p>
        </div>
        <span className='rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary'>
          Your Team: {resolvedTeamLabel}
        </span>
      </div>
      <ul className='mt-4 divide-y divide-border'>
        {weeks.map((week) => (
          <li key={week.id} className='py-3'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <div>
                <p className='text-sm font-semibold text-foreground'>
                  {week.label}
                </p>
                <p className='text-xs text-muted-foreground'>{week.range}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MyScheduleList({
  currentShifts,
  futureShifts,
  pastShifts,
  roster,
  swapRequests,
  currentUserId,
  building892Weeks = [],
  currentTeamLabel = null,
}: MyScheduleListProps) {
  const [activeShiftId, setActiveShiftId] = useState<string | null>(null);
  const building892ShiftEntries = useMemo(
    () =>
      building892Weeks.map((week) => ({
        id: week.id,
        date: week.label,
        time: week.range,
        details: '892 Manning',
        resources: [],
        eventType: 'building-892' as HostHubEventType,
        eventDate: week.weekStart,
      })),
    [building892Weeks],
  );
  const allShifts = useMemo(
    () => [
      ...currentShifts,
      ...futureShifts,
      ...pastShifts,
      ...building892ShiftEntries,
    ],
    [currentShifts, futureShifts, pastShifts, building892ShiftEntries],
  );
  const activeShift = useMemo(
    () => allShifts.find((shift) => shift.id === activeShiftId) ?? null,
    [activeShiftId, allShifts],
  );

  const closeModal = () => setActiveShiftId(null);

  return (
    <>
      <div className='space-y-6'>
        {building892Weeks.length > 0 ? (
          <Building892Section
            weeks={building892Weeks}
            teamLabel={currentTeamLabel}
          />
        ) : null}
        {currentUserId ? (
          <SwapRequestsPanel
            currentUserId={currentUserId}
            requests={swapRequests}
          />
        ) : null}
        <ScheduleSection
          title='Current Shifts'
          shifts={currentShifts}
          emptyMessage='No current shifts yet. New assignments will appear here.'
          onSelect={setActiveShiftId}
        />
        <ScheduleSection
          title='Future Shifts'
          shifts={futureShifts}
          emptyMessage='No future shifts yet. Check back closer to next month.'
          onSelect={setActiveShiftId}
        />
        <ScheduleSection
          title='Past Shifts'
          shifts={pastShifts}
          emptyMessage='No past shifts yet.'
          onSelect={setActiveShiftId}
        />
      </div>

      {activeShift ? (
        <ShiftDetailsModal
          shift={activeShift}
          onClose={closeModal}
          roster={roster}
          swapRequests={swapRequests}
          currentUserId={currentUserId}
        />
      ) : null}
    </>
  );
}
