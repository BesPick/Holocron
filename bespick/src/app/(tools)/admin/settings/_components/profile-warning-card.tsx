'use client';

import { useState, useTransition } from 'react';
import { ChevronDown } from 'lucide-react';

import { updateProfileWarning } from '@/server/actions/site-settings';
import type { ProfileWarningConfig } from '@/server/services/site-settings';

type ProfileWarningCardProps = {
  initialConfig: ProfileWarningConfig;
};

type StatusState = {
  message: string;
  variant: 'success' | 'error';
} | null;

export function ProfileWarningCard({
  initialConfig,
}: ProfileWarningCardProps) {
  const [enabled, setEnabled] = useState(initialConfig.enabled);
  const [status, setStatus] = useState<StatusState>(null);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    setStatus(null);
    startTransition(async () => {
      const result = await updateProfileWarning({ enabled });
      if (result.success && result.config) {
        setEnabled(result.config.enabled);
        setStatus({ message: result.message, variant: 'success' });
      } else {
        setStatus({
          message: result.message,
          variant: 'error',
        });
      }
    });
  };

  return (
    <details className='group rounded-2xl border border-border bg-card/70 shadow-sm'>
      <summary className='flex cursor-pointer items-center justify-between gap-4 px-6 py-5 list-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'>
        <div>
          <h2 className='text-xl font-semibold text-foreground'>
            Profile completion reminder
          </h2>
          <p className='mt-2 text-sm text-muted-foreground'>
            Show a landing-page reminder for signed-in users who are missing a
            rank type, group, or team assignment.
          </p>
        </div>
        <ChevronDown className='h-5 w-5 text-muted-foreground transition-transform group-open:rotate-180' />
      </summary>

      <div className='border-t border-border/60 px-6 pb-6'>
        <div className='pt-5 space-y-4'>
        <label className='flex items-center gap-3 text-sm text-foreground'>
          <input
            type='checkbox'
            className='h-4 w-4 accent-primary'
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            disabled={isPending}
          />
          Enable profile reminder banner
        </label>

        <div className='flex flex-wrap items-center gap-3'>
          <button
            type='button'
            onClick={handleSave}
            disabled={isPending}
            className='inline-flex items-center justify-center rounded-md border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60'
          >
            {isPending ? 'Saving...' : 'Save changes'}
          </button>
        </div>

        {status ? (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              status.variant === 'success'
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-destructive/40 bg-destructive/10 text-destructive'
            }`}
          >
            {status.message}
          </div>
        ) : null}
        </div>
      </div>
    </details>
  );
}
