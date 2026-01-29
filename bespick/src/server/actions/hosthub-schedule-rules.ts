'use server';

import { auth } from '@clerk/nextjs/server';

import { checkRole } from '@/server/auth/check-role';
import {
  isScheduleRuleId,
  normalizeBuilding892RuleConfig,
  normalizeScheduleRuleConfig,
  type Building892RuleConfig,
  type ScheduleRuleConfig,
  type ScheduleRuleId,
} from '@/lib/hosthub-schedule-rules';
import {
  clearFutureBuilding892Assignments,
  clearFutureAssignmentsForRule,
  getScheduleRuleConfig,
  saveBuilding892RuleConfig,
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

export type UpdateBuilding892RuleResult = {
  success: boolean;
  message: string;
  config: Building892RuleConfig | null;
};

export async function updateBuilding892Rule({
  excludedTeams,
}: {
  excludedTeams: string[];
}): Promise<UpdateBuilding892RuleResult> {
  if (!(await checkRole(['admin', 'moderator', 'scheduler']))) {
    return {
      success: false,
      message: 'You are not authorized to perform this action.',
      config: null,
    };
  }

  try {
    const normalized = normalizeBuilding892RuleConfig(
      { excludedTeams },
      { excludedTeams: [] },
    );
    const { userId } = await auth();
    const updated = await saveBuilding892RuleConfig({
      config: normalized,
      updatedBy: userId ?? null,
    });
    await clearFutureBuilding892Assignments();
    await markScheduleRefreshPending();

    return {
      success: true,
      message: '892 eligibility updated successfully.',
      config: updated,
    };
  } catch (error) {
    console.error('Failed to update 892 schedule rules', error);
    return {
      success: false,
      message: 'Updating 892 eligibility failed. Please try again.',
      config: null,
    };
  }
}
