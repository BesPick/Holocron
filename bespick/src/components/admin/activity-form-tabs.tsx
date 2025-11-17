'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import {
  AnnouncementForm,
  type ActivityType,
} from '@/components/admin/announcement-form';

const ACTIVITY_OPTIONS: Array<{
  value: ActivityType;
  label: string;
  description: string;
}> = [
  {
    value: 'announcements',
    label: 'Announcement',
    description: 'Share news, updates, or morale boosts with everyone.',
  },
  {
    value: 'poll',
    label: 'Poll',
    description: 'Gauge sentiment and gather opinions quickly with a question.',
  },
  {
    value: 'voting',
    label: 'Voting',
    description: 'Vote to fight it out on the leaderboard.',
  },
];

type AnnouncementDoc = Doc<'announcements'>;

export function ActivityFormTabs() {
  const searchParams = useSearchParams();
  const editIdParam = searchParams.get('edit');
  const editId = editIdParam as Id<'announcements'> | null;
  const [activeType, setActiveType] =
    React.useState<ActivityType>('announcements');
  const isEditing = Boolean(editId);
  const activity = useQuery(
    api.announcements.get,
    editId ? { id: editId } : 'skip',
  ) as AnnouncementDoc | null | undefined;

  if (isEditing) {
    if (activity === undefined) {
      return (
        <section className='rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-sm'>
          Loading activity...
        </section>
      );
    }

    if (!activity) {
      return (
        <section className='rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive shadow-sm'>
          Activity not found or has been removed.
        </section>
      );
    }

    return (
      <section className='space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm backdrop-blur'>
        <div>
          <p className='text-sm font-medium text-muted-foreground'>
            Editing {activity.eventType}
          </p>
          <h2 className='text-2xl font-semibold text-foreground'>
            {activity.title}
          </h2>
        </div>
        <AnnouncementForm
          activityType={activity.eventType as ActivityType}
          existingActivity={activity}
        />
      </section>
    );
  }

  return (
    <div className='space-y-6'>
      <div className='grid gap-3 sm:grid-cols-3'>
        {ACTIVITY_OPTIONS.map((option) => {
          const isActive = option.value === activeType;
          return (
            <button
              key={option.value}
              type='button'
              onClick={() => setActiveType(option.value)}
              className={`rounded-2xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                isActive
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/5'
              }`}
            >
              <p className='text-base font-semibold'>{option.label}</p>
              <p className='mt-1 text-xs text-muted-foreground'>
                {option.description}
              </p>
            </button>
          );
        })}
      </div>

      <section className='rounded-2xl border border-border bg-card p-6 shadow-sm backdrop-blur'>
        <AnnouncementForm activityType={activeType} />
      </section>
    </div>
  );
}
