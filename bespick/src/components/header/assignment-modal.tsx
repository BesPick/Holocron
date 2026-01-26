'use client';

import {
  RANK_CATEGORY_OPTIONS,
  type Group,
  type Portfolio,
  type Rank,
  type RankCategory,
  type Team,
} from '@/lib/org';
import { useMetadataOptions } from '@/components/metadata/metadata-options-provider';

type AssignmentModalProps = {
  open: boolean;
  focus: 'group' | 'team' | 'portfolio' | 'rankCategory' | 'rank';
  rankCategory: RankCategory | '';
  rank: Rank | '';
  group: Group | '';
  team: Team | '';
  portfolio: Portfolio | '';
  availableRanks: readonly Rank[];
  availablePortfolios: readonly Portfolio[];
  rankSelectDisabled: boolean;
  portfolioSelectDisabled: boolean;
  error: string | null;
  pending: boolean;
  onClose: () => void;
  onSave: () => void;
  onChangeRankCategory: (value: string) => void;
  onChangeRank: (value: string) => void;
  onChangeGroup: (value: string) => void;
  onChangeTeam: (value: string) => void;
  onChangePortfolio: (value: string) => void;
};

export function AssignmentModal({
  open,
  focus,
  rankCategory,
  rank,
  group,
  team,
  portfolio,
  availableRanks,
  availablePortfolios,
  rankSelectDisabled,
  portfolioSelectDisabled,
  error,
  pending,
  onClose,
  onSave,
  onChangeRankCategory,
  onChangeRank,
  onChangeGroup,
  onChangeTeam,
  onChangePortfolio,
}: AssignmentModalProps) {
  const { groupOptions, teamOptions } = useMetadataOptions();
  if (!open) return null;

  return (
    <div
      className='fixed inset-0 z-60 grid place-items-center bg-black/50 p-4'
      role='dialog'
      aria-modal='true'
      aria-label='Update assignments'
      onClick={onClose}
    >
      <div
        className='w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl'
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className='text-lg font-semibold text-foreground'>
          Update assignments
        </h2>
        <p className='mt-1 text-sm text-muted-foreground'>
          Choose a rank, group, team, and portfolio for your profile.
        </p>

        <div className='mt-5 space-y-4'>
          <label className='flex flex-col gap-2 text-sm text-foreground'>
            Rank Category
            <select
              value={rankCategory}
              onChange={(event) => onChangeRankCategory(event.target.value)}
              autoFocus={focus === 'rankCategory'}
              className='rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60'
            >
              <option value=''>No rank category</option>
              {RANK_CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className='flex flex-col gap-2 text-sm text-foreground'>
            Rank
            <select
              value={rank}
              onChange={(event) => onChangeRank(event.target.value)}
              disabled={rankSelectDisabled}
              autoFocus={focus === 'rank'}
              className='rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60'
            >
              <option value=''>No rank assigned</option>
              {availableRanks.map((rankOption) => (
                <option key={rankOption} value={rankOption}>
                  {rankOption}
                </option>
              ))}
            </select>
            <span className='text-xs text-muted-foreground'>
              {rankSelectDisabled
                ? 'Select a rank category with levels to enable this field.'
                : ''}
            </span>
          </label>

          <label className='flex flex-col gap-2 text-sm text-foreground'>
            Group
            <select
              value={group}
              onChange={(event) => onChangeGroup(event.target.value)}
              autoFocus={focus === 'group'}
              className='rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60'
            >
              <option value=''>No group assigned</option>
              {groupOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className='flex flex-col gap-2 text-sm text-foreground'>
            Team
            <select
              value={team}
              onChange={(event) => onChangeTeam(event.target.value)}
              autoFocus={focus === 'team'}
              className='rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60'
            >
              <option value=''>No team assigned</option>
              {teamOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className='flex flex-col gap-2 text-sm text-foreground'>
            Portfolio
            <select
              value={portfolio}
              onChange={(event) => onChangePortfolio(event.target.value)}
              disabled={portfolioSelectDisabled}
              autoFocus={focus === 'portfolio'}
              className='rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60'
            >
              <option value=''>No portfolio assigned</option>
              {availablePortfolios.map((portfolioOption) => (
                <option key={portfolioOption} value={portfolioOption}>
                  {portfolioOption}
                </option>
              ))}
            </select>
            <span className='text-xs text-muted-foreground'>
              {portfolioSelectDisabled
                ? 'Select a group with portfolios to enable this field.'
                : ''}
            </span>
          </label>
        </div>

        {error ? (
          <p className='mt-4 text-sm text-destructive'>{error}</p>
        ) : null}

        <div className='mt-6 flex items-center justify-end gap-3'>
          <button
            type='button'
            onClick={onClose}
            className='rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
            disabled={pending}
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={onSave}
            className='rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60'
            disabled={pending}
          >
            {pending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
