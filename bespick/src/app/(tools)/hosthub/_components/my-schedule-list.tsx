'use client';

import { useMemo, useState } from 'react';

export type ShiftResource = {
  label: string;
  href: string;
};

export type ShiftEntry = {
  id: string;
  date: string;
  time: string;
  details: string;
  resources: ShiftResource[];
};

type MyScheduleListProps = {
  shifts: ShiftEntry[];
};

export function MyScheduleList({ shifts }: MyScheduleListProps) {
  const [activeShiftId, setActiveShiftId] = useState<string | null>(null);
  const activeShift = useMemo(
    () => shifts.find((shift) => shift.id === activeShiftId) ?? null,
    [activeShiftId, shifts],
  );

  const closeModal = () => setActiveShiftId(null);

  return (
    <>
      <div className='rounded-2xl border border-border bg-card/70 p-4 shadow-sm sm:p-6'>
        <div className='hidden grid-cols-3 gap-3 border-b border-border pb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:grid'>
          <span>Date</span>
          <span>Time</span>
          <span>Details</span>
        </div>
        {shifts.length === 0 ? (
          <div className='py-6 text-sm text-muted-foreground'>
            No shifts assigned yet. Shift date, time, and details will appear
            here.
          </div>
        ) : (
          <ul className='divide-y divide-border'>
            {shifts.map((shift) => (
              <li key={shift.id}>
                <button
                  type='button'
                  onClick={() => setActiveShiftId(shift.id)}
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

      {activeShift ? (
        <div
          className='fixed inset-0 z-60 grid place-items-center bg-black/50 p-4'
          role='dialog'
          aria-modal='true'
          aria-label='Shift details'
          onClick={closeModal}
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
                  {activeShift.details}
                </h3>
                <p className='mt-2 text-sm text-muted-foreground'>
                  {activeShift.date} • {activeShift.time}
                </p>
              </div>
              <button
                type='button'
                onClick={closeModal}
                className='rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-secondary/70'
              >
                Close
              </button>
            </div>

            <div className='mt-6'>
              <h4 className='text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground'>
                Resources
              </h4>
              {activeShift.resources.length === 0 ? (
                <p className='mt-2 text-sm text-muted-foreground'>
                  No resources attached for this shift yet.
                </p>
              ) : (
                <ul className='mt-3 space-y-2'>
                  {activeShift.resources.map((resource) => (
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
          </div>
        </div>
      ) : null}
    </>
  );
}
