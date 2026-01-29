'use client';

import { useMemo, useState } from 'react';
import type { ShiftEntry } from './types';
import { ShiftDetailsModal } from './shift-details-modal';

export type { ShiftEntry, ShiftResource } from './types';

type MyScheduleListProps = {
  currentShifts: ShiftEntry[];
  pastShifts: ShiftEntry[];
  building892Weeks?: Array<{
    id: string;
    label: string;
    range: string;
  }>;
  currentTeamLabel?: string | null;
};

type ScheduleSectionProps = {
  title: string;
  shifts: ShiftEntry[];
  emptyMessage: string;
  onSelect: (id: string) => void;
};

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
  weeks: Array<{ id: string; label: string; range: string }>;
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
            <p className='text-sm font-semibold text-foreground'>
              {week.label}
            </p>
            <p className='text-xs text-muted-foreground'>{week.range}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MyScheduleList({
  currentShifts,
  pastShifts,
  building892Weeks = [],
  currentTeamLabel = null,
}: MyScheduleListProps) {
  const [activeShiftId, setActiveShiftId] = useState<string | null>(null);
  const allShifts = useMemo(
    () => [...currentShifts, ...pastShifts],
    [currentShifts, pastShifts],
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
        <ScheduleSection
          title='Current Shifts'
          shifts={currentShifts}
          emptyMessage='No current shifts yet. New assignments will appear here.'
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
        <ShiftDetailsModal shift={activeShift} onClose={closeModal} />
      ) : null}
    </>
  );
}
