'use client';

import { useMemo, useEffect, useState } from 'react';
import {
  usePathname,
  useRouter,
  useSearchParams,
} from 'next/navigation';
import {
  ENLISTED_RANKS,
  GROUP_OPTIONS,
  OFFICER_RANKS,
  RANK_CATEGORY_OPTIONS,
  getPortfoliosForGroup,
  getRanksForCategory,
  isValidGroup,
} from '@/lib/org';

const UNASSIGNED_VALUE = 'unassigned';

export const SearchUsers = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchValue = searchParams.get('search') ?? '';
  const roleValue = searchParams.get('role') ?? '';
  const groupValue = searchParams.get('group') ?? '';
  const portfolioValue = searchParams.get('portfolio') ?? '';
  const rankCategoryValue = searchParams.get('rankCategory') ?? '';
  const rankValue = searchParams.get('rank') ?? '';

  const [role, setRole] = useState(roleValue);
  const [group, setGroup] = useState(groupValue);
  const [portfolio, setPortfolio] = useState(portfolioValue);
  const [rankCategory, setRankCategory] = useState(rankCategoryValue);
  const [rank, setRank] = useState(rankValue);

  useEffect(() => {
    setRole(roleValue);
    setGroup(groupValue);
    setPortfolio(portfolioValue);
    setRankCategory(rankCategoryValue);
    setRank(rankValue);
  }, [
    roleValue,
    groupValue,
    portfolioValue,
    rankCategoryValue,
    rankValue,
  ]);

  const allPortfolios = useMemo(
    () => GROUP_OPTIONS.flatMap((option) => option.portfolios),
    [],
  );
  const portfolioOptions = useMemo(() => {
    if (group && isValidGroup(group)) {
      return [...getPortfoliosForGroup(group)];
    }
    return allPortfolios;
  }, [allPortfolios, group]);

  const allRanks = useMemo(
    () => [...ENLISTED_RANKS, ...OFFICER_RANKS],
    [],
  );
  const rankOptions = useMemo(() => {
    if (rankCategory === 'Enlisted' || rankCategory === 'Officer') {
      return [...getRanksForCategory(rankCategory)];
    }
    if (rankCategory === 'Civilian') {
      return [];
    }
    return allRanks;
  }, [allRanks, rankCategory]);

  useEffect(() => {
    if (
      portfolio &&
      portfolio !== UNASSIGNED_VALUE &&
      !portfolioOptions.includes(portfolio)
    ) {
      setPortfolio('');
    }
  }, [portfolio, portfolioOptions]);

  useEffect(() => {
    if (
      rank &&
      rank !== UNASSIGNED_VALUE &&
      !rankOptions.includes(rank)
    ) {
      setRank('');
    }
  }, [rank, rankOptions]);

  return (
    <div className='space-y-3'>
      <h2 className='text-xl font-semibold text-foreground'>Find a user</h2>
      <p className='text-sm text-muted-foreground'>
        Search or filter to view and manage user&apos;s role and data.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const formData = new FormData(form);
          const queryTerm = (formData.get('search') as string) ?? '';
          const roleValue = (formData.get('role') as string) ?? '';
          const groupValue = (formData.get('group') as string) ?? '';
          const portfolioValue =
            (formData.get('portfolio') as string) ?? '';
          const rankCategoryValue =
            (formData.get('rankCategory') as string) ?? '';
          const rankValue = (formData.get('rank') as string) ?? '';
          const params = new URLSearchParams();
          if (queryTerm?.trim()) {
            params.set('search', queryTerm.trim());
          }
          if (roleValue) {
            params.set('role', roleValue);
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
          const query = params.toString();
          router.push(query ? `${pathname}?${query}` : pathname);
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
              defaultValue={searchValue}
              placeholder='Enter a name or email'
              className='mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
            />
          </label>
          <button
            type='submit'
            className='inline-flex w-full items-center justify-center rounded-md border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto'
          >
            Search
          </button>
        </div>

        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-5'>
          <label className='text-sm text-foreground' htmlFor='role'>
            Role
            <select
              id='role'
              name='role'
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className='mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
            >
              <option value=''>All roles</option>
              <option value='admin'>Admin</option>
              <option value='member'>Member</option>
            </select>
          </label>
          <label className='text-sm text-foreground' htmlFor='group'>
            Group
            <select
              id='group'
              name='group'
              value={group}
              onChange={(event) => setGroup(event.target.value)}
              className='mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
            >
              <option value=''>All groups</option>
              <option value={UNASSIGNED_VALUE}>Unassigned</option>
              {GROUP_OPTIONS.map((option) => (
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
              value={portfolio}
              onChange={(event) => setPortfolio(event.target.value)}
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
          <label
            className='text-sm text-foreground'
            htmlFor='rankCategory'
          >
            Rank category
            <select
              id='rankCategory'
              name='rankCategory'
              value={rankCategory}
              onChange={(event) =>
                setRankCategory(event.target.value)
              }
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
              value={rank}
              onChange={(event) => setRank(event.target.value)}
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
        </div>
      </form>
    </div>
  );
};
