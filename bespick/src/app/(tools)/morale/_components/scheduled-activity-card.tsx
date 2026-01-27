'use client';

import { formatCreator, formatDate, formatEventType } from '@/lib/announcements';
import { ActionMenu } from './action-menu';
import { ActivityDescription } from './activity-description';
import type { Announcement, AnnouncementId } from './types';

type ScheduledActivityCardProps = {
  activity: Announcement;
  onEdit: (id: AnnouncementId) => void;
  onDelete: (id: AnnouncementId) => Promise<void>;
  deletingId: AnnouncementId | null;
  onViewAnnouncement: (announcement: Announcement) => void;
  onOpenForm?: (id: AnnouncementId) => void;
};

export function ScheduledActivityCard({
  activity,
  onDelete,
  onEdit,
  deletingId,
  onViewAnnouncement,
  onOpenForm,
}: ScheduledActivityCardProps) {
  const isPollCard = activity.eventType === 'poll';
  const isFormCard = activity.eventType === 'form';
  const scheduledFor = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(activity.publishAt));
  const isDeleting = deletingId === activity._id;

  return (
    <article className='rounded-xl border border-border bg-card p-6 shadow-sm transition hover:shadow-md'>
      <header className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
        <span className='inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-primary'>
          {formatEventType(activity.eventType)}
        </span>
        <div className='flex items-center gap-2 self-end text-sm text-muted-foreground sm:self-auto'>
          <time dateTime={new Date(activity.publishAt).toISOString()}>
            Scheduled for {scheduledFor}
          </time>
          <ActionMenu
            label='Open scheduled activity actions'
            items={[
              {
                label: 'Edit',
                onClick: () => onEdit(activity._id),
              },
              {
                label: isDeleting ? 'Deleting...' : 'Delete',
                onClick: () => onDelete(activity._id),
                disabled: isDeleting,
                tone: 'danger',
              },
            ]}
          />
        </div>
      </header>

      <h2 className='mt-4 text-2xl font-semibold text-foreground'>
        {activity.title}
      </h2>
      <ActivityDescription text={activity.description} />

      <footer className='mt-5 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground'>
        <div className='flex flex-col gap-1'>
          <p>
            Created by{' '}
            <span className='font-medium text-foreground'>
              {formatCreator(activity.createdBy)}
            </span>
          </p>
          {activity.updatedBy && activity.updatedAt && (
            <p>
              Edited by{' '}
              <span className='font-medium text-foreground'>
                {formatCreator(activity.updatedBy)}
              </span>{' '}
              on {formatDate(activity.updatedAt)}
            </p>
          )}
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground'>
            Scheduled
          </span>
          {isFormCard && onOpenForm && (
            <button
              type='button'
              onClick={() => onOpenForm(activity._id)}
              className='rounded-full border border-primary px-3 py-1 text-xs font-medium text-primary transition hover:bg-primary/10'
            >
              View form
            </button>
          )}
          {!isPollCard && !isFormCard && (
            <button
              type='button'
              onClick={() => onViewAnnouncement(activity)}
              className='rounded-full border border-primary px-3 py-1 text-xs font-medium text-primary transition hover:bg-primary/10'
            >
              View announcement
            </button>
          )}
        </div>
      </footer>
    </article>
  );
}
