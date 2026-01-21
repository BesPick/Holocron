'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { AnnouncementModal } from '@/components/announcements/announcement-modal';
import { MoraleSubHeader } from '@/components/header/morale-subheader';
import { api } from '@/lib/api';
import { useApiMutation, useApiQuery } from '@/lib/apiClient';
import { ActivityListSkeleton } from '../../_components/activity-list-skeleton';
import { DismissibleHeader } from '../../_components/dismissible-header';
import { ScheduledActivityCard } from '../../_components/scheduled-activity-card';
import type {
  Announcement,
  AnnouncementId,
} from '../../_components/types';
import { useLocalActivities } from '../../_hooks/use-local-activities';
import { useMinuteTicker } from '../../_hooks/use-minute-ticker';

const SCHEDULED_HEADER_STORAGE_KEY = 'bespickScheduledHeaderDismissed';

export default function ScheduledPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const role = user?.publicMetadata?.role as string | null | undefined;
  const isMoraleAdmin = role === 'admin' || role === 'moderator';

  React.useEffect(() => {
    if (!isLoaded || isMoraleAdmin) {
      return;
    }

    router.replace('/');
  }, [isLoaded, isMoraleAdmin, router]);

  if (!isLoaded) {
    return (
      <section className='mx-auto w-full max-w-5xl px-4 py-16'>
        <MoraleSubHeader />
        <header className='mb-10 sm:mb-12'>
          <div className='h-32 animate-pulse rounded-2xl border border-border/60 bg-card/40' />
        </header>
        <ActivityListSkeleton />
      </section>
    );
  }

  if (!isMoraleAdmin) {
    return null;
  }

  return <ScheduledContent />;
}

function ScheduledContent() {
  const router = useRouter();
  const { now } = useMinuteTicker();
  const [viewingAnnouncement, setViewingAnnouncement] =
    React.useState<Announcement | null>(null);
  const handleViewAnnouncement = React.useCallback(
    (announcement: Announcement) => {
      setViewingAnnouncement(announcement);
    },
    [],
  );

  const scheduledActivities = useApiQuery<{ now: number }, Announcement[]>(
    api.announcements.listScheduled,
    { now },
    { liveKeys: ['announcements'] },
  );
  const deleteAnnouncement = useApiMutation(api.announcements.remove);

  const [deletingId, setDeletingId] = React.useState<AnnouncementId | null>(
    null
  );
  const { activities, setLocalActivities } =
    useLocalActivities(scheduledActivities);
  const isLoading = scheduledActivities === undefined;

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
    [deleteAnnouncement, setLocalActivities]
  );

  const handleEdit = React.useCallback(
    (id: AnnouncementId) => {
      router.push(`/morale/admin/create?edit=${id}`);
    },
    [router]
  );

  return (
    <section className='mx-auto w-full max-w-5xl px-4 py-16'>
      <MoraleSubHeader />
      <DismissibleHeader
        storageKey={SCHEDULED_HEADER_STORAGE_KEY}
        title='Scheduled Activities'
        description='Everything queued up for the future lives here. Edit or delete a card before it goes live.'
        dismissLabel='Dismiss scheduled welcome message'
      />

      <div className='space-y-4'>
        {isLoading && <ActivityListSkeleton />}
        {!isLoading && activities.length === 0 && (
          <p className='rounded-lg border border-dashed border-border/60 bg-card/40 px-4 py-10 text-center text-sm text-muted-foreground'>
            No scheduled activities yet.
          </p>
        )}
        {!isLoading &&
          activities.length > 0 &&
          activities.map((activity) => (
            <ScheduledActivityCard
              key={activity._id}
              activity={activity}
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
