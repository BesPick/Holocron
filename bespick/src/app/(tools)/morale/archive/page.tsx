'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { AnnouncementModal } from '@/components/announcements/announcement-modal';
import { FormModal } from '@/components/forms/form-modal';
import { PollModal } from '@/components/poll/poll-modal';
import { VotingModal } from '@/components/voting/voting-modal';
import { MoraleSubHeader } from '@/components/header/morale-subheader';
import { api } from '@/lib/api';
import { useApiMutation, useApiQuery } from '@/lib/apiClient';
import { ActivityListSkeleton } from '../_components/activity-list-skeleton';
import { ArchiveActivityCard } from '../_components/archive-activity-card';
import { DismissibleHeader } from '../_components/dismissible-header';
import type {
  Announcement,
  AnnouncementId,
} from '../_components/types';
import { useLocalActivities } from '../_hooks/use-local-activities';

const ARCHIVE_HEADER_STORAGE_KEY = 'bespickArchiveHeaderDismissed';

export default function ArchivePage() {
  const { user } = useUser();
  const router = useRouter();
  const archivedActivities = useApiQuery<Record<string, never>, Announcement[]>(
    api.announcements.listArchived,
    {},
    { liveKeys: ['announcements'] },
  );
  const deleteAnnouncement = useApiMutation(api.announcements.remove);
  const [deletingId, setDeletingId] =
    React.useState<AnnouncementId | null>(null);
  const [activePollId, setActivePollId] =
    React.useState<AnnouncementId | null>(null);
  const [viewingAnnouncement, setViewingAnnouncement] =
    React.useState<Announcement | null>(null);
  const [viewingFormId, setViewingFormId] =
    React.useState<AnnouncementId | null>(null);
  const [viewingVoting, setViewingVoting] =
    React.useState<Announcement | null>(null);
  const { activities, setLocalActivities } =
    useLocalActivities(archivedActivities);
  const isLoading = archivedActivities === undefined;
  const role = user?.publicMetadata?.role as string | null | undefined;
  const isMoraleAdmin =
    role === 'admin' || role === 'moderator' || role === 'morale-member';

  const handleDelete = React.useCallback(
    async (id: AnnouncementId) => {
      const confirmed = window.confirm(
        'Delete this archived activity permanently?',
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
    [deleteAnnouncement, setLocalActivities],
  );

  const handleEdit = React.useCallback(
    (id: AnnouncementId) => {
      router.push(`/morale/admin/create?edit=${id}`);
    },
    [router],
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

  const handleOpenForm = React.useCallback((id: AnnouncementId) => {
    setViewingFormId(id);
  }, []);
  const handleOpenVoting = React.useCallback((announcement: Announcement) => {
    setViewingVoting(announcement);
  }, []);

  return (
    <section className='mx-auto w-full max-w-5xl px-4 py-16'>
      <MoraleSubHeader />
      <DismissibleHeader
        storageKey={ARCHIVE_HEADER_STORAGE_KEY}
        title='Archived Activities'
        description='Revisit archived announcements, polls, and voting events. Items here no longer appear on the main dashboard but remain editable for future use.'
        dismissLabel='Dismiss archive welcome message'
      />

      <div className='space-y-4'>
        {isLoading && <ActivityListSkeleton />}
        {!isLoading && activities.length === 0 && (
          <p className='rounded-lg border border-dashed border-border/60 bg-card/40 px-4 py-10 text-center text-sm text-muted-foreground'>
            No archived activities yet.
          </p>
        )}
        {!isLoading &&
          activities.length > 0 &&
          activities.map((activity) => (
            <ArchiveActivityCard
              key={activity._id}
              activity={activity}
              canManage={isMoraleAdmin}
              onDelete={handleDelete}
              onEdit={handleEdit}
              deletingId={deletingId}
              onOpenPoll={handleOpenPoll}
              onOpenVoting={handleOpenVoting}
              onOpenForm={handleOpenForm}
              onViewAnnouncement={handleViewAnnouncement}
            />
          ))}
      </div>

      {activePollId && (
        <PollModal
          pollId={activePollId}
          onClose={() => setActivePollId(null)}
          isAdmin={isMoraleAdmin}
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

      {viewingFormId && (
        <FormModal
          formId={viewingFormId}
          onClose={() => setViewingFormId(null)}
          isAdmin={isMoraleAdmin}
          canSubmit={false}
        />
      )}
    </section>
  );
}
