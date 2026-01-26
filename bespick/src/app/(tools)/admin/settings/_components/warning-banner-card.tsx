'use client';

import { useState, useTransition } from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';

import { updateWarningBanner } from '@/server/actions/site-settings';
import type { WarningBannerConfig } from '@/server/services/site-settings';

type WarningBannerCardProps = {
  initialConfig: WarningBannerConfig;
};

type StatusState = {
  message: string;
  variant: 'success' | 'error';
} | null;

export function WarningBannerCard({
  initialConfig,
}: WarningBannerCardProps) {
  const [enabled, setEnabled] = useState(initialConfig.enabled);
  const [message, setMessage] = useState(initialConfig.message);
  const [status, setStatus] = useState<StatusState>(null);
  const [isPending, startTransition] = useTransition();
  const trimmedMessage = message.trim();

  const handleSave = () => {
    setStatus(null);
    startTransition(async () => {
      const result = await updateWarningBanner({
        enabled,
        message,
      });

      if (result.success && result.config) {
        setEnabled(result.config.enabled);
        setMessage(result.config.message);
        setStatus({ message: result.message, variant: 'success' });
      } else {
        setStatus({
          message: result.message,
          variant: 'error',
        });
      }
    });
  };

  const handleClear = () => {
    if (isPending) return;
    setEnabled(false);
    setMessage('');
    setStatus(null);
  };

  return (
    <details className='group rounded-2xl border border-border bg-card/70 shadow-sm'>
      <summary className='flex cursor-pointer items-center justify-between gap-4 px-6 py-5 list-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'>
        <div>
          <h2 className='text-xl font-semibold text-foreground'>
            Warning banner
          </h2>
          <p className='mt-2 text-sm text-muted-foreground'>
            Display a notice at the top of the landing page for outages,
            maintenance windows, or urgent updates.
          </p>
        </div>
        <ChevronDown className='h-5 w-5 text-muted-foreground transition-transform group-open:rotate-180' />
      </summary>

      <div className='border-t border-border/60 px-6 pb-6'>
        <div className='pt-5 space-y-5'>
        <label className='flex items-center gap-3 text-sm text-foreground'>
          <input
            type='checkbox'
            className='h-4 w-4 accent-primary'
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            disabled={isPending}
          />
          Show warning banner
        </label>

        <div>
          <label
            className='text-sm font-semibold text-foreground'
            htmlFor='warning-banner-message'
          >
            Message
          </label>
          <textarea
            id='warning-banner-message'
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={4}
            disabled={isPending}
            placeholder='Example: Planned downtime on Friday from 18:00 to 20:00 PT.'
            className='mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60'
          />
          <div className='mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground'>
            <span>
              {trimmedMessage.length === 0
                ? 'Add a message to publish the banner.'
                : 'Messages are shown to all users on the landing page.'}
            </span>
            <span>{trimmedMessage.length} characters</span>
          </div>
        </div>

        {trimmedMessage.length > 0 ? (
          <div className='rounded-xl border border-amber-500/60 bg-[#483418] px-4 py-3 text-sm text-amber-100 shadow-sm'>
            <div className='flex items-start gap-3'>
              <AlertTriangle
                className='mt-0.5 h-4 w-4 text-amber-200'
                aria-hidden={true}
              />
              <div>
                <p className='text-xs font-semibold uppercase tracking-[0.2em] text-amber-200'>
                  Preview
                </p>
                <p className='mt-1 whitespace-pre-line text-sm font-medium text-amber-100'>
                  {trimmedMessage}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className='flex flex-wrap items-center gap-3'>
          <button
            type='button'
            onClick={handleSave}
            disabled={isPending}
            className='inline-flex items-center justify-center rounded-md border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60'
          >
            {isPending ? 'Saving...' : 'Save changes'}
          </button>
          <button
            type='button'
            onClick={handleClear}
            disabled={isPending}
            className='inline-flex items-center justify-center rounded-md border border-border bg-secondary/70 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-secondary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60'
          >
            Clear message
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
