'use client';

import { useState, useTransition } from 'react';
import { ChevronDown } from 'lucide-react';

import { sendMattermostTestDm } from '@/server/actions/site-settings';

type StatusState = {
  message: string;
  variant: 'success' | 'error';
} | null;

type UserOption = {
  id: string;
  label: string;
};

type EventOption = {
  value: 'standup' | 'demo' | 'security-am' | 'security-pm';
  label: string;
};

const EVENT_OPTIONS: EventOption[] = [
  { value: 'standup', label: 'Standup' },
  { value: 'demo', label: 'Demo Day' },
  { value: 'security-am', label: 'Morning Security' },
  { value: 'security-pm', label: 'Afternoon Security' },
];

export function MattermostTestCard({
  users,
  defaultUserId,
}: {
  users: UserOption[];
  defaultUserId?: string | null;
}) {
  const [status, setStatus] = useState<StatusState>(null);
  const [isPending, startTransition] = useTransition();
  const [eventType, setEventType] = useState<EventOption['value']>('standup');
  const [selectedUserId, setSelectedUserId] = useState(() => {
    if (defaultUserId && users.some((user) => user.id === defaultUserId)) {
      return defaultUserId;
    }
    return users[0]?.id ?? '';
  });
  const canSend = Boolean(selectedUserId) && users.length > 0;

  const handleSend = () => {
    setStatus(null);
    startTransition(async () => {
      const result = await sendMattermostTestDm({
        targetUserId: selectedUserId,
        eventType,
      });
      setStatus({
        message: result.message,
        variant: result.success ? 'success' : 'error',
      });
    });
  };

  return (
    <details className='group rounded-2xl border border-border bg-card/70 shadow-sm'>
      <summary className='flex cursor-pointer items-center justify-between gap-4 px-6 py-5 list-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'>
        <div>
          <h2 className='text-xl font-semibold text-foreground'>
            Mattermost test DM
          </h2>
          <p className='mt-2 text-sm text-muted-foreground'>
            Send a test notification to confirm the bot can reach a specific
            user. The bot resolves the Mattermost user ID from Clerk metadata or
            a matching email address.
          </p>
        </div>
        <ChevronDown className='h-5 w-5 text-muted-foreground transition-transform group-open:rotate-180' />
      </summary>

      <div className='border-t border-border/60 px-6 pb-6'>
        <div className='pt-5 space-y-4'>
        <div className='grid gap-3 sm:grid-cols-2'>
          <label className='text-sm text-foreground' htmlFor='eventType'>
            Event type
            <select
              id='eventType'
              name='eventType'
              value={eventType}
              onChange={(event) =>
                setEventType(event.target.value as EventOption['value'])
              }
              className='mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
            >
              {EVENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className='text-sm text-foreground' htmlFor='recipient'>
            Recipient
            <select
              id='recipient'
              name='recipient'
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
              className='mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
            >
              {users.length === 0 ? (
                <option value=''>No users available</option>
              ) : (
                users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.label}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>

        <button
          type='button'
          onClick={handleSend}
          disabled={isPending || !canSend}
          className='inline-flex items-center justify-center rounded-md border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60'
        >
          {isPending ? 'Sending...' : 'Send test DM'}
        </button>

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
