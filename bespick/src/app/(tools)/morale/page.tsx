'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { AnnouncementModal } from '@/components/announcements/announcement-modal';
import { PollModal } from '@/components/poll/poll-modal';
import { VotingModal } from '@/components/voting/voting-modal';
import { FormModal } from '@/components/forms/form-modal';
import { FundraiserModal } from '@/components/fundraiser/fundraiser-modal';
import { GiveawayModal } from '@/components/giveaway/giveaway-modal';
import { MoraleSubHeader } from '@/components/header/morale-subheader';
import { api } from '@/lib/api';
import { useApiMutation, useApiQuery } from '@/lib/apiClient';
import { ActivityListSkeleton } from './_components/activity-list-skeleton';
import { DashboardActivityCard } from './_components/dashboard-activity-card';
import { DismissibleHeader } from './_components/dismissible-header';
import type {
  Announcement,
  AnnouncementId,
} from './_components/types';
import { useMinuteTicker } from './_hooks/use-minute-ticker';

const DASHBOARD_HEADER_STORAGE_KEY = 'bespickDashboardHeaderDismissed';

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useUser();
  const { now, refresh } = useMinuteTicker();
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
        refresh();
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
  }, [nextPublishAt, publishDueAnnouncements, refresh]);

  React.useEffect(() => {
    void publishDueAnnouncements({ now: Date.now() }).catch((error) =>
      console.error(error),
    );
  }, [publishDueAnnouncements]);
  const [deletingId, setDeletingId] =
    React.useState<AnnouncementId | null>(null);
  const [archivingId, setArchivingId] =
    React.useState<AnnouncementId | null>(null);
  const [activePollId, setActivePollId] =
    React.useState<AnnouncementId | null>(null);
  const [viewingAnnouncement, setViewingAnnouncement] =
    React.useState<Announcement | null>(null);
  const [viewingVoting, setViewingVoting] =
    React.useState<Announcement | null>(null);
  const [viewingFormId, setViewingFormId] =
    React.useState<AnnouncementId | null>(null);
  const [viewingFundraiserId, setViewingFundraiserId] =
    React.useState<AnnouncementId | null>(null);
  const [viewingGiveawayId, setViewingGiveawayId] =
    React.useState<AnnouncementId | null>(null);
  const isLoading = activities === undefined;
  const hasActivities = (activities?.length ?? 0) > 0;
  const role = user?.publicMetadata?.role as string | null | undefined;
  const isMoraleAdmin =
    role === 'admin' || role === 'moderator' || role === 'morale-member';

  const handleDelete = React.useCallback(
    async (id: AnnouncementId) => {
      const confirmed = window.confirm(
        'Are you sure you want to permanently delete this activity?',
      );
      if (!confirmed) return;
      try {
        setDeletingId(id);
        await deleteAnnouncement({ id });
        refresh();
      } catch (error) {
        console.error(error);
        window.alert('Failed to delete activity.');
      } finally {
        setDeletingId(null);
      }
    },
    [deleteAnnouncement, refresh],
  );

  const handleEdit = React.useCallback(
    (id: AnnouncementId) => {
      router.push(`/morale/admin/create?edit=${id}`);
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
        refresh();
      } catch (error) {
        console.error(error);
        window.alert('Failed to archive activity.');
      } finally {
        setArchivingId(null);
      }
    },
    [archiveAnnouncement, refresh],
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

  const handleOpenForm = React.useCallback((id: AnnouncementId) => {
    setViewingFormId(id);
  }, []);

  const handleOpenFundraiser = React.useCallback((id: AnnouncementId) => {
    setViewingFundraiserId(id);
  }, []);

  const handleOpenGiveaway = React.useCallback((id: AnnouncementId) => {
    setViewingGiveawayId(id);
  }, []);

  return (
    <section className='mx-auto w-full max-w-5xl px-4 py-16'>
      <MoraleSubHeader />
      <DismissibleHeader
        storageKey={DASHBOARD_HEADER_STORAGE_KEY}
        title='Welcome to the Morale Dashboard!'
        description='Stay connected with upcoming morale events and up to date with the latest announcements. Browse the latest notifications below.'
        dismissLabel='Dismiss welcome message'
        collapsedTitle='Morale Dashboard'
      />

      <div className='space-y-4'>
        {isLoading && <ActivityListSkeleton />}
        {!isLoading && !hasActivities && (
          <p className='rounded-lg border border-dashed border-border/60 bg-card/40 px-4 py-10 text-center text-sm text-muted-foreground'>
            Nothing to see here yet. Check back later for updates!
          </p>
        )}
        {!isLoading &&
          hasActivities &&
          activities!.map((activity) => (
            <DashboardActivityCard
              key={activity._id}
              activity={activity}
              canManage={isMoraleAdmin}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onArchive={handleArchive}
              deletingId={deletingId}
              archivingId={archivingId}
              onOpenPoll={handleOpenPoll}
              onOpenVoting={handleOpenVoting}
              onOpenForm={handleOpenForm}
              onOpenFundraiser={handleOpenFundraiser}
              onOpenGiveaway={handleOpenGiveaway}
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
          canSubmit={Boolean(user)}
        />
      )}

      {viewingFundraiserId && (
        <FundraiserModal
          fundraiserId={viewingFundraiserId}
          onClose={() => setViewingFundraiserId(null)}
          canDonate={Boolean(user)}
          isAdmin={isMoraleAdmin}
        />
      )}

      {viewingGiveawayId && (
        <GiveawayModal
          giveawayId={viewingGiveawayId}
          onClose={() => setViewingGiveawayId(null)}
          canEnter={Boolean(user)}
          isAdmin={isMoraleAdmin}
        />
      )}
    </section>
  );
}
