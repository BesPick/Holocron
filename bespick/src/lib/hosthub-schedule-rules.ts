import {
  ENLISTED_RANKS,
  OFFICER_RANKS,
  RANK_CATEGORY_OPTIONS,
  type EnlistedRank,
  type OfficerRank,
  type RankCategory,
} from '@/lib/org';

export type ScheduleRuleId = 'demo-day' | 'standup' | 'security-shift';

export type ScheduleRuleConfig = {
  eligibleRankCategories: RankCategory[];
  eligibleEnlistedRanks: EnlistedRank[];
  eligibleOfficerRanks: OfficerRank[];
  defaultTime: string;
};

export type Building892RuleConfig = {
  excludedTeams: string[];
};

export const SCHEDULE_RULE_IDS = [
  'demo-day',
  'standup',
  'security-shift',
] as const;

export const DEFAULT_SCHEDULE_RULES: Record<
  ScheduleRuleId,
  ScheduleRuleConfig
> = {
  'demo-day': {
    eligibleRankCategories: ['Enlisted'],
    eligibleEnlistedRanks: ['E-1', 'E-2', 'E-3', 'E-4', 'E-5'],
    eligibleOfficerRanks: [],
    defaultTime: '13:00',
  },
  standup: {
    eligibleRankCategories: ['Civilian', 'Enlisted'],
    eligibleEnlistedRanks: ['E-1', 'E-2', 'E-3', 'E-4', 'E-5'],
    eligibleOfficerRanks: [],
    defaultTime: '08:30',
  },
  'security-shift': {
    eligibleRankCategories: ['Civilian', 'Enlisted'],
    eligibleEnlistedRanks: ['E-1', 'E-2', 'E-3', 'E-4', 'E-5'],
    eligibleOfficerRanks: [],
    defaultTime: '07:00',
  },
};

export const isScheduleRuleId = (value: unknown): value is ScheduleRuleId =>
  SCHEDULE_RULE_IDS.includes(value as ScheduleRuleId);

const uniqueInOrder = <T,>(values: T[], ordered: readonly T[]) => {
  const set = new Set(values);
  return ordered.filter((entry) => set.has(entry));
};

const isValidTimeString = (value: string) => {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hours, minutes] = value.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return false;
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
};

const normalizeTime = (value: unknown, fallback: string) => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return '';
  return isValidTimeString(trimmed) ? trimmed : fallback;
};

export const normalizeScheduleRuleConfig = (
  value: unknown,
  fallback: ScheduleRuleConfig,
): ScheduleRuleConfig => {
  if (!value || typeof value !== 'object') {
    return fallback;
  }

  const record = value as Record<string, unknown>;
  const categories = Array.isArray(record.eligibleRankCategories)
    ? uniqueInOrder(
        record.eligibleRankCategories.filter(
          (entry): entry is RankCategory =>
            RANK_CATEGORY_OPTIONS.some(
              (option) => option.value === entry,
            ),
        ),
        RANK_CATEGORY_OPTIONS.map((option) => option.value),
      )
    : fallback.eligibleRankCategories;

  const enlisted = Array.isArray(record.eligibleEnlistedRanks)
    ? uniqueInOrder(
        record.eligibleEnlistedRanks.filter(
          (entry): entry is EnlistedRank =>
            ENLISTED_RANKS.includes(entry as EnlistedRank),
        ),
        ENLISTED_RANKS,
      )
    : fallback.eligibleEnlistedRanks;

  const officer = Array.isArray(record.eligibleOfficerRanks)
    ? uniqueInOrder(
        record.eligibleOfficerRanks.filter(
          (entry): entry is OfficerRank =>
            OFFICER_RANKS.includes(entry as OfficerRank),
        ),
        OFFICER_RANKS,
      )
    : fallback.eligibleOfficerRanks;

  const defaultTime = normalizeTime(
    record.defaultTime ?? fallback.defaultTime,
    fallback.defaultTime,
  );

  return {
    eligibleRankCategories: categories,
    eligibleEnlistedRanks: enlisted,
    eligibleOfficerRanks: officer,
    defaultTime,
  };
};

export const normalizeBuilding892RuleConfig = (
  value: unknown,
  fallback: Building892RuleConfig,
): Building892RuleConfig => {
  if (!value || typeof value !== 'object') {
    return fallback;
  }

  const record = value as Record<string, unknown>;
  const excludedTeams = Array.isArray(record.excludedTeams)
    ? record.excludedTeams
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    : fallback.excludedTeams;

  return {
    excludedTeams: Array.from(new Set(excludedTeams)),
  };
};
