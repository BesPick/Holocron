'use client';

import { useState, useTransition } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

import { resetScheduleAssignments } from '@/server/actions/hosthub-schedule-refresh';

type StatusState = {
  message: string;
  variant: 'success' | 'error';
} | null;

export function ResetScheduleAssignmentsCard() {
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<StatusState>(null);
  const [isPending, startTransition] = useTransition();

  const handleRequestConfirm = () => {
    setStatus(null);
    setConfirming(true);
  };

  const handleCancel = () => {
    setConfirming(false);
  };

  const handleReset = () => {
    setStatus(null);
    startTransition(async () => {
      const result = await resetScheduleAssignments();
      if (result.success) {
        setStatus({ message: result.message, variant: 'success' });
        setConfirming(false);
      } else {
        setStatus({ message: result.message, variant: 'error' });
      }
    });
  };

  return (
    <div className='rounded-2xl border border-border bg-card/70 p-6 shadow-sm'>
      <div>
        <h2 className='text-xl font-semibold text-foreground'>
          Full reset schedule
        </h2>
        <p className='mt-2 text-sm text-muted-foreground'>
          Clears all assignments and overrides, then regenerates the current
          month using the latest eligibility rules.
        </p>
      </div>

      <div className='mt-4 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700'>
        <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />
        <p>
          This will remove schedule history and any manual overrides. Use it
          only when you want to start fresh.
        </p>
      </div>

      <div className='mt-4 flex flex-wrap items-center gap-2'>
        {confirming ? (
          <>
            <button
              type='button'
              onClick={handleReset}
              disabled={isPending}
              className='inline-flex items-center justify-center rounded-md border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60'
            >
              {isPending ? 'Resetting...' : 'Confirm reset'}
            </button>
            <button
              type='button'
              onClick={handleCancel}
              disabled={isPending}
              className='inline-flex items-center justify-center rounded-md border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60'
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type='button'
            onClick={handleRequestConfirm}
            disabled={isPending}
            className='inline-flex items-center gap-2 rounded-md border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60'
          >
            <RefreshCcw className='h-4 w-4' />
            Full reset
          </button>
        )}
      </div>

      {status && (
        <div
          className={`mt-4 rounded-md border px-3 py-2 text-sm ${
            status.variant === 'success'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
              : 'border-destructive/40 bg-destructive/10 text-destructive'
          }`}
        >
          {status.message}
        </div>
      )}
    </div>
  );
}
