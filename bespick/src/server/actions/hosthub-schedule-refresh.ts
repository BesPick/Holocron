'use server';

import { checkRole } from '@/server/auth/check-role';
import type { HostHubEventType } from '@/lib/hosthub-events';
import {
  clearScheduleAssignments,
  buildBuilding892BlockedUsers,
  getAssignmentWindowEnd,
  getEligibleDemoDayRoster,
  getEligibleSecurityShiftRoster,
  getEligibleStandupRoster,
  getBuilding892TeamRoster,
  listBuilding892AssignmentsInRange,
  listDemoDayAssignmentsInRange,
  listScheduleEventOverridesInRange,
  listSecurityShiftAssignmentsInRange,
  listStandupAssignmentsInRange,
  markScheduleRefreshComplete,
  refreshBuilding892AssignmentsForWindow,
  refreshDemoDayAssignmentsForWindow,
  refreshSecurityShiftAssignmentsForWindow,
  refreshStandupAssignmentsForWindow,
  type RefreshAssignmentsSummary,
} from '@/server/services/hosthub-schedule';
import {
  notifyHostHubScheduleChanges,
  type HostHubScheduleChange,
} from '@/server/services/mattermost-notifications';

export type RefreshScheduleAssignmentsResult = {
  success: boolean;
  message: string;
  building892?: RefreshAssignmentsSummary;
  demoDay?: RefreshAssignmentsSummary;
  standup?: RefreshAssignmentsSummary;
  securityShift?: RefreshAssignmentsSummary;
};

const formatSummary = (
  label: string,
  summary: RefreshAssignmentsSummary,
) => {
  const details = [
    `${summary.updated} updated`,
    `${summary.kept} kept`,
  ];
  return `${label}: ${details.join(', ')}.`;
};

type AssignmentSnapshot = Map<
  string,
  { eventType: HostHubEventType; dateKey: string; userId: string | null }
>;

const getAssignmentRange = (date: Date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = getAssignmentWindowEnd(date);
  return { start, end };
};

const buildAssignmentSnapshot = async (
  startDate: Date,
  endDate: Date,
): Promise<AssignmentSnapshot> => {
  const [demoAssignments, standupAssignments, securityAssignments] =
    await Promise.all([
      listDemoDayAssignmentsInRange({ startDate, endDate }),
      listStandupAssignmentsInRange({ startDate, endDate }),
      listSecurityShiftAssignmentsInRange({ startDate, endDate }),
    ]);
  const snapshot: AssignmentSnapshot = new Map();
  demoAssignments.forEach((entry) => {
    snapshot.set(`demo:${entry.date}`, {
      eventType: 'demo',
      dateKey: entry.date,
      userId: entry.userId ?? null,
    });
  });
  standupAssignments.forEach((entry) => {
    snapshot.set(`standup:${entry.date}`, {
      eventType: 'standup',
      dateKey: entry.date,
      userId: entry.userId ?? null,
    });
  });
  securityAssignments.forEach((entry) => {
    snapshot.set(`${entry.eventType}:${entry.date}`, {
      eventType: entry.eventType,
      dateKey: entry.date,
      userId: entry.userId ?? null,
    });
  });
  return snapshot;
};

const diffSnapshots = (
  before: AssignmentSnapshot,
  after: AssignmentSnapshot,
): HostHubScheduleChange[] => {
  const changes: HostHubScheduleChange[] = [];
  const keys = new Set([...before.keys(), ...after.keys()]);
  keys.forEach((key) => {
    const previous = before.get(key);
    const next = after.get(key);
    if (!previous && !next) return;
    const oldUserId = previous?.userId ?? null;
    const newUserId = next?.userId ?? null;
    if (oldUserId === newUserId) return;
    const eventType =
      (next?.eventType ?? previous?.eventType) as HostHubEventType | undefined;
    const dateKey = next?.dateKey ?? previous?.dateKey ?? '';
    if (!eventType || !dateKey) return;
    changes.push({
      eventType,
      dateKey,
      oldUserId,
      newUserId,
    });
  });
  return changes;
};

export async function refreshScheduleAssignments(): Promise<RefreshScheduleAssignmentsResult> {
  if (!(await checkRole(['admin', 'moderator', 'scheduler']))) {
    return {
      success: false,
      message: 'You are not authorized to perform this action.',
    };
  }

  try {
    const baseDate = new Date();
    const { start, end } = getAssignmentRange(baseDate);
    const beforeSnapshot = await buildAssignmentSnapshot(start, end);
    const demoRoster = await getEligibleDemoDayRoster();
    const standupRoster = await getEligibleStandupRoster();
    const securityRoster = await getEligibleSecurityShiftRoster();
    const building892Roster = await getBuilding892TeamRoster();
    const building892 = await refreshBuilding892AssignmentsForWindow({
      baseDate,
      eligibleTeams: building892Roster.eligibleTeams,
    });
    const overridesStart = new Date(start);
    overridesStart.setDate(overridesStart.getDate() - 7);
    const overrides = await listScheduleEventOverridesInRange({
      startDate: overridesStart,
      endDate: end,
    });
    const building892Overrides = new Map(
      overrides
        .filter((override) => override.eventType === 'building-892')
        .map((override) => [override.date, override]),
    );
    const building892Rows = await listBuilding892AssignmentsInRange({
      startDate: start,
      endDate: end,
    });
    const building892Assignments = Object.fromEntries(
      building892Rows.map((row) => [row.weekStart, row]),
    );
    const blockedUsersByWeek = buildBuilding892BlockedUsers({
      assignments: building892Assignments,
      teamMembers: building892Roster.teamMembers,
      overrides: building892Overrides,
    });
    const demoDay = await refreshDemoDayAssignmentsForWindow({
      baseDate,
      eligibleUsers: demoRoster,
      blockedUsersByWeek,
    });
    const standup = await refreshStandupAssignmentsForWindow({
      baseDate,
      eligibleUsers: standupRoster,
      blockedUsersByWeek,
    });
    const securityShift = await refreshSecurityShiftAssignmentsForWindow({
      baseDate,
      eligibleUsers: securityRoster,
      blockedUsersByWeek,
    });
    await markScheduleRefreshComplete();
    const afterSnapshot = await buildAssignmentSnapshot(start, end);
    const changes = diffSnapshots(beforeSnapshot, afterSnapshot);
    try {
      await notifyHostHubScheduleChanges(changes);
    } catch (error) {
      console.error('Failed to notify HostHub schedule changes', error);
    }
    const message = [
      'Assignments refreshed.',
      formatSummary('892 Manning', building892),
      formatSummary('Demo Day', demoDay),
      formatSummary('Standup', standup),
      formatSummary('Security Shift', securityShift),
    ].join(' ');
    return {
      success: true,
      message,
      building892,
      demoDay,
      standup,
      securityShift,
    };
  } catch (error) {
    console.error('Failed to refresh schedule assignments', error);
    return {
      success: false,
      message: 'Refreshing assignments failed. Please try again.',
    };
  }
}

export async function resetScheduleAssignments(): Promise<RefreshScheduleAssignmentsResult> {
  if (!(await checkRole(['admin', 'moderator', 'scheduler']))) {
    return {
      success: false,
      message: 'You are not authorized to perform this action.',
    };
  }

  try {
    const baseDate = new Date();
    const { start, end } = getAssignmentRange(baseDate);
    const beforeSnapshot = await buildAssignmentSnapshot(start, end);
    await clearScheduleAssignments();
    const demoRoster = await getEligibleDemoDayRoster();
    const standupRoster = await getEligibleStandupRoster();
    const securityRoster = await getEligibleSecurityShiftRoster();
    const building892Roster = await getBuilding892TeamRoster();
    const building892 = await refreshBuilding892AssignmentsForWindow({
      baseDate,
      eligibleTeams: building892Roster.eligibleTeams,
    });
    const overridesStart = new Date(start);
    overridesStart.setDate(overridesStart.getDate() - 7);
    const overrides = await listScheduleEventOverridesInRange({
      startDate: overridesStart,
      endDate: end,
    });
    const building892Overrides = new Map(
      overrides
        .filter((override) => override.eventType === 'building-892')
        .map((override) => [override.date, override]),
    );
    const building892Rows = await listBuilding892AssignmentsInRange({
      startDate: start,
      endDate: end,
    });
    const building892Assignments = Object.fromEntries(
      building892Rows.map((row) => [row.weekStart, row]),
    );
    const blockedUsersByWeek = buildBuilding892BlockedUsers({
      assignments: building892Assignments,
      teamMembers: building892Roster.teamMembers,
      overrides: building892Overrides,
    });
    const demoDay = await refreshDemoDayAssignmentsForWindow({
      baseDate,
      eligibleUsers: demoRoster,
      blockedUsersByWeek,
    });
    const standup = await refreshStandupAssignmentsForWindow({
      baseDate,
      eligibleUsers: standupRoster,
      blockedUsersByWeek,
    });
    const securityShift = await refreshSecurityShiftAssignmentsForWindow({
      baseDate,
      eligibleUsers: securityRoster,
      blockedUsersByWeek,
    });
    await markScheduleRefreshComplete();
    const afterSnapshot = await buildAssignmentSnapshot(start, end);
    const changes = diffSnapshots(beforeSnapshot, afterSnapshot);
    try {
      await notifyHostHubScheduleChanges(changes);
    } catch (error) {
      console.error('Failed to notify HostHub schedule changes', error);
    }
    const message = [
      'Schedule reset and regenerated.',
      formatSummary('892 Manning', building892),
      formatSummary('Demo Day', demoDay),
      formatSummary('Standup', standup),
      formatSummary('Security Shift', securityShift),
    ].join(' ');
    return {
      success: true,
      message,
      building892,
      demoDay,
      standup,
      securityShift,
    };
  } catch (error) {
    console.error('Failed to reset schedule assignments', error);
    return {
      success: false,
      message: 'Resetting assignments failed. Please try again.',
    };
  }
}
