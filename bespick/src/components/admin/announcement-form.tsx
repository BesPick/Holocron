'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useApiMutation, useApiQuery } from '@/lib/apiClient';
import type {
  ActivityStatus,
  ActivityType,
  Doc,
  FormQuestion,
  FormSubmissionLimit,
  FundraiserAnonymityMode,
  Id,
  StorageImage,
} from '@/types/db';
import type {
  CreateAnnouncementArgs,
  UpdateAnnouncementArgs,
} from '@/server/services/announcements';
import { SchedulingSection } from './announcement-form/sections/SchedulingSection';
import { PollOptionsSection } from './announcement-form/sections/PollOptionsSection';
import { PollSettingsSection } from './announcement-form/sections/PollSettingsSection';
import { AutomationSection } from './announcement-form/sections/AutomationSection';
import { ImageUploadSection } from './announcement-form/sections/ImageUploadSection';
import { VotingSettingsSection } from './announcement-form/sections/VotingSettingsSection';
import { FormBuilderSection } from './announcement-form/sections/FormBuilderSection';
import { FormSettingsSection } from './announcement-form/sections/FormSettingsSection';
import { FundraiserSettingsSection } from './announcement-form/sections/FundraiserSettingsSection';
import { GiveawaySettingsSection } from './announcement-form/sections/GiveawaySettingsSection';
import {
  GROUP_OPTIONS,
  type Group,
  type Portfolio,
  getPortfoliosForGroup,
} from '@/lib/org';
import {
  ACTIVITY_LABELS,
  ALLOWED_IMAGE_EXTENSIONS,
  ALLOWED_IMAGE_TYPES,
  GROUP_KEYS,
  LEADERBOARD_OPTIONS,
  MAX_IMAGES,
  PORTFOLIO_KEYS,
  initGroupSelections,
  initPortfolioSelections,
} from './announcement-form/constants';
import type {
  VotingLeaderboardMode,
  VotingParticipant,
  VotingRosterEntry,
} from './announcement-form/types';

type AnnouncementDoc = Doc<'announcements'>;

export function AnnouncementForm({
  activityType = 'announcements',
  existingActivity = null,
}: {
  activityType?: ActivityType;
  existingActivity?: AnnouncementDoc | null;
}) {
  const router = useRouter();
  const createAnnouncement = useApiMutation<
    CreateAnnouncementArgs,
    { id: Id<'announcements'>; status: ActivityStatus }
  >(api.announcements.create);
  const updateAnnouncement = useApiMutation<
    UpdateAnnouncementArgs,
    { id: Id<'announcements'>; status: ActivityStatus }
  >(api.announcements.update);

  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [date, setDate] = React.useState<string>('');
  const [time, setTime] = React.useState<string>('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [now, setNow] = React.useState(() => Date.now());
  const [autoDeleteEnabled, setAutoDeleteEnabled] = React.useState(false);
  const [deleteDate, setDeleteDate] = React.useState('');
  const [deleteTime, setDeleteTime] = React.useState('');
  const [autoArchiveEnabled, setAutoArchiveEnabled] = React.useState(false);
  const [archiveDate, setArchiveDate] = React.useState('');
  const [archiveTime, setArchiveTime] = React.useState('');
  const [pollOptions, setPollOptions] = React.useState<string[]>(['', '']);
  const [pollAnonymous, setPollAnonymous] = React.useState(false);
  const [pollAllowAdditionalOptions, setPollAllowAdditionalOptions] =
    React.useState(false);
  const [pollMaxSelections, setPollMaxSelections] = React.useState(1);
  const [pollHasClose, setPollHasClose] = React.useState(false);
  const [pollCloseDate, setPollCloseDate] = React.useState('');
  const [pollCloseTime, setPollCloseTime] = React.useState('');
  const [imageIds, setImageIds] = React.useState<Id<'_storage'>[]>([]);
  const [uploadingImages, setUploadingImages] = React.useState(false);
  const [votingRoster, setVotingRoster] = React.useState<VotingRosterEntry[]>(
    [],
  );
  const [votingGroupSelections, setVotingGroupSelections] = React.useState<
    Record<Group, boolean>
  >(() => initGroupSelections(true));
  const [votingPortfolioSelections, setVotingPortfolioSelections] = React.useState<
    Record<Portfolio, boolean>
  >(() => initPortfolioSelections(true));
  const [votingAllowUngrouped, setVotingAllowUngrouped] = React.useState(false);
  const [votingAllowRemovals, setVotingAllowRemovals] = React.useState(true);
  const [votingLockedGroups, setVotingLockedGroups] = React.useState<
    Record<Group, boolean>
  >(() => initGroupSelections(false));
  const [votingLockedPortfolios, setVotingLockedPortfolios] = React.useState<
    Record<Portfolio, boolean>
  >(() => initPortfolioSelections(false));
  const [votingLockedUngrouped, setVotingLockedUngrouped] =
    React.useState(false);
  const [votingAddVotePrice, setVotingAddVotePrice] = React.useState('');
  const [votingRemoveVotePrice, setVotingRemoveVotePrice] = React.useState('');
  const [votingAddVoteLimit, setVotingAddVoteLimit] = React.useState('');
  const [votingRemoveVoteLimit, setVotingRemoveVoteLimit] =
    React.useState('');
  const [votingAutoCloseEnabled, setVotingAutoCloseEnabled] =
    React.useState(false);
  const [votingCloseDate, setVotingCloseDate] = React.useState('');
  const [votingCloseTime, setVotingCloseTime] = React.useState('');
  const [votingLeaderboardMode, setVotingLeaderboardMode] =
    React.useState<VotingLeaderboardMode>('all');
  const [votingUsersLoading, setVotingUsersLoading] = React.useState(false);
  const [votingUsersError, setVotingUsersError] = React.useState<string | null>(
    null,
  );
  const [votingRosterRequested, setVotingRosterRequested] = React.useState(false);
  const [formQuestions, setFormQuestions] = React.useState<FormQuestion[]>([]);
  const [formSubmissionLimit, setFormSubmissionLimit] =
    React.useState<FormSubmissionLimit>('unlimited');
  const [formPaymentEnabled, setFormPaymentEnabled] = React.useState(false);
  const [formPrice, setFormPrice] = React.useState('');
  const [formAllowAnonymousChoice, setFormAllowAnonymousChoice] =
    React.useState(false);
  const [formForceAnonymous, setFormForceAnonymous] = React.useState(false);
  const [fundraiserGoal, setFundraiserGoal] = React.useState('');
  const [fundraiserAnonymityMode, setFundraiserAnonymityMode] =
    React.useState<FundraiserAnonymityMode>('user_choice');
  const [giveawayAllowMultipleEntries, setGiveawayAllowMultipleEntries] =
    React.useState(false);
  const [giveawayEntryCap, setGiveawayEntryCap] = React.useState('');
  const [giveawayWinnersCount, setGiveawayWinnersCount] =
    React.useState('1');
  const [giveawayEntryPriceEnabled, setGiveawayEntryPriceEnabled] =
    React.useState(false);
  const [giveawayEntryPrice, setGiveawayEntryPrice] = React.useState('');
  const [giveawayAutoCloseEnabled, setGiveawayAutoCloseEnabled] =
    React.useState(false);
  const [giveawayCloseDate, setGiveawayCloseDate] = React.useState('');
  const [giveawayCloseTime, setGiveawayCloseTime] = React.useState('');

  const todayLocalISO = React.useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const ensureMinimumPollOptions = React.useCallback((options: string[]) => {
    const next = options.length > 0 ? [...options] : ['', ''];
    while (next.length < 2) {
      next.push('');
    }
    return next;
  }, []);

  const handlePollOptionChange = React.useCallback((index: number, value: string) => {
    setPollOptions((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const handleAddPollOption = React.useCallback(() => {
    setPollOptions((prev) => [...prev, '']);
  }, []);

  const handleRemovePollOption = React.useCallback((index: number) => {
    setPollOptions((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  const handleImageUpload = React.useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      setError(null);

      const files = Array.from(fileList);
      if (imageIds.length + files.length > MAX_IMAGES) {
        setError(`You can upload up to ${MAX_IMAGES} images.`);
        return;
      }

      const invalidFile = files.find(
        (file) => {
          const type = file.type?.toLowerCase();
          if (type && ALLOWED_IMAGE_TYPES.has(type)) return false;
          const name = file.name ?? '';
          const dot = name.lastIndexOf('.');
          const ext = dot >= 0 ? name.slice(dot).toLowerCase() : '';
          return !ALLOWED_IMAGE_EXTENSIONS.has(ext);
        },
      );
      if (invalidFile) {
        setError('Only JPG, PNG, GIF, or WEBP images are supported.');
        return;
      }

      setUploadingImages(true);
      try {
        const uploadedIds: Id<'_storage'>[] = [];
        for (const file of files) {
          const formData = new FormData();
          formData.append('file', file);
          const response = await fetch(api.storage.upload, {
            method: 'POST',
            body: formData,
          });
          if (!response.ok) {
            throw new Error('Failed to upload image.');
          }
          const { storageId } = await response.json();
          if (!storageId) {
            throw new Error('Upload response missing storageId.');
          }
          uploadedIds.push(storageId as Id<'_storage'>);
        }
        setImageIds((prev) => [...prev, ...uploadedIds]);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to upload images.';
        setError(message);
      } finally {
        setUploadingImages(false);
      }
    },
    [imageIds.length],
  );

  const handleRemoveImage = React.useCallback((id: Id<'_storage'>) => {
    setImageIds((prev) => prev.filter((imageId) => imageId !== id));
  }, []);

  const hasLockedVotingAssignments = React.useMemo(
    () =>
      Object.values(votingLockedGroups).some(Boolean) ||
      Object.values(votingLockedPortfolios).some(Boolean),
    [votingLockedGroups, votingLockedPortfolios],
  );

  const handleToggleVotingGroup = React.useCallback(
    (group: Group, checked: boolean) => {
      if (votingLockedGroups[group] && !checked) {
        return;
      }
      setVotingGroupSelections((prev) => ({ ...prev, [group]: checked }));
      setVotingPortfolioSelections((prev) => {
        const updated = { ...prev };
        getPortfoliosForGroup(group).forEach((portfolio) => {
          updated[portfolio] = checked;
        });
        return updated;
      });
    },
    [votingLockedGroups],
  );

  const handleToggleVotingPortfolio = React.useCallback(
    (portfolio: Portfolio, checked: boolean) => {
      if (votingLockedPortfolios[portfolio] && !checked) {
        return;
      }
      setVotingPortfolioSelections((prev) => ({ ...prev, [portfolio]: checked }));
      setVotingGroupSelections((prev) => {
        const next = { ...prev };
        const owningGroup = GROUP_OPTIONS.find((option) =>
          option.portfolios.includes(portfolio),
        )?.value;
        if (owningGroup) {
          next[owningGroup] = true;
        }
        return next;
      });
    },
    [votingLockedPortfolios],
  );

  const handleToggleVotingUngrouped = React.useCallback(
    (checked: boolean) => {
      if (votingLockedUngrouped && !checked) {
        return;
      }
      setVotingAllowUngrouped(checked);
    },
    [votingLockedUngrouped],
  );

  const handleToggleVotingAllowRemovals = React.useCallback(
    (checked: boolean) => {
      setVotingAllowRemovals(checked);
    },
    [],
  );

  const handleToggleVotingSelectAll = React.useCallback(
    (checked: boolean) => {
      if (!checked && hasLockedVotingAssignments) {
        return;
      }
      setVotingGroupSelections(initGroupSelections(checked));
      setVotingPortfolioSelections(initPortfolioSelections(checked));
    },
    [hasLockedVotingAssignments],
  );

  const handleVotingLeaderboardModeChange = React.useCallback(
    (value: string) => {
      if (value === 'group' || value === 'group_portfolio' || value === 'all') {
        setVotingLeaderboardMode(value);
      } else {
        setVotingLeaderboardMode('all');
      }
    },
    [],
  );

  const fetchVotingParticipants = React.useCallback(async () => {
    setVotingRosterRequested(true);
    setVotingUsersLoading(true);
    setVotingUsersError(null);
    try {
      const response = await fetch('/api/admin/users');
      if (!response.ok) {
        throw new Error(
          response.status === 403
            ? 'You do not have permission to load users.'
            : 'Failed to load users. Please try again.',
        );
      }
      const data = (await response.json()) as {
        users?: VotingRosterEntry[];
      };
      const roster = Array.isArray(data.users) ? data.users : [];
      setVotingRoster(
        roster.map((entry) => ({
          userId: entry.userId,
          firstName: entry.firstName,
          lastName: entry.lastName,
          group: entry.group ?? null,
          portfolio: entry.portfolio ?? null,
          votes: typeof entry.votes === 'number' ? entry.votes : 0,
        })),
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to load users. Please try again.';
      setVotingUsersError(message);
      setVotingRoster([]);
    } finally {
      setVotingUsersLoading(false);
    }
  }, []);

  const handlePublishDateChange = React.useCallback(
    (nextDate: string) => {
      setDate(nextDate);
      if (autoDeleteEnabled) {
        setDeleteDate('');
        setDeleteTime('');
      }
      if (autoArchiveEnabled) {
        setArchiveDate('');
        setArchiveTime('');
      }
    },
    [autoDeleteEnabled, autoArchiveEnabled],
  );

  const handlePublishTimeChange = React.useCallback(
    (nextTime: string) => {
      setTime(nextTime);
      if (autoDeleteEnabled) {
        setDeleteDate('');
        setDeleteTime('');
      }
      if (autoArchiveEnabled) {
        setArchiveDate('');
        setArchiveTime('');
      }
    },
    [autoDeleteEnabled, autoArchiveEnabled],
  );

  const earliestAutomationDate = React.useMemo(() => {
    if (!date) return todayLocalISO;
    return date < todayLocalISO ? todayLocalISO : date;
  }, [date, todayLocalISO]);

  const minAutoDeleteDate = earliestAutomationDate;
  const minAutoArchiveDate = earliestAutomationDate;
  const minGiveawayCloseDate = earliestAutomationDate;
  const minVotingCloseDate = earliestAutomationDate;

  const handleTogglePollClose = React.useCallback(
    (enabled: boolean) => {
      setPollHasClose(enabled);
      if (enabled) {
        const defaultDate = earliestAutomationDate;
        setPollCloseDate((prev) => prev || defaultDate);
        setPollCloseTime((prev) => prev || time || '');
      } else {
        setPollCloseDate('');
        setPollCloseTime('');
      }
    },
    [earliestAutomationDate, time],
  );

  const handleToggleAutoDelete = React.useCallback(
    (enabled: boolean) => {
      setAutoDeleteEnabled(enabled);
      if (enabled) {
        setAutoArchiveEnabled(false);
        setArchiveDate('');
        setArchiveTime('');
        const defaultDeleteDate = earliestAutomationDate;
        setDeleteDate((prev) => prev || defaultDeleteDate);
        setDeleteTime((prev) => prev || time || '');
      } else {
        setDeleteDate('');
        setDeleteTime('');
      }
    },
    [earliestAutomationDate, time],
  );

  const handleToggleAutoArchive = React.useCallback(
    (enabled: boolean) => {
      setAutoArchiveEnabled(enabled);
      if (enabled) {
        setAutoDeleteEnabled(false);
        setDeleteDate('');
        setDeleteTime('');
        const defaultArchiveDate = earliestAutomationDate;
        setArchiveDate((prev) => prev || defaultArchiveDate);
        setArchiveTime((prev) => prev || time || '');
      } else {
        setArchiveDate('');
        setArchiveTime('');
      }
    },
    [earliestAutomationDate, time],
  );

  const handleToggleGiveawayAutoClose = React.useCallback(
    (enabled: boolean) => {
      setGiveawayAutoCloseEnabled(enabled);
      if (enabled) {
        const defaultCloseDate = earliestAutomationDate;
        setGiveawayCloseDate((prev) => prev || defaultCloseDate);
        setGiveawayCloseTime((prev) => prev || time || '');
      } else {
        setGiveawayCloseDate('');
        setGiveawayCloseTime('');
      }
    },
    [earliestAutomationDate, time],
  );

  const handleToggleFormAllowAnonymousChoice = React.useCallback(
    (enabled: boolean) => {
      setFormAllowAnonymousChoice(enabled);
      if (enabled) {
        setFormForceAnonymous(false);
      }
    },
    [],
  );

  const handleToggleFormForceAnonymous = React.useCallback(
    (enabled: boolean) => {
      setFormForceAnonymous(enabled);
      if (enabled) {
        setFormAllowAnonymousChoice(false);
      }
    },
    [],
  );

  const handleToggleVotingAutoClose = React.useCallback(
    (enabled: boolean) => {
      setVotingAutoCloseEnabled(enabled);
      if (enabled) {
        const defaultCloseDate = earliestAutomationDate;
        setVotingCloseDate((prev) => prev || defaultCloseDate);
        setVotingCloseTime((prev) => prev || time || '');
      } else {
        setVotingCloseDate('');
        setVotingCloseTime('');
      }
    },
    [earliestAutomationDate, time],
  );

  const applyExistingValues = React.useCallback((activity: AnnouncementDoc) => {
    setTitle(activity.title);
    setDescription(activity.description);
    const publishDate = new Date(activity.publishAt);
    const isoDate = publishDate.toISOString().slice(0, 10);
    const timeStr = `${String(publishDate.getHours()).padStart(2, '0')}:${String(publishDate.getMinutes()).padStart(2, '0')}`;
    setDate(isoDate);
    setTime(timeStr);
    setImageIds(activity.imageIds ?? []);

    if (typeof activity.autoDeleteAt === 'number') {
      const deleteAt = new Date(activity.autoDeleteAt);
      const deleteIso = deleteAt.toISOString().slice(0, 10);
      const deleteTimeStr = `${String(deleteAt.getHours()).padStart(2, '0')}:${String(deleteAt.getMinutes()).padStart(2, '0')}`;
      setAutoDeleteEnabled(true);
      setDeleteDate(deleteIso);
      setDeleteTime(deleteTimeStr);
    } else {
      setAutoDeleteEnabled(false);
      setDeleteDate('');
      setDeleteTime('');
    }

    if (typeof activity.autoArchiveAt === 'number') {
      const archiveAt = new Date(activity.autoArchiveAt);
      const archiveIso = archiveAt.toISOString().slice(0, 10);
      const archiveTimeStr = `${String(archiveAt.getHours()).padStart(2, '0')}:${String(archiveAt.getMinutes()).padStart(2, '0')}`;
      setAutoArchiveEnabled(true);
      setArchiveDate(archiveIso);
      setArchiveTime(archiveTimeStr);
      // Ensure only one automation is active
      setAutoDeleteEnabled(false);
      setDeleteDate('');
      setDeleteTime('');
    } else {
      setAutoArchiveEnabled(false);
      setArchiveDate('');
      setArchiveTime('');
    }

    if (activity.eventType === 'poll') {
      setTitle(activity.pollQuestion ?? activity.title ?? '');
      const options = Array.isArray(activity.pollOptions)
        ? activity.pollOptions.map((option) => option ?? '')
        : ['', ''];
      setPollOptions(ensureMinimumPollOptions(options));
      setPollAnonymous(Boolean(activity.pollAnonymous));
      setPollAllowAdditionalOptions(
        Boolean(activity.pollAllowAdditionalOptions),
      );
      setPollMaxSelections(
        Math.max(
          1,
          Math.floor(activity.pollMaxSelections ?? 1),
        ),
      );
      if (typeof activity.pollClosesAt === 'number') {
        const closeDate = new Date(activity.pollClosesAt);
        setPollHasClose(true);
        setPollCloseDate(closeDate.toISOString().slice(0, 10));
        setPollCloseTime(
          `${String(closeDate.getHours()).padStart(2, '0')}:${String(closeDate.getMinutes()).padStart(2, '0')}`,
        );
      } else {
        setPollHasClose(false);
        setPollCloseDate('');
        setPollCloseTime('');
      }
    } else {
      setPollOptions(['', '']);
      setPollAnonymous(false);
      setPollAllowAdditionalOptions(false);
      setPollMaxSelections(1);
      setPollHasClose(false);
      setPollCloseDate('');
      setPollCloseTime('');
    }

    if (activity.eventType === 'voting') {
      const nextGroupSelections = initGroupSelections(false);
      const lockedGroups = initGroupSelections(false);
      const storedGroups = Array.isArray(activity.votingAllowedGroups)
        ? activity.votingAllowedGroups
        : null;
      if (storedGroups && storedGroups.length > 0) {
        storedGroups.forEach((group) => {
          if (GROUP_KEYS.includes(group as Group)) {
            nextGroupSelections[group as Group] = true;
            lockedGroups[group as Group] = true;
          }
        });
        setVotingGroupSelections({ ...nextGroupSelections });
        setVotingLockedGroups({ ...lockedGroups });
      } else {
        const allGroups = initGroupSelections(true);
        setVotingGroupSelections(allGroups);
        setVotingLockedGroups({ ...allGroups });
      }

      const nextPortfolioSelections = initPortfolioSelections(false);
      const lockedPortfolios = initPortfolioSelections(false);
      const storedPortfolios = Array.isArray(activity.votingAllowedPortfolios)
        ? activity.votingAllowedPortfolios
        : null;
      if (storedPortfolios && storedPortfolios.length > 0) {
        storedPortfolios.forEach((portfolio) => {
          if (PORTFOLIO_KEYS.includes(portfolio as Portfolio)) {
            nextPortfolioSelections[portfolio as Portfolio] = true;
            lockedPortfolios[portfolio as Portfolio] = true;
          }
        });
        setVotingPortfolioSelections({ ...nextPortfolioSelections });
        setVotingLockedPortfolios({ ...lockedPortfolios });
      } else {
        const allPortfolios = initPortfolioSelections(true);
        setVotingPortfolioSelections(allPortfolios);
        setVotingLockedPortfolios({ ...allPortfolios });
      }

      const allowUngroupedValue =
        typeof activity.votingAllowUngrouped === 'boolean'
          ? activity.votingAllowUngrouped
          : false;
      setVotingAllowUngrouped(allowUngroupedValue);
      setVotingLockedUngrouped(Boolean(allowUngroupedValue));
      const allowRemovalsValue =
        typeof activity.votingAllowRemovals === 'boolean'
          ? activity.votingAllowRemovals
          : true;
      setVotingAllowRemovals(allowRemovalsValue);
      setVotingLeaderboardMode(
        (activity.votingLeaderboardMode as VotingLeaderboardMode | undefined) &&
          ['all', 'group', 'group_portfolio'].includes(
            activity.votingLeaderboardMode as VotingLeaderboardMode,
          )
          ? (activity.votingLeaderboardMode as VotingLeaderboardMode)
          : 'all',
      );
      setVotingAddVotePrice(
        typeof activity.votingAddVotePrice === 'number'
          ? activity.votingAddVotePrice.toString()
          : '',
      );
      setVotingRemoveVotePrice(
        typeof activity.votingRemoveVotePrice === 'number' && allowRemovalsValue
          ? activity.votingRemoveVotePrice.toString()
          : '',
      );
      setVotingAddVoteLimit(
        typeof activity.votingAddVoteLimit === 'number'
          ? activity.votingAddVoteLimit.toString()
          : '',
      );
      setVotingRemoveVoteLimit(
        typeof activity.votingRemoveVoteLimit === 'number'
          ? activity.votingRemoveVoteLimit.toString()
          : '',
      );
      if (typeof activity.votingAutoCloseAt === 'number') {
        const closeAt = new Date(activity.votingAutoCloseAt);
        setVotingAutoCloseEnabled(true);
        setVotingCloseDate(closeAt.toISOString().slice(0, 10));
        setVotingCloseTime(
          `${String(closeAt.getHours()).padStart(2, '0')}:${String(closeAt.getMinutes()).padStart(2, '0')}`,
        );
      } else {
        setVotingAutoCloseEnabled(false);
        setVotingCloseDate('');
        setVotingCloseTime('');
      }
      setVotingUsersError(null);
    } else {
      setVotingGroupSelections(initGroupSelections(true));
      setVotingPortfolioSelections(initPortfolioSelections(true));
      setVotingAllowUngrouped(false);
      setVotingAllowRemovals(true);
      setVotingLockedGroups(initGroupSelections(false));
      setVotingLockedPortfolios(initPortfolioSelections(false));
      setVotingLockedUngrouped(false);
      setVotingAddVotePrice('');
      setVotingRemoveVotePrice('');
      setVotingAddVoteLimit('');
      setVotingRemoveVoteLimit('');
      setVotingAutoCloseEnabled(false);
      setVotingCloseDate('');
      setVotingCloseTime('');
      setVotingUsersError(null);
      setVotingLeaderboardMode('all');
    }

    if (activity.eventType === 'form') {
      const questions = Array.isArray(activity.formQuestions)
        ? activity.formQuestions
        : [];
      setFormQuestions(questions);
      setFormSubmissionLimit(
        activity.formSubmissionLimit ?? 'unlimited',
      );
      setFormAllowAnonymousChoice(
        Boolean(activity.formAllowAnonymousChoice),
      );
      setFormForceAnonymous(Boolean(activity.formForceAnonymous));
      const price =
        typeof activity.formPrice === 'number' ? activity.formPrice : null;
      setFormPaymentEnabled(typeof price === 'number');
      setFormPrice(
        typeof price === 'number' && price > 0 ? price.toFixed(2) : '',
      );
    } else {
      setFormQuestions([]);
      setFormSubmissionLimit('unlimited');
      setFormAllowAnonymousChoice(false);
      setFormForceAnonymous(false);
      setFormPaymentEnabled(false);
      setFormPrice('');
    }

    if (activity.eventType === 'fundraiser') {
      const goal =
        typeof activity.fundraiserGoal === 'number'
          ? activity.fundraiserGoal
          : null;
      setFundraiserGoal(
        typeof goal === 'number' && goal > 0 ? goal.toFixed(2) : '',
      );
      setFundraiserAnonymityMode(
        activity.fundraiserAnonymityMode ?? 'user_choice',
      );
    } else {
      setFundraiserGoal('');
      setFundraiserAnonymityMode('user_choice');
    }

    if (activity.eventType === 'giveaway') {
      const allowMultiple = Boolean(activity.giveawayAllowMultipleEntries);
      setGiveawayAllowMultipleEntries(allowMultiple);
      setGiveawayEntryCap(
        allowMultiple && typeof activity.giveawayEntryCap === 'number'
          ? activity.giveawayEntryCap.toString()
          : '',
      );
      setGiveawayWinnersCount(
        typeof activity.giveawayWinnersCount === 'number'
          ? activity.giveawayWinnersCount.toString()
          : '1',
      );
      const entryPrice =
        typeof activity.giveawayEntryPrice === 'number'
          ? activity.giveawayEntryPrice
          : null;
      setGiveawayEntryPriceEnabled(Boolean(entryPrice && entryPrice > 0));
      setGiveawayEntryPrice(
        typeof entryPrice === 'number' && entryPrice > 0
          ? entryPrice.toFixed(2)
          : '',
      );
      if (typeof activity.giveawayAutoCloseAt === 'number') {
        const closeAt = new Date(activity.giveawayAutoCloseAt);
        setGiveawayAutoCloseEnabled(true);
        setGiveawayCloseDate(closeAt.toISOString().slice(0, 10));
        setGiveawayCloseTime(
          `${String(closeAt.getHours()).padStart(2, '0')}:${String(closeAt.getMinutes()).padStart(2, '0')}`,
        );
      } else {
        setGiveawayAutoCloseEnabled(false);
        setGiveawayCloseDate('');
        setGiveawayCloseTime('');
      }
    } else {
      setGiveawayAllowMultipleEntries(false);
      setGiveawayEntryCap('');
      setGiveawayWinnersCount('1');
      setGiveawayEntryPriceEnabled(false);
      setGiveawayEntryPrice('');
      setGiveawayAutoCloseEnabled(false);
      setGiveawayCloseDate('');
      setGiveawayCloseTime('');
    }
  }, [ensureMinimumPollOptions]);

  const isEditing = Boolean(existingActivity);
  const showSchedulingControls = true;
  const shouldEnforceFuturePublishGuards = !isEditing;
  const isScheduled = Boolean(date && time) && showSchedulingControls;
  const activeType =
    (existingActivity?.eventType as ActivityType | undefined) ?? activityType;
  const isPoll = activeType === 'poll';
  const isVoting = activeType === 'voting';
  const isForm = activeType === 'form';
  const isFundraiser = activeType === 'fundraiser';
  const isGiveaway = activeType === 'giveaway';
  const activityLabel = ACTIVITY_LABELS[activeType];
  const buttonLabel = isEditing
    ? 'Save and Publish'
    : isScheduled
      ? `Schedule ${activityLabel}`
      : `Publish ${activityLabel}`;

  const eligibleVotingParticipants = React.useMemo(() => {
    if (!isVoting) return [] as VotingParticipant[];
    return votingRoster
      .filter((entry) => {
        if (!entry.group) {
          return votingAllowUngrouped;
        }
        const groupSelection = votingGroupSelections[entry.group];
        const portfoliosForGroup = getPortfoliosForGroup(entry.group);
        if (portfoliosForGroup.length === 0) {
          return Boolean(groupSelection);
        }
        if (entry.portfolio) {
          const portfolioSelection =
            votingPortfolioSelections[entry.portfolio];
          if (typeof portfolioSelection === 'boolean') {
            return portfolioSelection;
          }
        }
        return Boolean(groupSelection);
      })
      .map((entry) => ({
        userId: entry.userId,
        firstName: entry.firstName,
        lastName: entry.lastName,
        group: entry.group,
        portfolio: entry.portfolio,
        votes: typeof entry.votes === 'number' ? entry.votes : 0,
      }));
  }, [
    isVoting,
    votingRoster,
    votingGroupSelections,
    votingPortfolioSelections,
    votingAllowUngrouped,
  ]);

  const votingAllSelected = React.useMemo(() => {
    const allGroupsSelected = GROUP_KEYS.every(
      (group) => votingGroupSelections[group],
    );
    const allPortfoliosSelected = PORTFOLIO_KEYS.every(
      (portfolio) => votingPortfolioSelections[portfolio],
    );
    return allGroupsSelected && allPortfoliosSelected;
  }, [votingGroupSelections, votingPortfolioSelections]);

  React.useEffect(() => {
    setDate((prev) => prev || todayLocalISO);
  }, [todayLocalISO]);

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  React.useEffect(() => {
    if (!existingActivity) return;
    applyExistingValues(existingActivity);
  }, [existingActivity, applyExistingValues]);

  React.useEffect(() => {
    if (!isPoll) {
      setPollOptions(['', '']);
      setPollAnonymous(false);
      setPollAllowAdditionalOptions(false);
      setPollMaxSelections(1);
      setPollHasClose(false);
      setPollCloseDate('');
      setPollCloseTime('');
    }
  }, [isPoll]);

  React.useEffect(() => {
    if (!isVoting) {
      setVotingRoster([]);
      setVotingGroupSelections(initGroupSelections(true));
      setVotingPortfolioSelections(initPortfolioSelections(true));
      setVotingAllowUngrouped(false);
      setVotingAllowRemovals(true);
      setVotingLockedGroups(initGroupSelections(false));
      setVotingLockedPortfolios(initPortfolioSelections(false));
      setVotingLockedUngrouped(false);
      setVotingAddVotePrice('');
      setVotingRemoveVotePrice('');
      setVotingAddVoteLimit('');
      setVotingRemoveVoteLimit('');
      setVotingAutoCloseEnabled(false);
      setVotingCloseDate('');
      setVotingCloseTime('');
      setVotingUsersError(null);
      setVotingUsersLoading(false);
      setVotingRosterRequested(false);
      setVotingLeaderboardMode('all');
      return;
    }
    if (!votingRosterRequested && !votingUsersLoading) {
      void fetchVotingParticipants();
    }
  }, [
    isVoting,
    votingUsersLoading,
    fetchVotingParticipants,
    votingRosterRequested,
  ]);

  React.useEffect(() => {
    if (!isGiveaway) return;
    setAutoArchiveEnabled(false);
    setArchiveDate('');
    setArchiveTime('');
  }, [isGiveaway]);

  React.useEffect(() => {
    if (isForm) return;
    setFormQuestions([]);
    setFormSubmissionLimit('unlimited');
    setFormAllowAnonymousChoice(false);
    setFormForceAnonymous(false);
    setFormPaymentEnabled(false);
    setFormPrice('');
  }, [isForm]);

  React.useEffect(() => {
    if (isFundraiser) return;
    setFundraiserGoal('');
    setFundraiserAnonymityMode('user_choice');
  }, [isFundraiser]);

  React.useEffect(() => {
    if (isGiveaway) return;
    setGiveawayAllowMultipleEntries(false);
    setGiveawayEntryCap('');
    setGiveawayWinnersCount('1');
    setGiveawayEntryPriceEnabled(false);
    setGiveawayEntryPrice('');
    setGiveawayAutoCloseEnabled(false);
    setGiveawayCloseDate('');
    setGiveawayCloseTime('');
  }, [isGiveaway]);

  React.useEffect(() => {
    if (!isPoll) return;
    const trimmedCount = Math.max(
      1,
      pollOptions.filter((option) => option.trim().length > 0).length,
    );
    setPollMaxSelections((current) => {
      const normalized = Math.max(
        1,
        Math.min(Math.floor(current) || 1, trimmedCount),
      );
      return normalized === current ? current : normalized;
    });
  }, [isPoll, pollOptions]);



  const scheduledDate = React.useMemo(() => {
    if (!date) return null;
    const [y, m, d] = date.split('-').map(Number);
    const dt = new Date(y, (m as number) - 1, d);
    return dt.toLocaleDateString(undefined, { dateStyle: 'medium' });
  }, [date]);

  const scheduledSummary = React.useMemo(() => {
    if (!date || !time) return null;
    const [y, m, d] = date.split('-').map(Number);
    const [hh, mm] = time.split(':').map(Number);
    const dt = new Date(y, (m as number) - 1, d, hh, mm, 0, 0);
    return dt.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }, [date, time]);

  function combineDateTimeToEpochMs(dateStr: string, timeStr: string): number {
    if (dateStr === todayLocalISO && !timeStr) return Date.now();
    if (!dateStr && !timeStr) return Date.now();

    const now = new Date();
    const [y, m, d] = (
      dateStr ||
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    )
      .split('-')
      .map(Number);
    const [hh, mm] = timeStr
      ? timeStr.split(':').map(Number)
      : [now.getHours(), now.getMinutes()];
    const local = new Date(y, (m as number) - 1, d, hh, mm, 0, 0);
    return local.getTime();
  }

  const resetForm = React.useCallback(() => {
    setTitle('');
    setDescription('');
    setDate(todayLocalISO);
    setTime('');
    setImageIds([]);
    setAutoDeleteEnabled(false);
    setDeleteDate('');
    setDeleteTime('');
    setAutoArchiveEnabled(false);
    setArchiveDate('');
    setArchiveTime('');
    setPollOptions(['', '']);
    setPollAnonymous(false);
    setPollAllowAdditionalOptions(false);
    setPollMaxSelections(1);
    setPollHasClose(false);
    setPollCloseDate('');
    setPollCloseTime('');
    setVotingRoster([]);
    setVotingGroupSelections(initGroupSelections(true));
    setVotingPortfolioSelections(initPortfolioSelections(true));
    setVotingAllowUngrouped(false);
    setVotingAllowRemovals(true);
    setVotingLockedGroups(initGroupSelections(false));
    setVotingLockedPortfolios(initPortfolioSelections(false));
    setVotingLockedUngrouped(false);
    setVotingAddVotePrice('');
    setVotingRemoveVotePrice('');
    setVotingAddVoteLimit('');
    setVotingRemoveVoteLimit('');
    setVotingAutoCloseEnabled(false);
    setVotingCloseDate('');
    setVotingCloseTime('');
    setVotingUsersError(null);
    setVotingRosterRequested(false);
    setVotingLeaderboardMode('all');
    setFormQuestions([]);
    setFormSubmissionLimit('unlimited');
    setFormAllowAnonymousChoice(false);
    setFormForceAnonymous(false);
    setFormPaymentEnabled(false);
    setFormPrice('');
    setFundraiserGoal('');
    setFundraiserAnonymityMode('user_choice');
    setGiveawayAllowMultipleEntries(false);
    setGiveawayEntryCap('');
    setGiveawayWinnersCount('1');
    setGiveawayEntryPriceEnabled(false);
    setGiveawayEntryPrice('');
    setGiveawayAutoCloseEnabled(false);
    setGiveawayCloseDate('');
    setGiveawayCloseTime('');
  }, [todayLocalISO]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (showSchedulingControls) {
      if (date !== todayLocalISO && !time) {
        setError('Please pick a publish time.');
        return;
      }

      if (
        shouldEnforceFuturePublishGuards &&
        date === todayLocalISO &&
        time
      ) {
        const publishAtCandidate = combineDateTimeToEpochMs(date, time);
        if (publishAtCandidate < Date.now()) {
          setError('Publish time cannot be in the past.');
          return;
        }
      }
    }

    const nextPublishAt = showSchedulingControls
      ? combineDateTimeToEpochMs(date, time)
      : Date.now();

    let autoDeleteAtValue: number | null = null;
    if (autoDeleteEnabled) {
      if (!deleteDate || !deleteTime) {
        setError('Please select a delete date and time.');
        return;
      }
      const autoDeleteCandidate = combineDateTimeToEpochMs(
        deleteDate,
        deleteTime
      );
      if (autoDeleteCandidate <= nextPublishAt) {
        setError('Delete time must be after the publish time.');
        return;
      }
      if (autoDeleteCandidate <= Date.now()) {
        setError('Delete time must be in the future.');
        return;
      }
      autoDeleteAtValue = autoDeleteCandidate;
    }

    let autoArchiveAtValue: number | null = null;
    if (autoArchiveEnabled) {
      if (!archiveDate || !archiveTime) {
        setError('Please select an archive date and time.');
        return;
      }
      const autoArchiveCandidate = combineDateTimeToEpochMs(
        archiveDate,
        archiveTime
      );
      if (autoArchiveCandidate <= nextPublishAt) {
        setError('Archive time must be after the publish time.');
        return;
      }
      if (autoArchiveCandidate <= Date.now()) {
        setError('Archive time must be in the future.');
        return;
      }
      autoArchiveAtValue = autoArchiveCandidate;
    }

    if (autoDeleteAtValue !== null && autoArchiveAtValue !== null) {
      setError('Choose either auto delete or auto archive, not both.');
      return;
    }

    if (imageIds.length > MAX_IMAGES) {
      setError(`You can upload up to ${MAX_IMAGES} images.`);
      return;
    }

    let pollQuestionPayload: string | undefined;
    let pollOptionsPayload: string[] | undefined;
    let pollAnonymousPayload: boolean | undefined;
    let pollAllowAdditionalOptionsPayload: boolean | undefined;
    let pollMaxSelectionsPayload: number | undefined;
    let pollClosesAtPayload: number | undefined;
    let votingParticipantsPayload: VotingParticipant[] | undefined;
    let votingAddVotePricePayload: number | undefined;
    let votingRemoveVotePricePayload: number | undefined;
    let votingAddVoteLimitPayload: number | null | undefined;
    let votingRemoveVoteLimitPayload: number | null | undefined;
    let votingAllowedGroupsPayload: string[] | undefined;
    let votingAllowedPortfoliosPayload: string[] | undefined;
    let votingAllowUngroupedPayload: boolean | undefined;
    let votingAllowRemovalsPayload: boolean | undefined;
    let votingLeaderboardModePayload: VotingLeaderboardMode | undefined;
    let votingAutoCloseAtPayload: number | null | undefined;
    let formQuestionsPayload: FormQuestion[] | undefined;
    let formSubmissionLimitPayload: FormSubmissionLimit | undefined;
    let formPricePayload: number | null | undefined;
    let formAllowAnonymousChoicePayload: boolean | undefined;
    let formForceAnonymousPayload: boolean | undefined;
    let fundraiserGoalPayload: number | undefined;
    let fundraiserAnonymityModePayload: FundraiserAnonymityMode | undefined;
    let giveawayAllowMultipleEntriesPayload: boolean | undefined;
    let giveawayEntryCapPayload: number | null | undefined;
    let giveawayWinnersCountPayload: number | undefined;
    let giveawayEntryPricePayload: number | null | undefined;
    let giveawayAutoCloseAtPayload: number | null | undefined;
    if (isPoll) {
      const question = title.trim();
      if (!question) {
        setError('Poll question is required.');
        return;
      }
      if (question.length > 100) {
        setError('Poll question must be 100 characters or fewer.');
        return;
      }
      const cleanedOptions = pollOptions.map((option) => option.trim()).filter((option) => option.length > 0);
      if (cleanedOptions.length < 2) {
        setError('Polls require at least two options.');
        return;
      }
      const normalizedMaxSelections = Math.max(
        1,
        Math.min(
          cleanedOptions.length,
          Math.floor(pollMaxSelections) || 1,
        ),
      );
      pollQuestionPayload = question;
      pollOptionsPayload = cleanedOptions;
      pollAnonymousPayload = pollAnonymous;
      pollAllowAdditionalOptionsPayload = pollAllowAdditionalOptions;
      pollMaxSelectionsPayload = normalizedMaxSelections;
      if (pollHasClose) {
        if (!pollCloseDate || !pollCloseTime) {
          setError('Select a poll end date and time.');
          return;
        }
        const pollCloseCandidate = combineDateTimeToEpochMs(
          pollCloseDate,
          pollCloseTime,
        );
        if (pollCloseCandidate <= nextPublishAt) {
          setError('Poll end time must be after the publish time.');
          return;
        }
        pollClosesAtPayload = pollCloseCandidate;
      }
    }

    if (isVoting) {
      const normalizedParticipants = eligibleVotingParticipants
        .map((participant) => ({
          userId: participant.userId,
          firstName: participant.firstName.trim(),
          lastName: participant.lastName.trim(),
          group: participant.group ?? null,
          portfolio: participant.portfolio ?? null,
          votes: participant.votes,
        }))
        .filter(
          (participant) =>
            participant.userId &&
            (participant.firstName.length > 0 || participant.lastName.length > 0),
        );
      if (normalizedParticipants.length === 0) {
        setError('Voting events need at least one eligible user.');
        return;
      }
      const addPrice = parseFloat(votingAddVotePrice);
      if (Number.isNaN(addPrice) || addPrice < 0) {
        setError('Enter a valid price to add a vote.');
        return;
      }
      const allowRemovals = votingAllowRemovals;
      votingAllowRemovalsPayload = allowRemovals;
      let removePrice: number | undefined;
      if (allowRemovals) {
        const parsedRemove = parseFloat(votingRemoveVotePrice);
        if (Number.isNaN(parsedRemove) || parsedRemove < 0) {
          setError('Enter a valid price to remove a vote.');
          return;
        }
        removePrice = parsedRemove;
      }
      const addLimitValue = votingAddVoteLimit.trim();
      if (addLimitValue.length > 0) {
        const parsedLimit = Number(addLimitValue);
        if (
          !Number.isFinite(parsedLimit) ||
          parsedLimit < 0 ||
          !Number.isInteger(parsedLimit)
        ) {
          setError('Enter a whole number for the add vote limit.');
          return;
        }
        votingAddVoteLimitPayload = parsedLimit;
      } else {
        votingAddVoteLimitPayload = null;
      }
      const removeLimitValue = votingRemoveVoteLimit.trim();
      if (removeLimitValue.length > 0) {
        const parsedLimit = Number(removeLimitValue);
        if (
          !Number.isFinite(parsedLimit) ||
          parsedLimit < 0 ||
          !Number.isInteger(parsedLimit)
        ) {
          setError('Enter a whole number for the remove vote limit.');
          return;
        }
        votingRemoveVoteLimitPayload = parsedLimit;
      } else {
        votingRemoveVoteLimitPayload = null;
      }
      votingParticipantsPayload = normalizedParticipants;
      votingAddVotePricePayload = Math.round(addPrice * 100) / 100;
      votingRemoveVotePricePayload =
        typeof removePrice === 'number'
          ? Math.round(removePrice * 100) / 100
          : undefined;
      votingAllowedGroupsPayload = GROUP_KEYS.filter(
        (group) => votingGroupSelections[group],
      );
      votingAllowedPortfoliosPayload = PORTFOLIO_KEYS.filter(
        (portfolio) => votingPortfolioSelections[portfolio],
      );
      votingAllowUngroupedPayload = votingAllowUngrouped;
      votingLeaderboardModePayload = votingLeaderboardMode;

      if (votingAutoCloseEnabled) {
        if (!votingCloseDate || !votingCloseTime) {
          setError('Please select a voting close date and time.');
          return;
        }
        const autoCloseCandidate = combineDateTimeToEpochMs(
          votingCloseDate,
          votingCloseTime,
        );
        if (autoCloseCandidate <= nextPublishAt) {
          setError('Voting close time must be after the publish time.');
          return;
        }
        if (autoCloseCandidate <= Date.now()) {
          setError('Voting close time must be in the future.');
          return;
        }
        votingAutoCloseAtPayload = autoCloseCandidate;
      } else {
        votingAutoCloseAtPayload = null;
      }
    }

    if (isForm) {
      try {
        if (formQuestions.length === 0) {
          setError('Forms require at least one question.');
          return;
        }
        if (formQuestions.length > 5) {
          setError('Forms can include up to 5 questions.');
          return;
        }
        const sanitizedQuestions: FormQuestion[] = formQuestions.map(
          (question, index) => {
            const prompt = question.prompt?.trim() ?? '';
            if (!prompt) {
              throw new Error(`Question ${index + 1} needs a prompt.`);
            }
            if (question.type === 'multiple_choice') {
              const options = (question.options ?? [])
                .map((option) => option.trim())
                .filter((option) => option.length > 0);
              const uniqueOptions = Array.from(new Set(options));
              if (uniqueOptions.length < 2) {
                throw new Error(
                  `Multiple choice questions need at least 2 options.`,
                );
              }
              if (uniqueOptions.length > 10) {
                throw new Error(
                  `Multiple choice questions support up to 10 options.`,
                );
              }
              const maxSelectionsRaw =
                typeof question.maxSelections === 'number'
                  ? Math.floor(question.maxSelections)
                  : 2;
              const maxSelections = Math.min(
                Math.max(2, maxSelectionsRaw),
                uniqueOptions.length,
              );
              return {
                ...question,
                prompt,
                options: uniqueOptions,
                maxSelections,
                required: question.required ?? true,
                allowAdditionalOptions: Boolean(
                  question.allowAdditionalOptions,
                ),
              };
            }
            if (question.type === 'dropdown') {
              const options = (question.options ?? [])
                .map((option) => option.trim())
                .filter((option) => option.length > 0);
              const uniqueOptions = Array.from(new Set(options));
              if (uniqueOptions.length < 2) {
                throw new Error(
                  `Dropdown questions need at least 2 options.`,
                );
              }
              if (uniqueOptions.length > 10) {
                throw new Error(
                  `Dropdown questions support up to 10 options.`,
                );
              }
              return {
                ...question,
                prompt,
                options: uniqueOptions,
                required: question.required ?? true,
              };
            }
            if (question.type === 'free_text') {
              return {
                ...question,
                prompt,
                maxLength: 250,
                required: question.required ?? true,
              };
            }
            if (question.type === 'user_select') {
              return {
                ...question,
                prompt,
                required: question.required ?? true,
              };
            }
            if (question.type === 'number') {
              const allowAnyNumber = Boolean(question.allowAnyNumber);
              const minValue =
                typeof question.minValue === 'number' &&
                Number.isFinite(question.minValue)
                  ? question.minValue
                  : 0;
              const maxValue =
                typeof question.maxValue === 'number' &&
                Number.isFinite(question.maxValue)
                  ? question.maxValue
                  : minValue;
              const includeMin =
                typeof question.includeMin === 'boolean'
                  ? question.includeMin
                  : true;
              const includeMax =
                typeof question.includeMax === 'boolean'
                  ? question.includeMax
                  : true;
              if (!allowAnyNumber && minValue > maxValue) {
                throw new Error(
                  `Number range minimum must be less than or equal to maximum.`,
                );
              }
              if (
                !allowAnyNumber &&
                minValue === maxValue &&
                (!includeMin || !includeMax)
              ) {
                throw new Error(
                  `Number range must include the single allowed value.`,
                );
              }
              const priceSourceIds = Array.from(
                new Set(
                  [
                    ...(question.priceSourceQuestionIds ?? []),
                    ...(question.priceSourceQuestionId
                      ? [question.priceSourceQuestionId]
                      : []),
                  ]
                    .map((value) => value.trim())
                    .filter((value) => value.length > 0),
                ),
              );
              if (priceSourceIds.length > 0) {
                for (const sourceId of priceSourceIds) {
                  const sourceIndex = formQuestions.findIndex(
                    (entry) => entry.id === sourceId,
                  );
                  const sourceQuestion =
                    sourceIndex >= 0 ? formQuestions[sourceIndex] : null;
                  if (
                    sourceQuestion === null ||
                    sourceIndex >= index ||
                    (sourceQuestion.type !== 'dropdown' &&
                      sourceQuestion.type !== 'multiple_choice')
                  ) {
                    throw new Error(
                      `Number pricing must reference previous dropdown or multiple choice questions.`,
                    );
                  }
                  const hasPrices = Object.values(
                    sourceQuestion.optionPrices ?? {},
                  ).some((value) => value > 0);
                  if (!hasPrices) {
                    throw new Error(
                      `Add option prices to "${sourceQuestion.prompt || 'the selected question'}" to use it for pricing.`,
                    );
                  }
                }
              }
              const pricePerUnit =
                typeof question.pricePerUnit === 'number' &&
                Number.isFinite(question.pricePerUnit)
                  ? question.pricePerUnit
                  : undefined;
              if (pricePerUnit !== undefined && pricePerUnit < 0) {
                throw new Error('Price per unit must be non-negative.');
              }
              return {
                ...question,
                prompt,
                required: question.required ?? true,
                minValue: allowAnyNumber ? undefined : minValue,
                maxValue: allowAnyNumber ? undefined : maxValue,
                includeMin: allowAnyNumber ? undefined : includeMin,
                includeMax: allowAnyNumber ? undefined : includeMax,
                allowAnyNumber,
                pricePerUnit: priceSourceIds.length > 0 ? undefined : pricePerUnit,
                priceSourceQuestionId: undefined,
                priceSourceQuestionIds:
                  priceSourceIds.length > 0 ? priceSourceIds : undefined,
              };
            }
            throw new Error('Unsupported question type.');
          },
        );

        formQuestionsPayload = sanitizedQuestions;
        formSubmissionLimitPayload = formSubmissionLimit;
        if (formAllowAnonymousChoice && formForceAnonymous) {
          setError(
            'Choose either optional anonymous submissions or enforce anonymous submissions.',
          );
          return;
        }
        formAllowAnonymousChoicePayload = formAllowAnonymousChoice;
        formForceAnonymousPayload = formForceAnonymous;
        if (formPaymentEnabled) {
          const hasQuestionPricing = sanitizedQuestions.some((question) => {
            if (
              question.type === 'multiple_choice' ||
              question.type === 'dropdown'
            ) {
              return Object.values(question.optionPrices ?? {}).some(
                (value) => value > 0,
              );
            }
            if (question.type === 'number') {
              return (
                (question.pricePerUnit ?? 0) > 0 ||
                Boolean(
                  question.priceSourceQuestionIds?.length ||
                    question.priceSourceQuestionId,
                )
              );
            }
            return false;
          });
          const rawPrice = formPrice.trim();
          if (!rawPrice) {
            if (!hasQuestionPricing) {
              setError(
                'Enter a base price or assign prices to question options.',
              );
              return;
            }
            formPricePayload = 0;
          } else {
            const priceValue = parseFloat(rawPrice);
            if (
              !Number.isFinite(priceValue) ||
              (priceValue <= 0 && !hasQuestionPricing)
            ) {
              setError('Enter a valid price for the form.');
              return;
            }
            formPricePayload = Math.round(priceValue * 100) / 100;
          }
        } else {
          formPricePayload = null;
        }
      } catch (formError) {
        const message =
          formError instanceof Error
            ? formError.message
            : 'Form questions are invalid.';
        setError(message);
        return;
      }
    }

    if (isFundraiser) {
      const goalValue = parseFloat(fundraiserGoal);
      if (!Number.isFinite(goalValue) || goalValue <= 0) {
        setError('Enter a valid fundraiser goal amount.');
        return;
      }
      fundraiserGoalPayload = Math.round(goalValue * 100) / 100;
      fundraiserAnonymityModePayload = fundraiserAnonymityMode;
    }

    if (isGiveaway) {
      const winnersValue = Number(giveawayWinnersCount);
      if (
        !Number.isFinite(winnersValue) ||
        winnersValue <= 0 ||
        !Number.isInteger(winnersValue)
      ) {
        setError('Enter a valid winner count.');
        return;
      }
      giveawayWinnersCountPayload = winnersValue;
      giveawayAllowMultipleEntriesPayload = giveawayAllowMultipleEntries;
      if (giveawayAllowMultipleEntries) {
        const capValue = giveawayEntryCap.trim();
        if (capValue.length > 0) {
          const parsedCap = Number(capValue);
          if (
            !Number.isFinite(parsedCap) ||
            parsedCap <= 0 ||
            !Number.isInteger(parsedCap)
          ) {
            setError('Entry cap must be a whole number greater than zero.');
            return;
          }
          giveawayEntryCapPayload = parsedCap;
        } else {
          giveawayEntryCapPayload = null;
        }
      } else {
        giveawayEntryCapPayload = 1;
      }

      if (giveawayEntryPriceEnabled) {
        const priceValue = parseFloat(giveawayEntryPrice);
        if (!Number.isFinite(priceValue) || priceValue <= 0) {
          setError('Enter a valid entry price for the giveaway.');
          return;
        }
        giveawayEntryPricePayload = Math.round(priceValue * 100) / 100;
      } else {
        giveawayEntryPricePayload = null;
      }

      if (giveawayAutoCloseEnabled) {
        if (!giveawayCloseDate || !giveawayCloseTime) {
          setError('Please select a close date and time.');
          return;
        }
        const autoCloseCandidate = combineDateTimeToEpochMs(
          giveawayCloseDate,
          giveawayCloseTime,
        );
        if (autoCloseCandidate <= nextPublishAt) {
          setError('Close time must be after the publish time.');
          return;
        }
        if (autoCloseCandidate <= Date.now()) {
          setError('Close time must be in the future.');
          return;
        }
        giveawayAutoCloseAtPayload = autoCloseCandidate;
      } else {
        giveawayAutoCloseAtPayload = null;
      }
    }

    setSubmitting(true);
    try {
      if (isEditing && existingActivity) {
        const { status } = await updateAnnouncement({
          id: existingActivity._id,
          title,
          description,
          publishAt: nextPublishAt,
          autoDeleteAt: autoDeleteAtValue,
          autoArchiveAt: autoArchiveAtValue,
          pollQuestion: pollQuestionPayload,
          pollOptions: pollOptionsPayload,
          pollAnonymous: pollAnonymousPayload,
          pollAllowAdditionalOptions: pollAllowAdditionalOptionsPayload,
          pollMaxSelections: pollMaxSelectionsPayload,
          pollClosesAt: pollClosesAtPayload ?? null,
          votingParticipants: votingParticipantsPayload,
          votingAddVotePrice: votingAddVotePricePayload,
          votingRemoveVotePrice: votingRemoveVotePricePayload,
          votingAddVoteLimit: votingAddVoteLimitPayload,
          votingRemoveVoteLimit: votingRemoveVoteLimitPayload,
          votingAllowedGroups: votingAllowedGroupsPayload,
          votingAllowedPortfolios: votingAllowedPortfoliosPayload,
          votingAllowUngrouped: votingAllowUngroupedPayload,
          votingAllowRemovals: votingAllowRemovalsPayload,
          votingLeaderboardMode: votingLeaderboardModePayload,
          votingAutoCloseAt: votingAutoCloseAtPayload,
          formQuestions: formQuestionsPayload,
          formSubmissionLimit: formSubmissionLimitPayload,
          formPrice: formPricePayload,
          formAllowAnonymousChoice: formAllowAnonymousChoicePayload,
          formForceAnonymous: formForceAnonymousPayload,
          fundraiserGoal: fundraiserGoalPayload,
          fundraiserAnonymityMode: fundraiserAnonymityModePayload,
          giveawayAllowMultipleEntries: giveawayAllowMultipleEntriesPayload,
          giveawayEntryCap: giveawayEntryCapPayload,
          giveawayWinnersCount: giveawayWinnersCountPayload,
          giveawayEntryPrice: giveawayEntryPricePayload,
          giveawayAutoCloseAt: giveawayAutoCloseAtPayload,
          eventType: activeType,
          imageIds,
        });
        setSuccess(
          status === 'published'
            ? `${activityLabel} updated and live.`
            : `${activityLabel} update saved.`
        );
      } else {
        const { status } = await createAnnouncement({
          title,
          description,
          publishAt: nextPublishAt,
          autoDeleteAt: autoDeleteAtValue,
          autoArchiveAt: autoArchiveAtValue,
          pollQuestion: pollQuestionPayload,
          pollOptions: pollOptionsPayload,
          pollAnonymous: pollAnonymousPayload,
          pollAllowAdditionalOptions: pollAllowAdditionalOptionsPayload,
          pollMaxSelections: pollMaxSelectionsPayload,
          pollClosesAt: pollClosesAtPayload ?? null,
          votingParticipants: votingParticipantsPayload,
          votingAddVotePrice: votingAddVotePricePayload,
          votingRemoveVotePrice: votingRemoveVotePricePayload,
          votingAddVoteLimit: votingAddVoteLimitPayload,
          votingRemoveVoteLimit: votingRemoveVoteLimitPayload,
          votingAllowedGroups: votingAllowedGroupsPayload,
          votingAllowedPortfolios: votingAllowedPortfoliosPayload,
          votingAllowUngrouped: votingAllowUngroupedPayload,
          votingAllowRemovals: votingAllowRemovalsPayload,
          votingLeaderboardMode: votingLeaderboardModePayload,
          votingAutoCloseAt: votingAutoCloseAtPayload,
          formQuestions: formQuestionsPayload,
          formSubmissionLimit: formSubmissionLimitPayload,
          formPrice: formPricePayload,
          formAllowAnonymousChoice: formAllowAnonymousChoicePayload,
          formForceAnonymous: formForceAnonymousPayload,
          fundraiserGoal: fundraiserGoalPayload,
          fundraiserAnonymityMode: fundraiserAnonymityModePayload,
          giveawayAllowMultipleEntries: giveawayAllowMultipleEntriesPayload,
          giveawayEntryCap: giveawayEntryCapPayload,
          giveawayWinnersCount: giveawayWinnersCountPayload,
          giveawayEntryPrice: giveawayEntryPricePayload,
          giveawayAutoCloseAt: giveawayAutoCloseAtPayload,
          eventType: activeType,
          imageIds,
        });
        resetForm();
        setSuccess(
          status === 'published'
            ? `${activityLabel} published successfully.`
            : `${activityLabel} scheduled successfully.`
        );
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  function onCancel() {
    if (isEditing && existingActivity) {
      router.push('/');
      return;
    }
    resetForm();
    setError(null);
    setSuccess(null);
  }

  const timeSlots = React.useMemo(() => {
    const slots: string[] = [];
    for (let h = 0; h < 24; h += 1) {
      for (const m of [0, 15, 30, 45]) {
        slots.push(
          `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
        );
      }
    }
    return slots;
  }, []);

  const slotToMinutes = React.useCallback((slot: string) => {
    const [h, m] = slot.split(':').map(Number);
    return h * 60 + m;
  }, []);

  const availableTimeSlotsCore = React.useMemo(() => {
    if (!showSchedulingControls) return timeSlots;
    if (date === todayLocalISO) {
      const current = new Date(now);
      const currentMinutes = current.getHours() * 60 + current.getMinutes();
      return timeSlots.filter((slot) => slotToMinutes(slot) >= currentMinutes);
    }
    return timeSlots;
  }, [date, todayLocalISO, timeSlots, slotToMinutes, now, showSchedulingControls]);

  React.useEffect(() => {
    if (isEditing || !time || date !== todayLocalISO) return;
    const current = new Date(now);
    const currentMinutes = current.getHours() * 60 + current.getMinutes();
    if (slotToMinutes(time) < currentMinutes) {
      setTime('');
    }
  }, [time, date, todayLocalISO, now, slotToMinutes, isEditing]);

  const displayTimeSlots = React.useMemo(() => {
    if (time && !availableTimeSlotsCore.includes(time)) {
      return [time, ...availableTimeSlotsCore];
    }
    return availableTimeSlotsCore;
  }, [time, availableTimeSlotsCore]);

  const autoDeleteSummary = React.useMemo(() => {
    if (!autoDeleteEnabled || !deleteDate || !deleteTime) return null;
    const [y, m, d] = deleteDate.split('-').map(Number);
    const [hh, mm] = deleteTime.split(':').map(Number);
    const dt = new Date(y, (m as number) - 1, d, hh, mm, 0, 0);
    return dt.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }, [autoDeleteEnabled, deleteDate, deleteTime]);

  const autoArchiveSummary = React.useMemo(() => {
    if (!autoArchiveEnabled || !archiveDate || !archiveTime) return null;
    const [y, m, d] = archiveDate.split('-').map(Number);
    const [hh, mm] = archiveTime.split(':').map(Number);
    const dt = new Date(y, (m as number) - 1, d, hh, mm, 0, 0);
    return dt.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }, [autoArchiveEnabled, archiveDate, archiveTime]);

  const giveawayCloseSummary = React.useMemo(() => {
    if (!giveawayAutoCloseEnabled || !giveawayCloseDate || !giveawayCloseTime) {
      return null;
    }
    const [y, m, d] = giveawayCloseDate.split('-').map(Number);
    const [hh, mm] = giveawayCloseTime.split(':').map(Number);
    const dt = new Date(y, (m as number) - 1, d, hh, mm, 0, 0);
    return dt.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }, [giveawayAutoCloseEnabled, giveawayCloseDate, giveawayCloseTime]);

  const votingCloseSummary = React.useMemo(() => {
    if (!votingAutoCloseEnabled || !votingCloseDate || !votingCloseTime) {
      return null;
    }
    const [y, m, d] = votingCloseDate.split('-').map(Number);
    const [hh, mm] = votingCloseTime.split(':').map(Number);
    const dt = new Date(y, (m as number) - 1, d, hh, mm, 0, 0);
    return dt.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }, [votingAutoCloseEnabled, votingCloseDate, votingCloseTime]);

  const minPollCloseDate = React.useMemo(() => {
    return date || todayLocalISO;
  }, [date, todayLocalISO]);

  React.useEffect(() => {
    if (!pollHasClose || !pollCloseDate) return;
    if (pollCloseDate < minPollCloseDate) {
      setPollCloseDate(minPollCloseDate);
      setPollCloseTime('');
    }
  }, [pollHasClose, pollCloseDate, minPollCloseDate]);

  const availablePollCloseTimeSlots = React.useMemo(() => {
    if (!pollHasClose || !pollCloseDate) return timeSlots;

    const publishDateForGuard =
      showSchedulingControls && date ? date : todayLocalISO;
    const publishMinutes =
      showSchedulingControls && time ? slotToMinutes(time) : null;

    return timeSlots.filter((slot) => {
      const minutes = slotToMinutes(slot);

      if (pollCloseDate === todayLocalISO) {
        const current = new Date(now);
        const currentMinutes = current.getHours() * 60 + current.getMinutes();
        if (minutes <= currentMinutes) {
          return false;
        }
      }

      if (
        showSchedulingControls &&
        publishMinutes !== null &&
        pollCloseDate === publishDateForGuard
      ) {
        if (minutes <= publishMinutes) {
          return false;
        }
      }

      return true;
    });
  }, [
    pollHasClose,
    pollCloseDate,
    timeSlots,
    todayLocalISO,
    now,
    slotToMinutes,
    showSchedulingControls,
    date,
    time,
  ]);

  const displayPollCloseTimeSlots = React.useMemo(() => {
    if (
      pollCloseTime &&
      !availablePollCloseTimeSlots.includes(pollCloseTime)
    ) {
      return [pollCloseTime, ...availablePollCloseTimeSlots];
    }
    return availablePollCloseTimeSlots;
  }, [pollCloseTime, availablePollCloseTimeSlots]);

  const noPollCloseSlotsLeftToday =
    pollHasClose &&
    pollCloseDate === todayLocalISO &&
    availablePollCloseTimeSlots.length === 0;

  React.useEffect(() => {
    if (!pollHasClose || !pollCloseTime) return;
    if (!availablePollCloseTimeSlots.includes(pollCloseTime)) {
      setPollCloseTime('');
    }
  }, [pollHasClose, pollCloseTime, availablePollCloseTimeSlots]);

  const availableDeleteTimeSlots = React.useMemo(() => {
    if (!autoDeleteEnabled || !deleteDate) return timeSlots;

    const publishDateForDeleteGuard =
      showSchedulingControls && date ? date : todayLocalISO;
    const publishMinutes =
      showSchedulingControls && time ? slotToMinutes(time) : null;

    return timeSlots.filter((slot) => {
      const minutes = slotToMinutes(slot);

      if (deleteDate === todayLocalISO) {
        const current = new Date(now);
        const currentMinutes = current.getHours() * 60 + current.getMinutes();
        if (minutes <= currentMinutes) {
          return false;
        }
      }

      if (
        showSchedulingControls &&
        publishMinutes !== null &&
        deleteDate === publishDateForDeleteGuard
      ) {
        if (minutes <= publishMinutes) {
          return false;
        }
      }

      return true;
    });
  }, [
    autoDeleteEnabled,
    deleteDate,
    timeSlots,
    todayLocalISO,
    now,
    slotToMinutes,
    showSchedulingControls,
    date,
    time,
  ]);

  const displayDeleteTimeSlots = React.useMemo(() => {
    if (deleteTime && !availableDeleteTimeSlots.includes(deleteTime)) {
      return [deleteTime, ...availableDeleteTimeSlots];
    }
    return availableDeleteTimeSlots;
  }, [deleteTime, availableDeleteTimeSlots]);

  const noDeleteSlotsLeftToday =
    autoDeleteEnabled &&
    deleteDate === todayLocalISO &&
    availableDeleteTimeSlots.length === 0;

  React.useEffect(() => {
    if (!autoDeleteEnabled || !deleteTime || deleteDate !== todayLocalISO) return;
    const current = new Date(now);
    const currentMinutes = current.getHours() * 60 + current.getMinutes();
    if (slotToMinutes(deleteTime) <= currentMinutes) {
      setDeleteTime('');
    }
  }, [autoDeleteEnabled, deleteTime, deleteDate, todayLocalISO, now, slotToMinutes]);

  const availableArchiveTimeSlots = React.useMemo(() => {
    if (!autoArchiveEnabled || !archiveDate) return timeSlots;

    const publishDateForGuard =
      showSchedulingControls && date ? date : todayLocalISO;
    const publishMinutes =
      showSchedulingControls && time ? slotToMinutes(time) : null;

    return timeSlots.filter((slot) => {
      const minutes = slotToMinutes(slot);

      if (archiveDate === todayLocalISO) {
        const current = new Date(now);
        const currentMinutes = current.getHours() * 60 + current.getMinutes();
        if (minutes <= currentMinutes) {
          return false;
        }
      }

      if (
        showSchedulingControls &&
        publishMinutes !== null &&
        archiveDate === publishDateForGuard
      ) {
        if (minutes <= publishMinutes) {
          return false;
        }
      }

      return true;
    });
  }, [
    autoArchiveEnabled,
    archiveDate,
    timeSlots,
    todayLocalISO,
    now,
    slotToMinutes,
    showSchedulingControls,
    date,
    time,
  ]);

  const displayArchiveTimeSlots = React.useMemo(() => {
    if (archiveTime && !availableArchiveTimeSlots.includes(archiveTime)) {
      return [archiveTime, ...availableArchiveTimeSlots];
    }
    return availableArchiveTimeSlots;
  }, [archiveTime, availableArchiveTimeSlots]);

  const noArchiveSlotsLeftToday =
    autoArchiveEnabled &&
    archiveDate === todayLocalISO &&
    availableArchiveTimeSlots.length === 0;

  const availableGiveawayCloseTimeSlots = React.useMemo(() => {
    if (!giveawayAutoCloseEnabled || !giveawayCloseDate) return timeSlots;

    const publishDateForGuard =
      showSchedulingControls && date ? date : todayLocalISO;
    const publishMinutes =
      showSchedulingControls && time ? slotToMinutes(time) : null;

    return timeSlots.filter((slot) => {
      const minutes = slotToMinutes(slot);

      if (giveawayCloseDate === todayLocalISO) {
        const current = new Date(now);
        const currentMinutes = current.getHours() * 60 + current.getMinutes();
        if (minutes <= currentMinutes) {
          return false;
        }
      }

      if (
        showSchedulingControls &&
        publishMinutes !== null &&
        giveawayCloseDate === publishDateForGuard
      ) {
        if (minutes <= publishMinutes) {
          return false;
        }
      }

      return true;
    });
  }, [
    giveawayAutoCloseEnabled,
    giveawayCloseDate,
    timeSlots,
    todayLocalISO,
    now,
    slotToMinutes,
    showSchedulingControls,
    date,
    time,
  ]);

  const availableVotingCloseTimeSlots = React.useMemo(() => {
    if (!votingAutoCloseEnabled || !votingCloseDate) return timeSlots;

    const publishDateForGuard =
      showSchedulingControls && date ? date : todayLocalISO;
    const publishMinutes =
      showSchedulingControls && time ? slotToMinutes(time) : null;

    return timeSlots.filter((slot) => {
      const minutes = slotToMinutes(slot);

      if (votingCloseDate === todayLocalISO) {
        const current = new Date(now);
        const currentMinutes = current.getHours() * 60 + current.getMinutes();
        if (minutes <= currentMinutes) {
          return false;
        }
      }

      if (
        showSchedulingControls &&
        publishMinutes !== null &&
        votingCloseDate === publishDateForGuard
      ) {
        if (minutes <= publishMinutes) {
          return false;
        }
      }

      return true;
    });
  }, [
    votingAutoCloseEnabled,
    votingCloseDate,
    timeSlots,
    todayLocalISO,
    now,
    slotToMinutes,
    showSchedulingControls,
    date,
    time,
  ]);

  const displayGiveawayCloseTimeSlots = React.useMemo(() => {
    if (
      giveawayCloseTime &&
      !availableGiveawayCloseTimeSlots.includes(giveawayCloseTime)
    ) {
      return [giveawayCloseTime, ...availableGiveawayCloseTimeSlots];
    }
    return availableGiveawayCloseTimeSlots;
  }, [giveawayCloseTime, availableGiveawayCloseTimeSlots]);

  const displayVotingCloseTimeSlots = React.useMemo(() => {
    if (
      votingCloseTime &&
      !availableVotingCloseTimeSlots.includes(votingCloseTime)
    ) {
      return [votingCloseTime, ...availableVotingCloseTimeSlots];
    }
    return availableVotingCloseTimeSlots;
  }, [votingCloseTime, availableVotingCloseTimeSlots]);

  const noGiveawayCloseSlotsLeftToday =
    giveawayAutoCloseEnabled &&
    giveawayCloseDate === todayLocalISO &&
    availableGiveawayCloseTimeSlots.length === 0;

  const noVotingCloseSlotsLeftToday =
    votingAutoCloseEnabled &&
    votingCloseDate === todayLocalISO &&
    availableVotingCloseTimeSlots.length === 0;

  React.useEffect(() => {
    if (
      !giveawayAutoCloseEnabled ||
      !giveawayCloseTime ||
      giveawayCloseDate !== todayLocalISO
    ) {
      return;
    }
    const current = new Date(now);
    const currentMinutes = current.getHours() * 60 + current.getMinutes();
    if (slotToMinutes(giveawayCloseTime) <= currentMinutes) {
      setGiveawayCloseTime('');
    }
  }, [
    giveawayAutoCloseEnabled,
    giveawayCloseTime,
    giveawayCloseDate,
    todayLocalISO,
    now,
    slotToMinutes,
  ]);

  React.useEffect(() => {
    if (
      !votingAutoCloseEnabled ||
      !votingCloseTime ||
      votingCloseDate !== todayLocalISO
    ) {
      return;
    }
    const current = new Date(now);
    const currentMinutes = current.getHours() * 60 + current.getMinutes();
    if (slotToMinutes(votingCloseTime) <= currentMinutes) {
      setVotingCloseTime('');
    }
  }, [
    votingAutoCloseEnabled,
    votingCloseTime,
    votingCloseDate,
    todayLocalISO,
    now,
    slotToMinutes,
  ]);

  React.useEffect(() => {
    if (!autoArchiveEnabled || !archiveTime || archiveDate !== todayLocalISO) {
      return;
    }
    const current = new Date(now);
    const currentMinutes = current.getHours() * 60 + current.getMinutes();
    if (slotToMinutes(archiveTime) <= currentMinutes) {
      setArchiveTime('');
    }
  }, [
    autoArchiveEnabled,
    archiveTime,
    archiveDate,
    todayLocalISO,
    now,
    slotToMinutes,
  ]);

  const noSlotsLeftToday =
    showSchedulingControls &&
    date === todayLocalISO &&
    availableTimeSlotsCore.length === 0;

  const imagePreviewUrls = useApiQuery<
    { ids: Id<'_storage'>[] },
    StorageImage[]
  >(
    api.storage.getImageUrls,
    imageIds.length ? { ids: imageIds } : 'skip',
  );

  const imagePreviewMap = React.useMemo(() => {
    const map = new Map<string, string>();
    imagePreviewUrls?.forEach((entry) => {
      map.set(entry.id, entry.url);
    });
    return map;
  }, [imagePreviewUrls]);

  const canAddMoreImages = imageIds.length < MAX_IMAGES;

  const publishStatusMessage = React.useMemo(() => {
    if (!showSchedulingControls) {
      return isEditing
        ? 'Changes will publish immediately.'
        : 'No time selected — will publish immediately.';
    }

    if (date === todayLocalISO && !time) {
      return isEditing
        ? 'No publish time selected — changes publish immediately.'
        : 'No time selected — will publish immediately.';
    }

    if (scheduledSummary) {
      return isEditing
        ? `Changes will publish on ${scheduledSummary}.`
        : `Scheduled for ${scheduledSummary}`;
    }

    if (scheduledDate) {
      return `Scheduled for ${scheduledDate} - select a publish time.`;
    }

    return isEditing
      ? 'Set a publish date or time to control when updates go live.'
      : 'Set a publish date or time to schedule this activity.';
  }, [
    showSchedulingControls,
    date,
    time,
    todayLocalISO,
    isEditing,
    scheduledSummary,
    scheduledDate,
  ]);

  return (
    <form
      className='space-y-6'
      aria-label={`${isEditing ? 'Edit' : 'Create'} ${activityLabel.toLowerCase()} form`}
      onSubmit={onSubmit}
    >
      <div
        className={`grid gap-4 ${showSchedulingControls ? 'sm:grid-cols-2' : ''}`}
      >
        <label className='flex flex-col gap-2 text-sm text-foreground'>
          Title
          <input
            type='text'
            name='title'
            placeholder={
              isPoll
                ? 'Poll question...' :
              isVoting
                ? 'Voting Event Title...'
              : isForm
                ? 'Form title...'
              : isFundraiser
                ? 'Fundraiser title...'
              : isGiveaway
                ? 'Giveaway title...'
                : 'Announcement Title...'
            }
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={isPoll ? 100 : undefined}
            className='rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
          />
        </label>

        <SchedulingSection
          showSchedulingControls={showSchedulingControls}
          date={date}
          time={time}
          todayLocalISO={todayLocalISO}
          displayTimeSlots={displayTimeSlots}
          noSlotsLeftToday={noSlotsLeftToday}
          onDateChange={handlePublishDateChange}
          onTimeChange={handlePublishTimeChange}
        />
      </div>

      {!isVoting && (
        <ImageUploadSection
          imageIds={imageIds}
          canAddMore={canAddMoreImages}
          uploadingImages={uploadingImages}
          maxImages={MAX_IMAGES}
          imagePreviewMap={imagePreviewMap}
          onFileSelect={handleImageUpload}
          onRemoveImage={handleRemoveImage}
        />
      )}

      <label className='flex flex-col gap-2 text-sm text-foreground'>
        Description
        <textarea
          name='description'
          rows={4}
          placeholder='Details...'
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required={!isPoll && !isVoting}
          className='rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
        />
      </label>

      <FormBuilderSection
        isForm={isForm}
        questions={formQuestions}
        setQuestions={setFormQuestions}
      />

      <FormSettingsSection
        isForm={isForm}
        submissionLimit={formSubmissionLimit}
        onChangeSubmissionLimit={setFormSubmissionLimit}
        paymentEnabled={formPaymentEnabled}
        onTogglePayment={setFormPaymentEnabled}
        price={formPrice}
        onChangePrice={setFormPrice}
        allowAnonymousChoice={formAllowAnonymousChoice}
        forceAnonymous={formForceAnonymous}
        onToggleAllowAnonymousChoice={handleToggleFormAllowAnonymousChoice}
        onToggleForceAnonymous={handleToggleFormForceAnonymous}
      />

      <FundraiserSettingsSection
        isFundraiser={isFundraiser}
        goal={fundraiserGoal}
        onChangeGoal={setFundraiserGoal}
        anonymityMode={fundraiserAnonymityMode}
        onChangeAnonymityMode={setFundraiserAnonymityMode}
      />

      <GiveawaySettingsSection
        isGiveaway={isGiveaway}
        allowMultiple={giveawayAllowMultipleEntries}
        entryCap={giveawayEntryCap}
        winnersCount={giveawayWinnersCount}
        entryPriceEnabled={giveawayEntryPriceEnabled}
        entryPrice={giveawayEntryPrice}
        autoCloseEnabled={giveawayAutoCloseEnabled}
        closeDate={giveawayCloseDate}
        closeTime={giveawayCloseTime}
        minCloseDate={minGiveawayCloseDate}
        displayCloseTimeSlots={displayGiveawayCloseTimeSlots}
        noCloseSlotsLeftToday={noGiveawayCloseSlotsLeftToday}
        closeSummary={giveawayCloseSummary}
        onToggleAllowMultiple={setGiveawayAllowMultipleEntries}
        onChangeEntryCap={setGiveawayEntryCap}
        onChangeWinnersCount={setGiveawayWinnersCount}
        onToggleEntryPrice={setGiveawayEntryPriceEnabled}
        onChangeEntryPrice={setGiveawayEntryPrice}
        onToggleAutoClose={handleToggleGiveawayAutoClose}
        onChangeCloseDate={setGiveawayCloseDate}
        onChangeCloseTime={setGiveawayCloseTime}
      />

      <VotingSettingsSection
        isVoting={isVoting}
        addVotePrice={votingAddVotePrice}
        removeVotePrice={votingRemoveVotePrice}
        addVoteLimit={votingAddVoteLimit}
        removeVoteLimit={votingRemoveVoteLimit}
        onChangeAddPrice={setVotingAddVotePrice}
        onChangeRemovePrice={setVotingRemoveVotePrice}
        onChangeAddLimit={setVotingAddVoteLimit}
        onChangeRemoveLimit={setVotingRemoveVoteLimit}
        autoCloseEnabled={votingAutoCloseEnabled}
        closeDate={votingCloseDate}
        closeTime={votingCloseTime}
        minCloseDate={minVotingCloseDate}
        displayCloseTimeSlots={displayVotingCloseTimeSlots}
        noCloseSlotsLeftToday={noVotingCloseSlotsLeftToday}
        closeSummary={votingCloseSummary}
        onToggleAutoClose={handleToggleVotingAutoClose}
        onChangeCloseDate={setVotingCloseDate}
        onChangeCloseTime={setVotingCloseTime}
        groupSelections={votingGroupSelections}
        portfolioSelections={votingPortfolioSelections}
        allowUngrouped={votingAllowUngrouped}
        allowRemovals={votingAllowRemovals}
        lockedGroups={votingLockedGroups}
        lockedPortfolios={votingLockedPortfolios}
        lockedUngrouped={votingLockedUngrouped}
        hasLockedSelections={hasLockedVotingAssignments}
        leaderboardMode={votingLeaderboardMode}
        leaderboardOptions={LEADERBOARD_OPTIONS}
        onToggleGroup={handleToggleVotingGroup}
        onTogglePortfolio={handleToggleVotingPortfolio}
        onToggleUngrouped={handleToggleVotingUngrouped}
        onToggleAllowRemovals={handleToggleVotingAllowRemovals}
        onToggleSelectAll={handleToggleVotingSelectAll}
        onChangeLeaderboardMode={handleVotingLeaderboardModeChange}
        allSelected={votingAllSelected}
        loading={votingUsersLoading}
        error={votingUsersError}
      />

      <PollOptionsSection
        isPoll={isPoll}
        pollOptions={pollOptions}
        onChangeOption={handlePollOptionChange}
        onAddOption={handleAddPollOption}
        onRemoveOption={handleRemovePollOption}
      />

      <PollSettingsSection
        isPoll={isPoll}
        pollAnonymous={pollAnonymous}
        pollAllowAdditionalOptions={pollAllowAdditionalOptions}
        pollMaxSelections={pollMaxSelections}
        pollOptionsCount={
          pollOptions.filter((option) => option.trim().length > 0).length
        }
        pollHasClose={pollHasClose}
        pollCloseDate={pollCloseDate}
        pollCloseTime={pollCloseTime}
        minPollCloseDate={minPollCloseDate}
        displayPollCloseTimeSlots={displayPollCloseTimeSlots}
        noPollCloseSlotsLeftToday={noPollCloseSlotsLeftToday}
        onToggleAnonymous={setPollAnonymous}
        onToggleAllowAdditionalOptions={setPollAllowAdditionalOptions}
        onChangeMaxSelections={setPollMaxSelections}
        onTogglePollClose={handleTogglePollClose}
        onChangePollCloseDate={setPollCloseDate}
        onChangePollCloseTime={setPollCloseTime}
      />

      <AutomationSection
        autoDeleteEnabled={autoDeleteEnabled}
        autoArchiveEnabled={autoArchiveEnabled}
        hideAutoArchive={isGiveaway}
        deleteDate={deleteDate}
        deleteTime={deleteTime}
        archiveDate={archiveDate}
        archiveTime={archiveTime}
        minAutoDeleteDate={minAutoDeleteDate}
        minAutoArchiveDate={minAutoArchiveDate}
        displayDeleteTimeSlots={displayDeleteTimeSlots}
        displayArchiveTimeSlots={displayArchiveTimeSlots}
        noDeleteSlotsLeftToday={noDeleteSlotsLeftToday}
        noArchiveSlotsLeftToday={noArchiveSlotsLeftToday}
        autoDeleteSummary={autoDeleteSummary}
        autoArchiveSummary={autoArchiveSummary}
        onToggleAutoDelete={handleToggleAutoDelete}
        onToggleAutoArchive={handleToggleAutoArchive}
        onChangeDeleteDate={setDeleteDate}
        onChangeDeleteTime={setDeleteTime}
        onChangeArchiveDate={setArchiveDate}
        onChangeArchiveTime={setArchiveTime}
      />

      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <p className='text-xs text-muted-foreground'>{publishStatusMessage}</p>
        <div className='flex w-full flex-col gap-2 sm:w-auto sm:flex-row'>
          <button
            type='button'
            onClick={onCancel}
            disabled={submitting}
            className='inline-flex w-full items-center justify-center rounded-md border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:opacity-90 disabled:opacity-60 sm:w-auto'
          >
            Cancel
          </button>
          <button
            type='submit'
            disabled={submitting}
            className='inline-flex w-full items-center justify-center rounded-md border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60 sm:w-auto'
          >
            {submitting ? 'Saving...' : buttonLabel}
          </button>
        </div>
      </div>

      {error && (
        <div className='rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive'>
          {error}
        </div>
      )}
      {success && (
        <div className='rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-500'>
          {success}
        </div>
      )}
    </form>
  );
}
