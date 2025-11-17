export type Group =
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

export type GroupOption = {
  value: Group;
  label: string;
  portfolios: readonly Portfolio[];
};

export const GROUP_OPTIONS: readonly GroupOption[] = [
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

export function isValidGroup(value: unknown): value is Group {
  return GROUP_OPTIONS.some((option) => option.value === value);
}

export function getPortfoliosForGroup(group: Group | null | undefined) {
  if (!group) return [] as const;
  const option = GROUP_OPTIONS.find((option) => option.value === group);
  return (option?.portfolios ?? []) as readonly Portfolio[];
}

export function isValidPortfolioForGroup(
  group: Group | null | undefined,
  portfolio: unknown,
): portfolio is Portfolio {
  if (!group || typeof portfolio !== 'string') return false;
  return getPortfoliosForGroup(group).includes(portfolio as Portfolio);
}
