import {
  GROUP_OPTIONS,
  TEAM_OPTIONS,
  type GroupOption,
  type TeamOption,
} from '@/lib/org';

export type MetadataCustomSection = {
  id: string;
  label: string;
  options: string[];
};

export type MetadataOptionsConfig = {
  groupOptions: GroupOption[];
  teamOptions: TeamOption[];
  customSections: MetadataCustomSection[];
};

export const RESERVED_METADATA_SECTION_IDS = new Set([
  'role',
  'group',
  'portfolio',
  'rankCategory',
  'rank',
  'team',
]);

export const DEFAULT_METADATA_OPTIONS: MetadataOptionsConfig = {
  groupOptions: GROUP_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
    portfolios: [...option.portfolios],
  })),
  teamOptions: TEAM_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
  })),
  customSections: [],
};
