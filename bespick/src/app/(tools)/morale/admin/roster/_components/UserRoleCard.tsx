// src/app/(tools)/morale/admin/roster/_components/UserRoleCard.tsx
'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';

import {
  getPortfoliosForGroup,
  getRanksForCategory,
  isValidRankForCategory,
  type Group,
  type Portfolio,
  type Rank,
  type RankCategory,
  type Team,
  RANK_CATEGORY_OPTIONS,
} from '@/lib/org';
import { deleteRosterUser, updateUserRole } from '@/server/actions/roster';
import { useMetadataOptions } from '@/components/metadata/metadata-options-provider';

type UserRoleCardProps = {
  user: {
    id: string;
    fullName: string;
    email: string;
    imageUrl?: string | null;
    role: string | null;
    team: Team | null;
    group: Group | null;
    portfolio: Portfolio | null;
    rankCategory: RankCategory | null;
    rank: Rank | null;
  };
  canEdit?: boolean;
};

type ToastState = {
  message: string;
  variant: 'success' | 'error';
};

const normalizeRole = (role: string | null) =>
  role === 'admin' ||
  role === 'moderator' ||
  role === 'scheduler' ||
  role === 'morale-member'
    ? role
    : null;

const formatRoleLabel = (role: string | null) => {
  if (!role) return 'No role assigned';
  if (role === 'admin') return 'Admin';
  if (role === 'moderator') return 'Moderator';
  if (role === 'scheduler') return 'Scheduler';
  if (role === 'morale-member') return 'Morale Member';
  return role;
};

export function UserRoleCard({
  user,
  canEdit = true,
}: UserRoleCardProps) {
  const router = useRouter();
  const { groupOptions, teamOptions } = useMetadataOptions();
  const [currentRole, setCurrentRole] = useState<string | null>(
    normalizeRole(user.role),
  );
  const [currentTeam, setCurrentTeam] = useState<Team | null>(user.team);
  const [currentGroup, setCurrentGroup] = useState<Group | null>(user.group);
  const [currentPortfolio, setCurrentPortfolio] = useState<Portfolio | null>(
    user.portfolio,
  );
  const [currentRankCategory, setCurrentRankCategory] =
    useState<RankCategory | null>(user.rankCategory);
  const [currentRank, setCurrentRank] = useState<Rank | null>(user.rank);
  const [isAvatarOpen, setIsAvatarOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isPending, startTransition] = useTransition();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const roleLabel = formatRoleLabel(currentRole);
  const infoFields = [
    {
      label: 'Rank Category',
      value: currentRankCategory ?? 'No rank category',
    },
    {
      label: 'Rank',
      value: currentRank ?? 'No rank assigned',
    },
    {
      label: 'Portfolio',
      value: currentPortfolio ?? 'No portfolio assigned',
    },
    {
      label: 'Team',
      value: currentTeam ?? 'No team assigned',
    },
    {
      label: 'Group',
      value: currentGroup ?? 'No group assigned',
    },
  ];

  const initials = user.fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((value) => value[0]?.toUpperCase())
    .join('');

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
    team,
  }: {
    role?: string | null;
    group?: Group | null;
    portfolio?: Portfolio | null;
    rankCategory?: RankCategory | null;
    rank?: Rank | null;
    team?: Team | null;
  }) => {
    if (!canEdit) {
      return;
    }
    startTransition(async () => {
      const payload = {
        id: user.id,
        role: role === undefined ? currentRole ?? null : role,
        team: team === undefined ? currentTeam : team,
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
        setCurrentTeam(result.team);
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
      ? getPortfoliosForGroup(nextGroup, groupOptions)
      : [];
    const nextPortfolio =
      nextGroup &&
      currentPortfolio &&
      availablePortfolios.includes(currentPortfolio)
        ? currentPortfolio
        : null;
    submitUpdate({ group: nextGroup, portfolio: nextPortfolio });
  };

  const handleTeamChange = (value: string) => {
    const nextTeam = value ? (value as Team) : null;
    submitUpdate({ team: nextTeam });
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
    if (!canEdit) {
      return;
    }
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
    ? getPortfoliosForGroup(currentGroup, groupOptions)
    : [];
  const portfolioSelectDisabled =
    !currentGroup ||
    availablePortfolios.length === 0 ||
    isPending ||
    !canEdit;
  const availableRanks = currentRankCategory
    ? getRanksForCategory(currentRankCategory)
    : [];
  const rankSelectDisabled =
    !currentRankCategory ||
    availableRanks.length === 0 ||
    isPending ||
    !canEdit;

  const buttonClasses =
    'inline-flex items-center justify-center rounded-md border border-border bg-secondary px-4 py-2 text-sm font-medium transition hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <>
      <article className='rounded-xl border border-border bg-card p-6 shadow-sm backdrop-blur'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex items-center gap-4'>
            <button
              type='button'
              onClick={() => {
                if (user.imageUrl) {
                  setIsAvatarOpen(true);
                }
              }}
              className='group relative h-12 w-12 overflow-hidden rounded-full border border-border bg-secondary/60 shadow-sm transition hover:border-primary/60'
              aria-label={`Open ${user.fullName} profile photo`}
            >
              {user.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt={user.fullName}
                  className='h-full w-full object-cover'
                />
              ) : (
                <span className='flex h-full w-full items-center justify-center text-xs font-semibold text-muted-foreground'>
                  {initials || '—'}
                </span>
              )}
              <span className='absolute inset-0 bg-black/0 transition group-hover:bg-black/10' />
            </button>
            <div>
              <h2 className='text-lg font-semibold text-foreground'>
                {user.fullName}
              </h2>
              <p className='wrap-break-word text-sm text-muted-foreground'>
                {user.email}
              </p>
            </div>
          </div>
          <div className='rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary'>
            {roleLabel}
          </div>
        </div>

        <div className='mt-5 flex flex-wrap gap-3'>
          {canEdit ? (
            <>
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
                onClick={() => handleRoleChange('moderator')}
                className={`${buttonClasses} text-foreground`}
                disabled={isPending || currentRole === 'moderator'}
              >
                {currentRole === 'moderator'
                  ? 'Already Moderator'
                  : 'Make Moderator'}
              </button>

              <button
                type='button'
                onClick={() => handleRoleChange('scheduler')}
                className={`${buttonClasses} text-foreground`}
                disabled={isPending || currentRole === 'scheduler'}
              >
                {currentRole === 'scheduler'
                  ? 'Already Scheduler'
                  : 'Make Scheduler'}
              </button>

              <button
                type='button'
                onClick={() => handleRoleChange('morale-member')}
                className={`${buttonClasses} text-foreground`}
                disabled={isPending || currentRole === 'morale-member'}
              >
                {currentRole === 'morale-member'
                  ? 'Already Morale Member'
                  : 'Make Morale Member'}
              </button>

              <button
                type='button'
                onClick={() => handleRoleChange(null)}
                className={`${buttonClasses} text-danger`}
                disabled={isPending || currentRole === null}
              >
                {currentRole === null
                  ? 'Remove Role'
                  : `Remove ${formatRoleLabel(currentRole)} Role`}
              </button>

              <button
                type='button'
                onClick={handleDeleteUser}
                className={`${buttonClasses} text-danger`}
                disabled={isPending}
              >
                Delete User
              </button>
            </>
          ) : (
            <div className='rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground'>
              Read-only access. Only admins and moderators can edit roles or assignments.
            </div>
          )}
        </div>

        <details className='mt-6 rounded-xl border border-border bg-background/60 px-4 py-3'>
          <summary className='flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-foreground'>
            <span>Info</span>
            <ChevronDown className='h-4 w-4 text-muted-foreground' aria-hidden={true} />
          </summary>

          {canEdit ? (
            <>
              <div className='mt-4 grid gap-4 sm:grid-cols-2'>
                <label className='flex flex-col gap-2 text-sm text-foreground'>
                  Rank Category
                  <select
                    value={currentRankCategory ?? ''}
                    onChange={(event) =>
                      handleRankCategoryChange(event.target.value)
                    }
                    disabled={isPending || !canEdit}
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

              <div className='mt-4 grid gap-4 sm:grid-cols-3'>
                <label className='flex flex-col gap-2 text-sm text-foreground'>
                  Group
                  <select
                    value={currentGroup ?? ''}
                    onChange={(event) => handleGroupChange(event.target.value)}
                    disabled={isPending || !canEdit}
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
                  Portfolio
                  <select
                    value={currentPortfolio ?? ''}
                    onChange={(event) =>
                      handlePortfolioChange(event.target.value)
                    }
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

                <label className='flex flex-col gap-2 text-sm text-foreground'>
                  Team
                  <select
                    value={currentTeam ?? ''}
                    onChange={(event) =>
                      handleTeamChange(event.target.value)
                    }
                    disabled={isPending || !canEdit}
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
              </div>
            </>
          ) : (
            <div className='mt-4 space-y-3'>
              <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
                Read-only fields. Editing is disabled.
              </p>
              <div className='grid gap-4 sm:grid-cols-2'>
                {infoFields.map((field) => (
                  <div key={field.label} className='flex flex-col gap-1'>
                    <span className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
                      {field.label}
                    </span>
                    <span className='text-sm font-semibold text-foreground'>
                      {field.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </details>
      </article>

      {isAvatarOpen && user.imageUrl ? (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4'
          role='dialog'
          aria-modal='true'
          onClick={() => setIsAvatarOpen(false)}
        >
          <div
            className='relative max-h-[85vh] max-w-[85vw] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl'
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={user.imageUrl}
              alt={user.fullName}
              className='h-full w-full object-contain'
            />
            <button
              type='button'
              onClick={() => setIsAvatarOpen(false)}
              className='absolute right-3 top-3 rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-semibold text-foreground shadow-sm transition hover:bg-background'
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

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
