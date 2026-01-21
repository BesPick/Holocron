'use client';

import type { ShiftEntry } from './types';

type ShiftDetailsModalProps = {
  shift: ShiftEntry;
  onClose: () => void;
};

export function ShiftDetailsModal({
  shift,
  onClose,
}: ShiftDetailsModalProps) {
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
      </div>
    </div>
  );
}
