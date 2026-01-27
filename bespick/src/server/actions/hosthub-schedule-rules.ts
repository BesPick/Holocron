'use server';

import { auth } from '@clerk/nextjs/server';

import { checkRole } from '@/server/auth/check-role';
import {
  isScheduleRuleId,
  normalizeScheduleRuleConfig,
  type ScheduleRuleConfig,
  type ScheduleRuleId,
} from '@/lib/hosthub-schedule-rules';
import {
  clearFutureAssignmentsForRule,
  getScheduleRuleConfig,
  markScheduleRefreshPending,
  saveScheduleRuleConfig,
} from '@/server/services/hosthub-schedule';

export type UpdateScheduleRuleResult = {
  success: boolean;
  message: string;
  config: ScheduleRuleConfig | null;
};

export async function updateScheduleRule({
  ruleId,
  eligibleRankCategories,
  eligibleEnlistedRanks,
  eligibleOfficerRanks,
  defaultTime,
}: {
  ruleId: ScheduleRuleId;
  eligibleRankCategories: string[];
  eligibleEnlistedRanks: string[];
  eligibleOfficerRanks: string[];
  defaultTime: string;
}): Promise<UpdateScheduleRuleResult> {
  if (!(await checkRole(['admin', 'moderator', 'scheduler']))) {
    return {
      success: false,
      message: 'You are not authorized to perform this action.',
      config: null,
    };
  }

  if (!isScheduleRuleId(ruleId)) {
    return {
      success: false,
      message: 'Invalid schedule rule selection.',
      config: null,
    };
  }

  try {
    const existing = await getScheduleRuleConfig(ruleId);
    const normalized = normalizeScheduleRuleConfig(
      {
        eligibleRankCategories,
        eligibleEnlistedRanks,
        eligibleOfficerRanks,
        defaultTime,
      },
      existing,
    );
    const { userId } = await auth();
    const updated = await saveScheduleRuleConfig({
      ruleId,
      config: normalized,
      updatedBy: userId ?? null,
    });
    await clearFutureAssignmentsForRule(ruleId);
    await markScheduleRefreshPending();

    return {
      success: true,
      message: 'Eligibility updated successfully.',
      config: updated,
    };
  } catch (error) {
    console.error('Failed to update schedule rules', error);
    return {
      success: false,
      message: 'Updating schedule rules failed. Please try again.',
      config: null,
    };
  }
}
