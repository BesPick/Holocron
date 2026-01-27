import { GROUP_OPTIONS, type Group, type Portfolio } from '@/lib/org';
import type { ActivityType } from '@/types/db';
import type { VotingLeaderboardMode } from './types';

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  announcements: 'Announcement',
  poll: 'Poll',
  voting: 'Voting',
  form: 'Form',
};

export const MAX_IMAGES = 5;
export const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);
export const ALLOWED_IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
]);
export const LEADERBOARD_OPTIONS: Array<{
  value: VotingLeaderboardMode;
  label: string;
  description: string;
}> = [
  {
    value: 'all',
    label: 'Single leaderboard',
    description: 'Rank everyone together regardless of group.',
  },
  {
    value: 'group',
    label: 'Per group',
    description: 'Each group gets its own leaderboard.',
  },
  {
    value: 'group_portfolio',
    label: 'Per group & portfolio',
    description:
      'Create leaderboards for every group and their individual portfolios.',
  },
];

export const GROUP_KEYS = GROUP_OPTIONS.map((option) => option.value) as Group[];
export const PORTFOLIO_KEYS = GROUP_OPTIONS.flatMap(
  (option) => option.portfolios,
) as Portfolio[];

export function initGroupSelections(
  defaultValue: boolean,
): Record<Group, boolean> {
  return GROUP_KEYS.reduce((acc, group) => {
    acc[group] = defaultValue;
    return acc;
  }, {} as Record<Group, boolean>);
}

export function initPortfolioSelections(
  defaultValue: boolean,
): Record<Portfolio, boolean> {
  return PORTFOLIO_KEYS.reduce((acc, portfolio) => {
    acc[portfolio] = defaultValue;
    return acc;
  }, {} as Record<Portfolio, boolean>);
}
