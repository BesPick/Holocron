export type Group =
  | 'C-Suite'
  | 'Security'
  | 'SBO'
  | 'Stan/Eval'
  | 'Products'
  | 'Enterprise';

export type Portfolio =
  | 'Spec Ops'
  | 'Support'
  | 'Logistics'
  | 'MOSS'
  | 'Atlas'
  | 'Forge';

export type RankCategory = 'Civilian' | 'Enlisted' | 'Officer';

export type EnlistedRank =
  | 'E-1'
  | 'E-2'
  | 'E-3'
  | 'E-4'
  | 'E-5'
  | 'E-6'
  | 'E-7'
  | 'E-8'
  | 'E-9';

export type OfficerRank =
  | 'O-1'
  | 'O-2'
  | 'O-3'
  | 'O-4'
  | 'O-5'
  | 'O-6'
  | 'O-7'
  | 'O-8'
  | 'O-9'
  | 'O-10';

export type Rank = EnlistedRank | OfficerRank;

export type GroupOption = {
  value: Group;
  label: string;
  portfolios: readonly Portfolio[];
};

export type RankCategoryOption = {
  value: RankCategory;
  label: string;
};

export const GROUP_OPTIONS: readonly GroupOption[] = [
  { value: 'C-Suite', label: 'C-Suite', portfolios: [] },
  { value: 'Security', label: 'Security', portfolios: [] },
  { value: 'SBO', label: 'SBO', portfolios: [] },
  {
    value: 'Products',
    label: 'Products',
    portfolios: ['Spec Ops', 'Support', 'Logistics', 'MOSS'],
  },
  {
    value: 'Enterprise',
    label: 'Enterprise',
    portfolios: ['Atlas', 'Forge'],
  },
  { value: 'Stan/Eval', label: 'Stan/Eval', portfolios: [] },
] as const;

export const RANK_CATEGORY_OPTIONS: readonly RankCategoryOption[] = [
  { value: 'Civilian', label: 'Civilian' },
  { value: 'Enlisted', label: 'Enlisted' },
  { value: 'Officer', label: 'Officer' },
] as const;

export const ENLISTED_RANKS: readonly EnlistedRank[] = [
  'E-1',
  'E-2',
  'E-3',
  'E-4',
  'E-5',
  'E-6',
  'E-7',
  'E-8',
  'E-9',
] as const;

export const OFFICER_RANKS: readonly OfficerRank[] = [
  'O-1',
  'O-2',
  'O-3',
  'O-4',
  'O-5',
  'O-6',
  'O-7',
  'O-8',
  'O-9',
  'O-10',
] as const;

export function isValidGroup(value: unknown): value is Group {
  return GROUP_OPTIONS.some((option) => option.value === value);
}

export function isValidRankCategory(value: unknown): value is RankCategory {
  return RANK_CATEGORY_OPTIONS.some((option) => option.value === value);
}

export function getPortfoliosForGroup(group: Group | null | undefined) {
  if (!group) return [] as const;
  const option = GROUP_OPTIONS.find((option) => option.value === group);
  return (option?.portfolios ?? []) as readonly Portfolio[];
}

export function getRanksForCategory(
  category: RankCategory | null | undefined,
): readonly Rank[] {
  if (category === 'Enlisted') return ENLISTED_RANKS;
  if (category === 'Officer') return OFFICER_RANKS;
  return [];
}

export function isValidPortfolioForGroup(
  group: Group | null | undefined,
  portfolio: unknown,
): portfolio is Portfolio {
  if (!group || typeof portfolio !== 'string') return false;
  return getPortfoliosForGroup(group).includes(portfolio as Portfolio);
}

export function isValidRankForCategory(
  category: RankCategory | null | undefined,
  rank: unknown,
): rank is Rank {
  if (!category || typeof rank !== 'string') return false;
  return getRanksForCategory(category).includes(rank as Rank);
}
