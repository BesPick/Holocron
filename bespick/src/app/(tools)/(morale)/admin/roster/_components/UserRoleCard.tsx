// src/app/admin/roster/UserRoleCard.tsx
'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';

import {
  GROUP_OPTIONS,
  getPortfoliosForGroup,
  getRanksForCategory,
  isValidRankForCategory,
  type Group,
  type Portfolio,
  type Rank,
  type RankCategory,
  RANK_CATEGORY_OPTIONS,
} from '@/lib/org';
import { deleteRosterUser, updateUserRole } from '@/server/actions/roster';

type UserRoleCardProps = {
  user: {
    id: string;
    fullName: string;
    email: string;
    role: string | null;
    group: Group | null;
    portfolio: Portfolio | null;
    rankCategory: RankCategory | null;
    rank: Rank | null;
  };
};

type ToastState = {
  message: string;
  variant: 'success' | 'error';
};

const normalizeRole = (role: string | null) => (role === 'admin' ? role : null);

export function UserRoleCard({ user }: UserRoleCardProps) {
  const router = useRouter();
  const [currentRole, setCurrentRole] = useState<string | null>(
    normalizeRole(user.role),
  );
  const [currentGroup, setCurrentGroup] = useState<Group | null>(user.group);
  const [currentPortfolio, setCurrentPortfolio] = useState<Portfolio | null>(
    user.portfolio,
  );
  const [currentRankCategory, setCurrentRankCategory] =
    useState<RankCategory | null>(user.rankCategory);
  const [currentRank, setCurrentRank] = useState<Rank | null>(user.rank);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isPending, startTransition] = useTransition();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const roleLabel = currentRole ?? 'No role assigned';

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const showToast = (state: ToastState) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setToast(state);
    timeoutRef.current = setTimeout(() => setToast(null), 3000);
  };

  const submitUpdate = ({
    role,
    group,
    portfolio,
    rankCategory,
    rank,
  }: {
    role?: string | null;
    group?: Group | null;
    portfolio?: Portfolio | null;
    rankCategory?: RankCategory | null;
    rank?: Rank | null;
  }) => {
    startTransition(async () => {
      const payload = {
        id: user.id,
        role: role === undefined ? currentRole ?? null : role,
        group:
          group === undefined
            ? currentGroup
            : (group as Group | null),
        portfolio:
          portfolio === undefined
            ? currentPortfolio
            : (portfolio as Portfolio | null),
        rankCategory:
          rankCategory === undefined
            ? currentRankCategory
            : (rankCategory as RankCategory | null),
        rank:
          rank === undefined
            ? currentRank
            : (rank as Rank | null),
      };

      const result = await updateUserRole(payload);

      if (result.success) {
        setCurrentRole(result.role);
        setCurrentGroup(result.group);
        setCurrentPortfolio(result.portfolio);
        setCurrentRankCategory(result.rankCategory);
        setCurrentRank(result.rank);
        showToast({ message: result.message, variant: 'success' });
      } else {
        showToast({ message: result.message, variant: 'error' });
      }
    });
  };

  const handleRoleChange = (role: string | null) => {
    submitUpdate({ role });
  };

  const handleGroupChange = (value: string) => {
    const nextGroup = value ? (value as Group) : null;
    const availablePortfolios = nextGroup
      ? getPortfoliosForGroup(nextGroup)
      : [];
    const nextPortfolio =
      nextGroup &&
      currentPortfolio &&
      availablePortfolios.includes(currentPortfolio)
        ? currentPortfolio
        : null;
    submitUpdate({ group: nextGroup, portfolio: nextPortfolio });
  };

  const handlePortfolioChange = (value: string) => {
    const nextPortfolio = value ? (value as Portfolio) : null;
    submitUpdate({ portfolio: nextPortfolio });
  };

  const handleRankCategoryChange = (value: string) => {
    const nextCategory = value ? (value as RankCategory) : null;
    const nextRank =
      nextCategory &&
      currentRank &&
      isValidRankForCategory(nextCategory, currentRank)
        ? currentRank
        : null;
    submitUpdate({ rankCategory: nextCategory, rank: nextRank });
  };

  const handleRankChange = (value: string) => {
    const nextRank = value ? (value as Rank) : null;
    submitUpdate({ rank: nextRank });
  };

  const handleDeleteUser = () => {
    if (!window.confirm(`Delete ${user.fullName}? This cannot be undone.`)) {
      return;
    }

    startTransition(async () => {
      const result = await deleteRosterUser(user.id);

      if (result.success) {
        router.refresh();
      } else {
        showToast({ message: result.message, variant: 'error' });
      }
    });
  };

  const availablePortfolios = currentGroup
    ? getPortfoliosForGroup(currentGroup)
    : [];
  const portfolioSelectDisabled =
    !currentGroup || availablePortfolios.length === 0 || isPending;
  const availableRanks = currentRankCategory
    ? getRanksForCategory(currentRankCategory)
    : [];
  const rankSelectDisabled =
    !currentRankCategory ||
    availableRanks.length === 0 ||
    isPending;

  const buttonClasses =
    'inline-flex items-center justify-center rounded-md border border-border bg-secondary px-4 py-2 text-sm font-medium transition hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <>
      <article className='rounded-xl border border-border bg-card p-6 shadow-sm backdrop-blur'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <h2 className='text-lg font-semibold text-foreground'>
              {user.fullName}
            </h2>
            <p className='break-words text-sm text-muted-foreground'>{user.email}</p>
          </div>
          <div className='rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary'>
            {roleLabel}
          </div>
        </div>

        <div className='mt-5 flex flex-wrap gap-3'>
          <button
            type='button'
            onClick={() => handleRoleChange('admin')}
            className={`${buttonClasses} text-foreground`}
            disabled={isPending || currentRole === 'admin'}
          >
            {currentRole === 'admin' ? 'Already Admin' : 'Make Admin'}
          </button>

          <button
            type='button'
            onClick={() => handleRoleChange(null)}
            className={`${buttonClasses} text-danger`}
            disabled={isPending || currentRole === null}
          >
            {currentRole === null
              ? 'Remove Role'
              : 'Remove ' +
                (currentRole.charAt(0).toUpperCase() + currentRole.slice(1)) +
                ' Role'}
          </button>

          <button
            type='button'
            onClick={handleDeleteUser}
            className={`${buttonClasses} text-danger`}
            disabled={isPending}
          >
            Delete User
          </button>
        </div>

        <details className='mt-6 rounded-xl border border-border bg-background/60 px-4 py-3'>
          <summary className='flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-foreground'>
            <span>Info</span>
            <ChevronDown className='h-4 w-4 text-muted-foreground' aria-hidden={true} />
          </summary>

          <div className='mt-4 grid gap-4 sm:grid-cols-2'>
            <label className='flex flex-col gap-2 text-sm text-foreground'>
              Rank Category
              <select
                value={currentRankCategory ?? ''}
                onChange={(event) =>
                  handleRankCategoryChange(event.target.value)
                }
                disabled={isPending}
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
                value={currentRank ?? ''}
                onChange={(event) => handleRankChange(event.target.value)}
                disabled={rankSelectDisabled}
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
          </div>

          <div className='mt-4 grid gap-4 sm:grid-cols-2'>
            <label className='flex flex-col gap-2 text-sm text-foreground'>
              Group
              <select
                value={currentGroup ?? ''}
                onChange={(event) => handleGroupChange(event.target.value)}
                disabled={isPending}
                className='rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60'
              >
                <option value=''>No group assigned</option>
                {GROUP_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className='flex flex-col gap-2 text-sm text-foreground'>
              Portfolio
              <select
                value={currentPortfolio ?? ''}
                onChange={(event) => handlePortfolioChange(event.target.value)}
                disabled={portfolioSelectDisabled}
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
                {availablePortfolios.length === 0
                  ? 'Select a group with portfolios to enable this field.'
                  : ''}
              </span>
            </label>
          </div>
        </details>
      </article>

      {toast ? (
        <div className='pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center'>
          <div
            role='status'
            className={`flex max-w-md items-center gap-3 rounded-lg border border-border px-4 py-3 shadow-lg ${
              toast.variant === 'success'
                ? 'bg-primary text-primary-foreground'
                : 'bg-destructive text-destructive-foreground'
            }`}
          >
            <span className='text-sm font-medium'>{toast.message}</span>
          </div>
        </div>
      ) : null}
    </>
  );
}
