'use client';

import { useState, useTransition } from 'react';
import type { ChangeEvent } from 'react';
import { ChevronDown } from 'lucide-react';

import { updateMattermostNotifications } from '@/server/actions/site-settings';
import type { MattermostNotificationConfig } from '@/server/services/site-settings';

type MattermostNotificationsCardProps = {
  initialConfig: MattermostNotificationConfig;
};

type StatusState = {
  message: string;
  variant: 'success' | 'error';
} | null;

export function MattermostNotificationsCard({
  initialConfig,
}: MattermostNotificationsCardProps) {
  const [config, setConfig] = useState(initialConfig);
  const [status, setStatus] = useState<StatusState>(null);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    setStatus(null);
    startTransition(async () => {
      const result = await updateMattermostNotifications(config);
      if (result.success && result.config) {
        setConfig(result.config);
        setStatus({ message: result.message, variant: 'success' });
      } else {
        setStatus({ message: result.message, variant: 'error' });
      }
    });
  };

  const handleToggle = (key: keyof MattermostNotificationConfig) => {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const checked = event.target.checked;
      setConfig((prev) => ({ ...prev, [key]: checked }));
    };
  };

  return (
    <details className='group rounded-2xl border border-border bg-card/70 shadow-sm'>
      <summary className='flex cursor-pointer items-center justify-between gap-4 px-6 py-5 list-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'>
        <div>
          <h2 className='text-xl font-semibold text-foreground'>
            Mattermost notifications
          </h2>
          <p className='mt-2 text-sm text-muted-foreground'>
            Toggle automated announcements and HostHub reminders to prevent
            unwanted spam while testing.
          </p>
        </div>
        <ChevronDown className='h-5 w-5 text-muted-foreground transition-transform group-open:rotate-180' />
      </summary>

      <div className='border-t border-border/60 px-6 pb-6'>
        <div className='pt-5 space-y-6'>
          <div className='space-y-3'>
            <p className='text-sm font-semibold text-foreground'>Morale</p>
            <label className='flex items-center gap-3 text-sm text-foreground'>
              <input
                type='checkbox'
                className='h-4 w-4 accent-primary'
                checked={config.moraleEnabled}
                onChange={handleToggle('moraleEnabled')}
                disabled={isPending}
              />
              Send channel notifications for published morale items
            </label>
          </div>

          <div className='space-y-3'>
            <p className='text-sm font-semibold text-foreground'>HostHub</p>
            <div className='grid gap-3 sm:grid-cols-2'>
              <label className='flex items-center gap-3 text-sm text-foreground'>
                <input
                  type='checkbox'
                  className='h-4 w-4 accent-primary'
                  checked={config.hosthubStandupEnabled}
                  onChange={handleToggle('hosthubStandupEnabled')}
                  disabled={isPending}
                />
                Standup reminders
              </label>
              <label className='flex items-center gap-3 text-sm text-foreground'>
                <input
                  type='checkbox'
                  className='h-4 w-4 accent-primary'
                  checked={config.hosthubDemoEnabled}
                  onChange={handleToggle('hosthubDemoEnabled')}
                  disabled={isPending}
                />
                Demo Day reminders
              </label>
              <label className='flex items-center gap-3 text-sm text-foreground'>
                <input
                  type='checkbox'
                  className='h-4 w-4 accent-primary'
                  checked={config.hosthubSecurityAmEnabled}
                  onChange={handleToggle('hosthubSecurityAmEnabled')}
                  disabled={isPending}
                />
                Morning security reminders
              </label>
              <label className='flex items-center gap-3 text-sm text-foreground'>
                <input
                  type='checkbox'
                  className='h-4 w-4 accent-primary'
                  checked={config.hosthubSecurityPmEnabled}
                  onChange={handleToggle('hosthubSecurityPmEnabled')}
                  disabled={isPending}
                />
                Afternoon security reminders
              </label>
              <label className='flex items-center gap-3 text-sm text-foreground'>
                <input
                  type='checkbox'
                  className='h-4 w-4 accent-primary'
                  checked={config.hosthubBuilding892Enabled}
                  onChange={handleToggle('hosthubBuilding892Enabled')}
                  disabled={isPending}
                />
                892 Manning weekly reminders
              </label>
            </div>
          </div>

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
