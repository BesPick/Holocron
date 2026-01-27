'use client';

import { formatCreator, formatDate, formatEventType } from '@/lib/announcements';
import { ActionMenu } from './action-menu';
import { ActivityDescription } from './activity-description';
import type { Announcement, AnnouncementId } from './types';

type DashboardActivityCardProps = {
  activity: Announcement;
  canManage: boolean;
  onDelete: (id: AnnouncementId) => Promise<void>;
  onEdit: (id: AnnouncementId) => void;
  deletingId: AnnouncementId | null;
  onArchive: (id: AnnouncementId) => Promise<void>;
  archivingId: AnnouncementId | null;
  onOpenPoll?: (id: AnnouncementId) => void;
  onOpenVoting?: (announcement: Announcement) => void;
  onOpenForm?: (id: AnnouncementId) => void;
  onViewAnnouncement: (announcement: Announcement) => void;
};

export function DashboardActivityCard({
  activity,
  canManage,
  onDelete,
  onEdit,
  deletingId,
  onArchive,
  archivingId,
  onOpenPoll,
  onOpenVoting,
  onOpenForm,
  onViewAnnouncement,
}: DashboardActivityCardProps) {
  const publishedDate = formatDate(activity.publishAt);
  const editedDate = activity.updatedAt ? formatDate(activity.updatedAt) : null;
  const autoDeleteDate =
    typeof activity.autoDeleteAt === 'number'
      ? formatDate(activity.autoDeleteAt)
      : null;
  const autoArchiveDate =
    typeof activity.autoArchiveAt === 'number'
      ? formatDate(activity.autoArchiveAt)
      : null;
  const isPollCard = activity.eventType === 'poll';
  const isVotingCard = activity.eventType === 'voting';
  const isFormCard = activity.eventType === 'form';
  const isDeleting = deletingId === activity._id;
  const isArchiving = archivingId === activity._id;

  return (
    <article className='rounded-xl border border-border bg-card p-6 shadow-sm transition hover:shadow-md'>
      <header className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
        <span className='inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-primary'>
          {formatEventType(activity.eventType)}
        </span>
        <div className='flex items-center gap-2 self-end text-sm text-muted-foreground sm:self-auto'>
          <div className='flex flex-col text-right'>
            <time dateTime={new Date(activity.publishAt).toISOString()}>
              Published {publishedDate}
            </time>
            {canManage && autoDeleteDate && (
              <span className='text-xs text-muted-foreground'>
                Auto Delete: {autoDeleteDate}
              </span>
            )}
            {canManage && !autoDeleteDate && autoArchiveDate && (
              <span className='text-xs text-muted-foreground'>
                Auto Archive: {autoArchiveDate}
              </span>
            )}
          </div>
          {canManage && (
            <ActionMenu
              label='Open activity actions'
              items={[
                {
                  label: 'Edit',
                  onClick: () => onEdit(activity._id),
                },
                {
                  label: isArchiving ? 'Archiving...' : 'Archive',
                  onClick: () => onArchive(activity._id),
                  disabled: isArchiving,
                  tone: 'muted',
                },
                {
                  label: isDeleting ? 'Deleting...' : 'Delete',
                  onClick: () => onDelete(activity._id),
                  disabled: isDeleting,
                  tone: 'danger',
                },
              ]}
            />
          )}
        </div>
      </header>

      <h2 className='mt-4 text-2xl font-semibold text-foreground'>
        {activity.title}
      </h2>
      <ActivityDescription
        text={activity.description}
        imageCount={activity.imageIds?.length ?? 0}
      />

      <footer className='mt-5 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground'>
        <div className='flex flex-col gap-1'>
          <p>
            Created by{' '}
            <span className='font-medium text-foreground'>
              {formatCreator(activity.createdBy)}
            </span>
          </p>
          {activity.updatedBy && editedDate && (
            <p>
              Edited by{' '}
              <span className='font-medium text-foreground'>
                {formatCreator(activity.updatedBy)}
              </span>{' '}
              on {editedDate}
            </p>
          )}
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground'>
            {activity.status === 'published' ? 'Live' : 'Scheduled'}
          </span>
          {isPollCard && onOpenPoll && (
            <button
              type='button'
              onClick={() => onOpenPoll(activity._id)}
              className='rounded-full border border-primary px-3 py-1 text-xs font-medium text-primary transition hover:bg-primary/10'
            >
              View Poll
            </button>
          )}
          {isVotingCard && onOpenVoting && (
            <button
              type='button'
              onClick={() => onOpenVoting(activity)}
              className='rounded-full border border-primary px-3 py-1 text-xs font-medium text-primary transition hover:bg-primary/10'
            >
              View leaderboard
            </button>
          )}
          {isFormCard && onOpenForm && (
            <button
              type='button'
              onClick={() => onOpenForm(activity._id)}
              className='rounded-full border border-primary px-3 py-1 text-xs font-medium text-primary transition hover:bg-primary/10'
            >
              Open form
            </button>
          )}
          {!isPollCard && !isVotingCard && !isFormCard && (
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
