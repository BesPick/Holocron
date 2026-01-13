'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { MoreVertical } from 'lucide-react';
import { AnnouncementModal } from '@/components/announcements/announcement-modal';
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

const SCHEDULED_HEADER_STORAGE_KEY = 'bespickScheduledHeaderDismissed';

export default function ScheduledPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const isAdmin =
    (user?.publicMetadata?.role as string | null | undefined) === 'admin';

  React.useEffect(() => {
    if (!isLoaded || isAdmin) {
      return;
    }

    router.replace('/');
  }, [isLoaded, isAdmin, router]);

  if (!isLoaded) {
    return (
      <section className='mx-auto w-full max-w-5xl px-4 py-16'>
        <header className='mb-10 sm:mb-12'>
          <div className='h-32 animate-pulse rounded-2xl border border-border/60 bg-card/40' />
        </header>
        <ScheduledSkeleton />
      </section>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return <ScheduledContent />;
}

function ScheduledContent() {
  const router = useRouter();
  const [now, setNow] = React.useState(() => Date.now());
  const [isHeaderDismissed, setIsHeaderDismissed] = React.useState<
    boolean | null
  >(null);
  const [viewingAnnouncement, setViewingAnnouncement] =
    React.useState<Announcement | null>(null);
  const handleViewAnnouncement = React.useCallback(
    (announcement: Announcement) => {
      setViewingAnnouncement(announcement);
    },
    [],
  );

  React.useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(SCHEDULED_HEADER_STORAGE_KEY);
    setIsHeaderDismissed(stored === 'true');
  }, []);

  const dismissHeader = React.useCallback(() => {
    setIsHeaderDismissed(true);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SCHEDULED_HEADER_STORAGE_KEY, 'true');
    }
  }, []);

  const scheduledActivities = useApiQuery(
    api.announcements.listScheduled,
    { now },
    { liveKeys: ['announcements'] },
  );
  const deleteAnnouncement = useApiMutation(api.announcements.remove);

  const [deletingId, setDeletingId] = React.useState<AnnouncementId | null>(
    null
  );
  const [localActivities, setLocalActivities] =
    React.useState<Announcement[] | null>(null);

  React.useEffect(() => {
    if (scheduledActivities) {
      setLocalActivities(scheduledActivities);
    }
  }, [scheduledActivities]);

  const activities = localActivities ?? scheduledActivities ?? [];
  const isLoading = scheduledActivities === undefined;
  const canManage = true;

  const handleDelete = React.useCallback(
    async (id: AnnouncementId) => {
      const confirmed = window.confirm(
        'Delete this scheduled activity permanently?'
      );
      if (!confirmed) return;
      try {
        setDeletingId(id);
        await deleteAnnouncement({ id });
        setLocalActivities((prev) =>
          prev ? prev.filter((activity) => activity._id !== id) : prev,
        );
      } catch (error) {
        console.error(error);
        window.alert('Failed to delete activity.');
      } finally {
        setDeletingId(null);
      }
    },
    [deleteAnnouncement]
  );

  const handleEdit = React.useCallback(
    (id: AnnouncementId) => {
      router.push(`/admin/create?edit=${id}`);
    },
    [router]
  );

  return (
    <section className='mx-auto w-full max-w-5xl px-4 py-16'>
      <header className='mb-10 sm:mb-12'>
        {isHeaderDismissed === null ? (
          <div className='h-32 animate-pulse rounded-2xl border border-border/60 bg-card/40' />
        ) : !isHeaderDismissed ? (
          <div className='relative rounded-2xl border border-border bg-card px-6 py-8 text-center shadow-sm'>
            <button
              type='button'
              onClick={dismissHeader}
              className='absolute right-4 top-4 rounded-full border border-transparent p-1 text-muted-foreground transition hover:border-border hover:bg-secondary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
              aria-label='Dismiss scheduled welcome message'
            >
              <span aria-hidden='true'>&times;</span>
            </button>
            <h1 className='text-4xl font-semibold tracking-tight text-foreground sm:text-5xl'>
              Scheduled Activities
            </h1>
            <p className='mt-4 text-base text-muted-foreground sm:text-lg'>
              Everything queued up for the future lives here. Edit or delete a
              card before it goes live.
            </p>
          </div>
        ) : (
          <h1 className='text-3xl font-semibold text-foreground text-center sm:text-left'>
            Scheduled Activities
          </h1>
        )}
      </header>

      <div className='space-y-4'>
        {isLoading && <ScheduledSkeleton />}
        {!isLoading && activities.length === 0 && (
          <p className='rounded-lg border border-dashed border-border/60 bg-card/40 px-4 py-10 text-center text-sm text-muted-foreground'>
            No scheduled activities yet.
          </p>
        )}
        {!isLoading &&
          activities.length > 0 &&
          activities.map((activity) => (
            <ScheduledCard
              key={activity._id}
              activity={activity}
              canManage={canManage}
              onDelete={handleDelete}
              onEdit={handleEdit}
              deletingId={deletingId}
              onViewAnnouncement={handleViewAnnouncement}
            />
          ))}
      </div>

      {viewingAnnouncement && (
        <AnnouncementModal
          announcement={viewingAnnouncement}
          onClose={() => setViewingAnnouncement(null)}
        />
      )}
    </section>
  );
}

type ScheduledCardProps = {
  activity: Announcement;
  canManage: boolean;
  onEdit: (id: AnnouncementId) => void;
  onDelete: (id: AnnouncementId) => Promise<void>;
  deletingId: AnnouncementId | null;
  onViewAnnouncement: (announcement: Announcement) => void;
};

function ScheduledCard({
  activity,
  canManage,
  onDelete,
  onEdit,
  deletingId,
  onViewAnnouncement,
}: ScheduledCardProps) {
  const isPollCard = activity.eventType === 'poll';
  const scheduledFor = React.useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(activity.publishAt)),
    [activity.publishAt]
  );

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
          {canManage && (
            <ScheduledMenu
              activityId={activity._id}
              onEdit={onEdit}
              onDelete={onDelete}
              isDeleting={deletingId === activity._id}
            />
          )}
        </div>
      </header>

      <h2 className='mt-4 text-2xl font-semibold text-foreground'>
        {activity.title}
      </h2>
      <DescriptionPreview text={activity.description} />

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
        <div className='flex items-center gap-2'>
          <span className='rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground'>
            Scheduled
          </span>
          {!isPollCard && (
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

function DescriptionPreview({ text }: { text: string }) {
  const formattedText = React.useMemo(
    () => text.replace(/\r\n/g, '\n'),
    [text],
  );

  return (
    <div className='mt-4'>
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
    </div>
  );
}

type ScheduledMenuProps = {
  activityId: AnnouncementId;
  onEdit: (id: AnnouncementId) => void;
  onDelete: (id: AnnouncementId) => Promise<void>;
  isDeleting: boolean;
};

function ScheduledMenu({
  activityId,
  onEdit,
  onDelete,
  isDeleting,
}: ScheduledMenuProps) {
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

  return (
    <div className='relative flex'>
      <button
        type='button'
        onClick={toggleMenu}
        aria-haspopup='menu'
        aria-expanded={open}
        className='rounded-full border border-transparent p-1 text-muted-foreground transition hover:border-border hover:bg-secondary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
      >
        <MoreVertical className='h-4 w-4' aria-hidden='true' />
        <span className='sr-only'>Open scheduled activity actions</span>
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
  );
}

function ScheduledSkeleton() {
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
