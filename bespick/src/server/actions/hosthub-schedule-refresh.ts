'use server';

import { checkRole } from '@/server/auth/check-role';
import {
  clearScheduleAssignments,
  getEligibleDemoDayRoster,
  getEligibleStandupRoster,
  markScheduleRefreshComplete,
  refreshDemoDayAssignmentsForWindow,
  refreshStandupAssignmentsForWindow,
  type RefreshAssignmentsSummary,
} from '@/server/services/hosthub-schedule';

export type RefreshScheduleAssignmentsResult = {
  success: boolean;
  message: string;
  demoDay?: RefreshAssignmentsSummary;
  standup?: RefreshAssignmentsSummary;
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

export async function refreshScheduleAssignments(): Promise<RefreshScheduleAssignmentsResult> {
  if (!(await checkRole('admin'))) {
    return {
      success: false,
      message: 'You are not authorized to perform this action.',
    };
  }

  try {
    const baseDate = new Date();
    const demoRoster = await getEligibleDemoDayRoster();
    const standupRoster = await getEligibleStandupRoster();
    const demoDay = await refreshDemoDayAssignmentsForWindow({
      baseDate,
      eligibleUsers: demoRoster,
    });
    const standup = await refreshStandupAssignmentsForWindow({
      baseDate,
      eligibleUsers: standupRoster,
    });
    await markScheduleRefreshComplete();
    const message = [
      'Assignments refreshed.',
      formatSummary('Demo Day', demoDay),
      formatSummary('Standup', standup),
    ].join(' ');
    return {
      success: true,
      message,
      demoDay,
      standup,
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
  if (!(await checkRole('admin'))) {
    return {
      success: false,
      message: 'You are not authorized to perform this action.',
    };
  }

  try {
    await clearScheduleAssignments();
    const baseDate = new Date();
    const demoRoster = await getEligibleDemoDayRoster();
    const standupRoster = await getEligibleStandupRoster();
    const demoDay = await refreshDemoDayAssignmentsForWindow({
      baseDate,
      eligibleUsers: demoRoster,
    });
    const standup = await refreshStandupAssignmentsForWindow({
      baseDate,
      eligibleUsers: standupRoster,
    });
    await markScheduleRefreshComplete();
    const message = [
      'Schedule reset and regenerated.',
      formatSummary('Demo Day', demoDay),
      formatSummary('Standup', standup),
    ].join(' ');
    return {
      success: true,
      message,
      demoDay,
      standup,
    };
  } catch (error) {
    console.error('Failed to reset schedule assignments', error);
    return {
      success: false,
      message: 'Resetting assignments failed. Please try again.',
    };
  }
}
