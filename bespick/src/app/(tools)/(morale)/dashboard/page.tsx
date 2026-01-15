'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { MoreVertical } from 'lucide-react';
import { AnnouncementModal } from '@/components/announcements/announcement-modal';
import { PollModal } from '@/components/poll/poll-modal';
import { VotingModal } from '@/components/voting/voting-modal';
import { MoraleSubHeader } from '@/components/header/morale-subheader';
import {
  formatCreator,
  formatDate,
  formatEventType,
} from '@/lib/announcements';
import { api } from '@/lib/api';
import { useApiMutation, useApiQuery } from '@/lib/apiClient';
import type { Doc, Id } from '@/types/db';

type Announcement = Doc<'announcements'>;
type AnnouncementId = Id<'announcements'>;

const DASHBOARD_HEADER_STORAGE_KEY = 'bespickDashboardHeaderDismissed';

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useUser();
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 60_000);
    return () => window.clearInterval(interval);
  }, []);
  const activities = useApiQuery<{ now: number }, Announcement[]>(
    api.announcements.list,
    { now },
    { liveKeys: ['announcements'] },
  );
  const nextPublishAt = useApiQuery<{ now: number }, number | null>(
    api.announcements.nextPublishAt,
    { now },
    { liveKeys: ['announcements'] },
  );
  const deleteAnnouncement = useApiMutation(api.announcements.remove);
  const archiveAnnouncement = useApiMutation(api.announcements.archive);
  const publishDueAnnouncements = useApiMutation(api.announcements.publishDue);

  React.useEffect(() => {
    if (nextPublishAt === undefined || nextPublishAt === null) return;
    const triggerPublish = async () => {
      try {
        await publishDueAnnouncements({ now: Date.now() });
      } catch (error) {
        console.error(error);
      } finally {
        setNow(Date.now());
      }
    };
    const delay = Math.max(nextPublishAt - Date.now(), 0);
    if (delay === 0) {
      void triggerPublish();
      return;
    }
    const timeout = window.setTimeout(() => {
      void triggerPublish();
    }, delay);
    return () => window.clearTimeout(timeout);
  }, [nextPublishAt, publishDueAnnouncements]);

  React.useEffect(() => {
    void publishDueAnnouncements({ now: Date.now() }).catch((error) =>
      console.error(error),
    );
  }, [publishDueAnnouncements]);
  const [deletingId, setDeletingId] =
    React.useState<AnnouncementId | null>(null);
  const [archivingId, setArchivingId] =
    React.useState<AnnouncementId | null>(null);
  const [isHeaderDismissed, setIsHeaderDismissed] =
    React.useState<boolean | null>(null);
  const [activePollId, setActivePollId] =
    React.useState<AnnouncementId | null>(null);
  const [viewingAnnouncement, setViewingAnnouncement] =
    React.useState<Announcement | null>(null);
  const [viewingVoting, setViewingVoting] =
    React.useState<Announcement | null>(null);
  const isLoading = activities === undefined;
  const hasActivities = (activities?.length ?? 0) > 0;
  const isAdmin =
    (user?.publicMetadata?.role as string | null | undefined) === 'admin';

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(
      DASHBOARD_HEADER_STORAGE_KEY,
    );
    setIsHeaderDismissed(stored === 'true');
  }, []);

  const dismissHeader = React.useCallback(() => {
    setIsHeaderDismissed(true);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DASHBOARD_HEADER_STORAGE_KEY, 'true');
    }
  }, []);

  const handleDelete = React.useCallback(
    async (id: AnnouncementId) => {
      const confirmed = window.confirm(
        'Are you sure you want to permanently delete this activity?',
      );
      if (!confirmed) return;
      try {
        setDeletingId(id);
        await deleteAnnouncement({ id });
        setNow(Date.now());
      } catch (error) {
        console.error(error);
        window.alert('Failed to delete activity.');
      } finally {
        setDeletingId(null);
      }
    },
    [deleteAnnouncement],
  );

  const handleEdit = React.useCallback(
    (id: AnnouncementId) => {
      router.push(`/admin/create?edit=${id}`);
    },
    [router],
  );

  const handleArchive = React.useCallback(
    async (id: AnnouncementId) => {
      const confirmed = window.confirm(
        'Archive this activity? It will be removed from the dashboard list.',
      );
      if (!confirmed) return;
      try {
        setArchivingId(id);
        await archiveAnnouncement({ id });
        setNow(Date.now());
      } catch (error) {
        console.error(error);
        window.alert('Failed to archive activity.');
      } finally {
        setArchivingId(null);
      }
    },
    [archiveAnnouncement],
  );

  const handleOpenPoll = React.useCallback((id: AnnouncementId) => {
    setActivePollId(id);
  }, []);

  const handleViewAnnouncement = React.useCallback(
    (announcement: Announcement) => {
      setViewingAnnouncement(announcement);
    },
    [],
  );

  const handleOpenVoting = React.useCallback((announcement: Announcement) => {
    setViewingVoting(announcement);
  }, []);

  return (
    <section className='mx-auto w-full max-w-5xl px-4 py-16'>
      <MoraleSubHeader />
      <header className='mb-10 sm:mb-12'>
        {isHeaderDismissed === null ? (
          <div className='h-32 animate-pulse rounded-2xl border border-border/60 bg-card/40' />
        ) : !isHeaderDismissed ? (
          <div className='relative rounded-2xl border border-border bg-card px-6 py-8 text-center shadow-sm'>
            <button
              type='button'
              onClick={dismissHeader}
              className='absolute right-4 top-4 rounded-full border border-transparent p-1 text-muted-foreground transition hover:border-border hover:bg-secondary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
              aria-label='Dismiss welcome message'
            >
              <span aria-hidden={true}>&times;</span>
            </button>
            <h1 className='text-4xl font-semibold tracking-tight text-foreground sm:text-5xl'>
              Welcome to the Morale Dashboard!
            </h1>
            <p className='mt-4 text-base text-muted-foreground sm:text-lg'>
              Stay connected with upcoming morale events and stay up to date with the latest announcements. Browse the latest activities below.
            </p>
          </div>
        ) : (
          <h1 className='text-3xl font-semibold text-foreground text-center sm:text-left'>
            Morale Dashboard
          </h1>
        )}
      </header>

      <div className='space-y-4'>
        {isLoading && <DashboardSkeleton />}
        {!isLoading && !hasActivities && (
          <p className='rounded-lg border border-dashed border-border/60 bg-card/40 px-4 py-10 text-center text-sm text-muted-foreground'>
            Nothing to see here yet. Check back later for updates!
          </p>
        )}
        {!isLoading &&
          hasActivities &&
          activities!.map((activity) => (
            <ActivityCard
              key={activity._id}
              activity={activity}
              canManage={isAdmin}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onArchive={handleArchive}
              deletingId={deletingId}
              archivingId={archivingId}
              onOpenPoll={handleOpenPoll}
              onOpenVoting={handleOpenVoting}
              onViewAnnouncement={handleViewAnnouncement}
            />
          ))}
      </div>

      {activePollId && (
        <PollModal
          pollId={activePollId}
          onClose={() => setActivePollId(null)}
          isAdmin={isAdmin}
          canVote={Boolean(user)}
        />
      )}

      {viewingAnnouncement && (
        <AnnouncementModal
          announcement={viewingAnnouncement}
          onClose={() => setViewingAnnouncement(null)}
        />
      )}

      {viewingVoting && (
        <VotingModal
          event={viewingVoting}
          onClose={() => setViewingVoting(null)}
        />
      )}
    </section>
  );
}

type ActivityCardProps = {
  activity: Announcement;
  canManage: boolean;
  onDelete: (id: AnnouncementId) => Promise<void>;
  onEdit: (id: AnnouncementId) => void;
  deletingId: AnnouncementId | null;
  onArchive: (id: AnnouncementId) => Promise<void>;
  archivingId: AnnouncementId | null;
  onOpenPoll?: (id: AnnouncementId) => void;
  onOpenVoting?: (announcement: Announcement) => void;
  onViewAnnouncement: (announcement: Announcement) => void;
};

function ActivityCard({
  activity,
  canManage,
  onDelete,
  onEdit,
  deletingId,
  onArchive,
  archivingId,
  onOpenPoll,
  onOpenVoting,
  onViewAnnouncement,
}: ActivityCardProps) {
  const publishedDate = React.useMemo(
    () => formatDate(activity.publishAt),
    [activity.publishAt],
  );
  const editedDate = React.useMemo(
    () =>
      activity.updatedAt ? formatDate(activity.updatedAt) : null,
    [activity.updatedAt],
  );
  const autoDeleteDate = React.useMemo(() => {
    if (typeof activity.autoDeleteAt !== 'number') return null;
    return formatDate(activity.autoDeleteAt);
  }, [activity.autoDeleteAt]);
  const autoArchiveDate = React.useMemo(() => {
    if (typeof activity.autoArchiveAt !== 'number') return null;
    return formatDate(activity.autoArchiveAt);
  }, [activity.autoArchiveAt]);

  const isPollCard = activity.eventType === 'poll';
  const isVotingCard = activity.eventType === 'voting';

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
            <ActivityMenu
              activityId={activity._id}
              onDelete={onDelete}
              onEdit={onEdit}
              isDeleting={deletingId === activity._id}
              onArchive={onArchive}
              isArchiving={archivingId === activity._id}
              canArchive={!isVotingCard}
            />
          )}
        </div>
      </header>

      <h2 className='mt-4 text-2xl font-semibold text-foreground'>{activity.title}</h2>
      <DescriptionPreview
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
          {!isPollCard && !isVotingCard && (
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

function DescriptionPreview({
  text,
  imageCount = 0,
}: {
  text: string;
  imageCount?: number;
}) {
  const formattedText = React.useMemo(
    () => text.replace(/\r\n/g, '\n'),
    [text],
  );
  const attachmentNotice = React.useMemo(() => {
    if (!imageCount) return null;
    const label = imageCount === 1 ? 'image' : 'images';
    return `(${imageCount} ${label} attached)`;
  }, [imageCount]);

  return (
    <div className='mt-4 space-y-1'>
      <p
        className='text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap wrap-break-word'
        style={{
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {formattedText}
      </p>
      {attachmentNotice && (
        <p className='text-xs italic text-muted-foreground'>{attachmentNotice}</p>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className='space-y-4'>
      {Array.from({ length: 3 }).map((_, idx) => (
        <div
          key={idx}
          className='animate-pulse rounded-xl border border-border bg-card/60 p-6'
        >
          <div className='h-4 w-24 rounded-full bg-muted' />
          <div className='mt-4 h-6 w-3/4 rounded bg-muted' />
          <div className='mt-3 h-4 w-full rounded bg-muted' />
          <div className='mt-2 h-4 w-5/6 rounded bg-muted' />
        </div>
      ))}
    </div>
  );
}

type ActivityMenuProps = {
  activityId: AnnouncementId;
  onEdit: (id: AnnouncementId) => void;
  onDelete: (id: AnnouncementId) => Promise<void>;
  isDeleting: boolean;
  onArchive: (id: AnnouncementId) => Promise<void>;
  isArchiving: boolean;
  canArchive: boolean;
};

function ActivityMenu({
  activityId,
  onEdit,
  onDelete,
  isDeleting,
  onArchive,
  isArchiving,
  canArchive,
}: ActivityMenuProps) {
  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (
        menuRef.current &&
        event.target instanceof Node &&
        !menuRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);

    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const toggleMenu = () => setOpen((prev) => !prev);
  const closeMenu = () => setOpen(false);

  const handleEdit = () => {
    onEdit(activityId);
    closeMenu();
  };

  const handleDelete = async () => {
    await onDelete(activityId);
    closeMenu();
  };

  const handleArchive = async () => {
    if (!canArchive) return;
    await onArchive(activityId);
    closeMenu();
  };

  return (
    <div className='relative flex'>
      <button
        type='button'
        onClick={toggleMenu}
        aria-haspopup='menu'
        aria-expanded={open}
        className='rounded-full border border-transparent p-1 text-muted-foreground transition hover:border-border hover:bg-secondary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
      >
        <MoreVertical className='h-4 w-4' aria-hidden={true} />
        <span className='sr-only'>Open activity actions</span>
      </button>
      {open && (
        <div
          ref={menuRef}
          className='absolute right-0 top-8 z-20 w-36 rounded-md border border-border bg-popover p-1 shadow-lg'
          role='menu'
        >
          <button
            type='button'
            onClick={handleEdit}
            className='flex w-full items-center justify-between rounded-sm px-3 py-2 text-sm text-foreground transition hover:bg-secondary'
          >
            Edit
          </button>
          {canArchive && (
            <button
              type='button'
              onClick={handleArchive}
              disabled={isArchiving}
              className='flex w-full items-center justify-between rounded-sm px-3 py-2 text-sm text-muted-foreground transition hover:bg-secondary disabled:opacity-60'
            >
              {isArchiving ? 'Archiving...' : 'Archive'}
            </button>
          )}
          <button
            type='button'
            onClick={handleDelete}
            disabled={isDeleting}
            className='flex w-full items-center justify-between rounded-sm px-3 py-2 text-sm text-destructive transition hover:bg-destructive/10 disabled:opacity-60'
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      )}
    </div>
  );}
