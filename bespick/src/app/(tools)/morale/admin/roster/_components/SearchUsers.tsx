'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  usePathname,
  useRouter,
  useSearchParams,
} from 'next/navigation';
import {
  ENLISTED_RANKS,
  OFFICER_RANKS,
  RANK_CATEGORY_OPTIONS,
  getPortfoliosForGroup,
  getRanksForCategory,
  isValidGroup,
} from '@/lib/org';
import { useMetadataOptions } from '@/components/metadata/metadata-options-provider';

const UNASSIGNED_VALUE = 'unassigned';

type FilterState = {
  searchTerm: string;
  role: string;
  team: string;
  group: string;
  portfolio: string;
  rankCategory: string;
  rank: string;
};

export const SearchUsers = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { groupOptions, teamOptions } = useMetadataOptions();
  const searchValue = searchParams.get('search') ?? '';
  const roleValue = searchParams.get('role') ?? '';
  const teamValue = searchParams.get('team') ?? '';
  const groupValue = searchParams.get('group') ?? '';
  const portfolioValue = searchParams.get('portfolio') ?? '';
  const rankCategoryValue = searchParams.get('rankCategory') ?? '';
  const rankValue = searchParams.get('rank') ?? '';

  const paramsKey = useMemo(
    () =>
      JSON.stringify([
        searchValue,
        roleValue,
        teamValue,
        groupValue,
        portfolioValue,
        rankCategoryValue,
        rankValue,
      ]),
    [
      groupValue,
      portfolioValue,
      rankCategoryValue,
      rankValue,
      roleValue,
      searchValue,
      teamValue,
    ],
  );

  const initialValues = useMemo<FilterState>(
    () => ({
      searchTerm: searchValue,
      role: roleValue,
      team: teamValue,
      group: groupValue,
      portfolio: portfolioValue,
      rankCategory: rankCategoryValue,
      rank: rankValue,
    }),
    [
      groupValue,
      portfolioValue,
      rankCategoryValue,
      rankValue,
      roleValue,
      searchValue,
      teamValue,
    ],
  );

  const [formState, setFormState] = useState(() => ({
    sourceKey: paramsKey,
    values: initialValues,
  }));

  const values =
    formState.sourceKey === paramsKey ? formState.values : initialValues;
  const updateFormValues = useCallback(
    (updates: Partial<FilterState>) => {
      setFormState((prev) => {
        const base =
          prev.sourceKey === paramsKey ? prev.values : initialValues;
        return {
          sourceKey: paramsKey,
          values: { ...base, ...updates },
        };
      });
    },
    [initialValues, paramsKey],
  );

  const {
    searchTerm,
    role,
    team,
    group,
    portfolio,
    rankCategory,
    rank,
  } = values;

  const buildQueryParams = ({
    searchTerm,
    roleValue,
    teamValue,
    groupValue,
    portfolioValue,
    rankCategoryValue,
    rankValue,
  }: {
    searchTerm: string;
    roleValue: string;
    teamValue: string;
    groupValue: string;
    portfolioValue: string;
    rankCategoryValue: string;
    rankValue: string;
  }) => {
    const params = new URLSearchParams();
    if (searchTerm.trim()) {
      params.set('search', searchTerm.trim());
    }
    if (roleValue) {
      params.set('role', roleValue);
    }
    if (teamValue) {
      params.set('team', teamValue);
    }
    if (groupValue) {
      params.set('group', groupValue);
    }
    if (portfolioValue) {
      params.set('portfolio', portfolioValue);
    }
    if (rankCategoryValue) {
      params.set('rankCategory', rankCategoryValue);
    }
    if (rankValue) {
      params.set('rank', rankValue);
    }
    return params;
  };

  const allPortfolios = useMemo<string[]>(
    () =>
      groupOptions.flatMap((option) => option.portfolios).map(
        (value) => value as string,
      ),
    [groupOptions],
  );
  const portfolioOptions = useMemo<string[]>(() => {
    if (group && isValidGroup(group, groupOptions)) {
      return getPortfoliosForGroup(group, groupOptions).map(
        (value) => value as string,
      );
    }
    return allPortfolios;
  }, [allPortfolios, group, groupOptions]);

  const allRanks = useMemo<string[]>(
    () =>
      [...ENLISTED_RANKS, ...OFFICER_RANKS].map(
        (value) => value as string,
      ),
    [],
  );
  const rankOptions = useMemo<string[]>(() => {
    if (rankCategory === 'Enlisted' || rankCategory === 'Officer') {
      return getRanksForCategory(rankCategory).map(
        (value) => value as string,
      );
    }
    if (rankCategory === 'Civilian') {
      return [];
    }
    return allRanks;
  }, [allRanks, rankCategory]);

  const resolvedPortfolio = useMemo(() => {
    if (!portfolio) return '';
    if (portfolio === UNASSIGNED_VALUE) return portfolio;
    return portfolioOptions.includes(portfolio) ? portfolio : '';
  }, [portfolio, portfolioOptions]);

  const resolvedRank = useMemo(() => {
    if (!rank) return '';
    if (rank === UNASSIGNED_VALUE) return rank;
    return rankOptions.includes(rank) ? rank : '';
  }, [rank, rankOptions]);

  const hasFilters = Boolean(
    searchTerm ||
      role ||
      team ||
      group ||
      resolvedPortfolio ||
      rankCategory ||
      resolvedRank,
  );

  const applyFilters = useCallback(
    ({
      nextRole = role,
      nextTeam = team,
      nextGroup = group,
      nextPortfolio = resolvedPortfolio,
      nextRankCategory = rankCategory,
      nextRank = resolvedRank,
      nextSearchTerm = searchValue,
    }: {
      nextRole?: string;
      nextTeam?: string;
      nextGroup?: string;
      nextPortfolio?: string;
      nextRankCategory?: string;
      nextRank?: string;
      nextSearchTerm?: string;
    }) => {
      const params = buildQueryParams({
        searchTerm: nextSearchTerm,
        roleValue: nextRole,
        teamValue: nextTeam,
        groupValue: nextGroup,
        portfolioValue: nextPortfolio,
        rankCategoryValue: nextRankCategory,
        rankValue: nextRank,
      });
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [
      group,
      pathname,
      resolvedPortfolio,
      resolvedRank,
      rankCategory,
      role,
      team,
      router,
      searchValue,
    ],
  );

  const handleRoleChange = (value: string) => {
    updateFormValues({ role: value });
    applyFilters({ nextRole: value });
  };

  const handleTeamChange = (value: string) => {
    updateFormValues({ team: value });
    applyFilters({ nextTeam: value });
  };

  const handleGroupChange = (value: string) => {
    const nextGroup = value;
    const available = nextGroup && isValidGroup(nextGroup, groupOptions)
      ? getPortfoliosForGroup(nextGroup, groupOptions).map(
          (entry) => entry as string,
        )
      : [];
    const nextPortfolio =
      nextGroup &&
      portfolio &&
      available.includes(portfolio) &&
      portfolio !== UNASSIGNED_VALUE
        ? portfolio
        : '';
    updateFormValues({ group: nextGroup, portfolio: nextPortfolio });
    applyFilters({ nextGroup, nextPortfolio });
  };

  const handlePortfolioChange = (value: string) => {
    updateFormValues({ portfolio: value });
    applyFilters({ nextPortfolio: value });
  };

  const handleRankCategoryChange = (value: string) => {
    const nextCategory = value;
    const available =
      nextCategory === 'Enlisted' || nextCategory === 'Officer'
        ? getRanksForCategory(nextCategory).map(
            (entry) => entry as string,
          )
        : [];
    const nextRank =
      nextCategory &&
      rank &&
      available.includes(rank) &&
      rank !== UNASSIGNED_VALUE
        ? rank
        : '';
    updateFormValues({ rankCategory: nextCategory, rank: nextRank });
    applyFilters({ nextRankCategory: nextCategory, nextRank });
  };

  const handleRankChange = (value: string) => {
    updateFormValues({ rank: value });
    applyFilters({ nextRank: value });
  };

  return (
    <div className='space-y-3'>
      <h2 className='text-xl font-semibold text-foreground'>Find a user</h2>
      <p className='text-sm text-muted-foreground'>
        Search or filter to view and manage user&apos;s role and data.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          applyFilters({
            nextSearchTerm: searchTerm,
            nextRole: role,
            nextTeam: team,
            nextGroup: group,
            nextPortfolio: portfolio,
            nextRankCategory: rankCategory,
            nextRank: rank,
          });
        }}
        className='space-y-4'
      >
        <div className='flex flex-col gap-3 sm:flex-row sm:items-end'>
          <label className='flex-1 text-sm text-foreground' htmlFor='search'>
            Search for users
            <input
              id='search'
              name='search'
              type='text'
              autoComplete='off'
              value={searchTerm}
              onChange={(event) =>
                updateFormValues({ searchTerm: event.target.value })
              }
              placeholder='Enter a name or email'
              className='mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
            />
          </label>
          <div className='flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center'>
            <button
              type='button'
              onClick={() => {
                updateFormValues({
                  searchTerm: '',
                  role: '',
                  team: '',
                  group: '',
                  portfolio: '',
                  rankCategory: '',
                  rank: '',
                });
                router.push(pathname);
              }}
              disabled={!hasFilters}
              className='inline-flex w-full items-center justify-center rounded-md border border-border bg-secondary/70 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-secondary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto'
            >
              Clear filters
            </button>
            <button
              type='submit'
              className='inline-flex w-full items-center justify-center rounded-md border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto'
            >
              Search
            </button>
          </div>
        </div>

        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-6'>
          <label className='text-sm text-foreground' htmlFor='role'>
            Role
            <select
              id='role'
              name='role'
              value={role}
              onChange={(event) => handleRoleChange(event.target.value)}
              className='mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
            >
              <option value=''>All roles</option>
              <option value='admin'>Admin</option>
              <option value='moderator'>Moderator</option>
              <option value='member'>Member</option>
            </select>
          </label>
          <label
            className='text-sm text-foreground'
            htmlFor='rankCategory'
          >
            Rank category
            <select
              id='rankCategory'
              name='rankCategory'
              value={rankCategory}
              onChange={(event) => handleRankCategoryChange(event.target.value)}
              className='mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
            >
              <option value=''>All categories</option>
              <option value={UNASSIGNED_VALUE}>Unassigned</option>
              {RANK_CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className='text-sm text-foreground' htmlFor='rank'>
            Rank
            <select
              id='rank'
              name='rank'
              value={resolvedRank}
              onChange={(event) => handleRankChange(event.target.value)}
              className='mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
            >
              <option value=''>All ranks</option>
              <option value={UNASSIGNED_VALUE}>Unassigned</option>
              {rankOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
                ))}
            </select>
          </label>
          <label className='text-sm text-foreground' htmlFor='group'>
            Group
            <select
              id='group'
              name='group'
              value={group}
              onChange={(event) => handleGroupChange(event.target.value)}
              className='mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
            >
              <option value=''>All groups</option>
              <option value={UNASSIGNED_VALUE}>Unassigned</option>
              {groupOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className='text-sm text-foreground' htmlFor='portfolio'>
            Portfolio
            <select
              id='portfolio'
              name='portfolio'
              value={resolvedPortfolio}
              onChange={(event) => handlePortfolioChange(event.target.value)}
              className='mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
            >
              <option value=''>All portfolios</option>
              <option value={UNASSIGNED_VALUE}>Unassigned</option>
              {portfolioOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className='text-sm text-foreground' htmlFor='team'>
            Team
            <select
              id='team'
              name='team'
              value={team}
              onChange={(event) => handleTeamChange(event.target.value)}
              className='mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
            >
              <option value=''>All teams</option>
              <option value={UNASSIGNED_VALUE}>Unassigned</option>
              {teamOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </form>
    </div>
  );
};
