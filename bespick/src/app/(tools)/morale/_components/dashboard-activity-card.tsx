'use client';

import { Lock, Trophy, Unlock } from 'lucide-react';
import { formatCreator, formatDate, formatEventType } from '@/lib/announcements';
import { ActionMenu } from './action-menu';
import { ActivityDescription } from './activity-description';
import type { Announcement, AnnouncementId } from './types';
import React from 'react';

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
  onOpenFundraiser?: (id: AnnouncementId) => void;
  onOpenGiveaway?: (id: AnnouncementId) => void;
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
  onOpenFundraiser,
  onOpenGiveaway,
  onViewAnnouncement,
}: DashboardActivityCardProps) {
  const [now, setNow] = React.useState(() => Date.now());
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
  const isFundraiserCard = activity.eventType === 'fundraiser';
  const isGiveawayCard = activity.eventType === 'giveaway';
  const isGiveawayOpen =
    isGiveawayCard &&
    activity.status === 'published' &&
    !activity.giveawayIsClosed;
  const pollClosesAt =
    isPollCard && typeof activity.pollClosesAt === 'number'
      ? activity.pollClosesAt
      : null;
  const votingClosesAt =
    isVotingCard && typeof activity.votingAutoCloseAt === 'number'
      ? activity.votingAutoCloseAt
      : null;
  const pollClosed = pollClosesAt !== null && pollClosesAt <= now;
  const votingClosed = votingClosesAt !== null && votingClosesAt <= now;
  const isPollOpen =
    isPollCard && activity.status === 'published' && !pollClosed;
  const isVotingOpen =
    isVotingCard && activity.status === 'published' && !votingClosed;
  const giveawayAutoCloseAt =
    typeof activity.giveawayAutoCloseAt === 'number'
      ? activity.giveawayAutoCloseAt
      : null;
  const goalReached =
    isFundraiserCard &&
    typeof activity.fundraiserGoal === 'number' &&
    activity.fundraiserGoal > 0 &&
    typeof activity.fundraiserTotalRaised === 'number' &&
    activity.fundraiserTotalRaised >= activity.fundraiserGoal;
  const fundraiserSummary =
    isFundraiserCard &&
    typeof activity.fundraiserGoal === 'number' &&
    activity.fundraiserGoal > 0 &&
    typeof activity.fundraiserTotalRaised === 'number'
      ? new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(activity.fundraiserTotalRaised) +
        ' / ' +
        new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(activity.fundraiserGoal)
      : null;
  const isDeleting = deletingId === activity._id;
  const isArchiving = archivingId === activity._id;

  React.useEffect(() => {
    const shouldTick =
      (giveawayAutoCloseAt && !activity.giveawayIsClosed) ||
      (pollClosesAt && !pollClosed) ||
      (votingClosesAt && !votingClosed);
    if (!shouldTick) return;
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, [
    giveawayAutoCloseAt,
    activity.giveawayIsClosed,
    pollClosesAt,
    pollClosed,
    votingClosesAt,
    votingClosed,
  ]);

  const giveawayCountdownLabel = React.useMemo(() => {
    if (!giveawayAutoCloseAt || activity.giveawayIsClosed) return null;
    const remaining = Math.max(0, giveawayAutoCloseAt - now);
    const seconds = Math.floor(remaining / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const parts = [
      days ? `${days}d` : null,
      hours ? `${hours}h` : null,
      minutes ? `${minutes}m` : null,
      `${secs}s`,
    ].filter(Boolean);
    return parts.join(' ');
  }, [giveawayAutoCloseAt, activity.giveawayIsClosed, now]);

  const pollCountdownLabel = React.useMemo(() => {
    if (!pollClosesAt || pollClosed) return null;
    const remaining = Math.max(0, pollClosesAt - now);
    const seconds = Math.floor(remaining / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const parts = [
      days ? `${days}d` : null,
      hours ? `${hours}h` : null,
      minutes ? `${minutes}m` : null,
      `${secs}s`,
    ].filter(Boolean);
    return parts.join(' ');
  }, [now, pollClosed, pollClosesAt]);

  const votingCountdownLabel = React.useMemo(() => {
    if (!votingClosesAt || votingClosed) return null;
    const remaining = Math.max(0, votingClosesAt - now);
    const seconds = Math.floor(remaining / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const parts = [
      days ? `${days}d` : null,
      hours ? `${hours}h` : null,
      minutes ? `${minutes}m` : null,
      `${secs}s`,
    ].filter(Boolean);
    return parts.join(' ');
  }, [now, votingClosed, votingClosesAt]);

  return (
    <article className='rounded-xl border border-border bg-card p-6 shadow-sm transition hover:shadow-md'>
      <header className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-primary'>
            {formatEventType(activity.eventType)}
          </span>
          {isGiveawayCard && (
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                isGiveawayOpen
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground'
              }`}
            >
              {isGiveawayOpen ? (
                <Unlock className='h-3 w-3' aria-hidden='true' />
              ) : (
                <Lock className='h-3 w-3' aria-hidden='true' />
              )}
              {isGiveawayOpen ? 'Open' : 'Closed'}
            </span>
          )}
          {isPollCard && (
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                isPollOpen
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground'
              }`}
            >
              {isPollOpen ? (
                <Unlock className='h-3 w-3' aria-hidden='true' />
              ) : (
                <Lock className='h-3 w-3' aria-hidden='true' />
              )}
              {isPollOpen ? 'Open' : 'Closed'}
            </span>
          )}
          {isVotingCard && (
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                isVotingOpen
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground'
              }`}
            >
              {isVotingOpen ? (
                <Unlock className='h-3 w-3' aria-hidden='true' />
              ) : (
                <Lock className='h-3 w-3' aria-hidden='true' />
              )}
              {isVotingOpen ? 'Open' : 'Closed'}
            </span>
          )}
          {goalReached && (
            <span className='inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700'>
              <Trophy className='h-3 w-3' aria-hidden='true' />
              Goal reached
            </span>
          )}
          {!goalReached && fundraiserSummary && (
            <span className='inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'>
              {fundraiserSummary}
            </span>
          )}
        </div>
        <div className='flex items-center gap-2 self-end text-sm text-muted-foreground sm:self-auto'>
          <div className='flex flex-col text-right'>
            <time dateTime={new Date(activity.publishAt).toISOString()}>
              Published {publishedDate}
            </time>
            {isGiveawayCard && giveawayAutoCloseAt && (
              <span className='text-xs text-muted-foreground'>
                Auto close: {formatDate(giveawayAutoCloseAt)}
                {giveawayCountdownLabel ? ` • ${giveawayCountdownLabel}` : ''}
              </span>
            )}
            {isPollCard && pollClosesAt && (
              <span className='text-xs text-muted-foreground'>
                Poll {pollClosed ? 'closed' : 'closes'}: {formatDate(pollClosesAt)}
                {pollCountdownLabel ? ` • ${pollCountdownLabel}` : ''}
              </span>
            )}
            {isVotingCard && votingClosesAt && (
              <span className='text-xs text-muted-foreground'>
                Voting {votingClosed ? 'closed' : 'closes'}: {formatDate(votingClosesAt)}
                {votingCountdownLabel ? ` • ${votingCountdownLabel}` : ''}
              </span>
            )}
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
          {isFundraiserCard && onOpenFundraiser && (
            <button
              type='button'
              onClick={() => onOpenFundraiser(activity._id)}
              className='rounded-full border border-primary px-3 py-1 text-xs font-medium text-primary transition hover:bg-primary/10'
            >
              View fundraiser
            </button>
          )}
          {isGiveawayCard && onOpenGiveaway && (
            <button
              type='button'
              onClick={() => onOpenGiveaway(activity._id)}
              className='rounded-full border border-primary px-3 py-1 text-xs font-medium text-primary transition hover:bg-primary/10'
            >
              View giveaway
            </button>
          )}
          {!isPollCard &&
            !isVotingCard &&
            !isFormCard &&
            !isFundraiserCard &&
            !isGiveawayCard && (
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
