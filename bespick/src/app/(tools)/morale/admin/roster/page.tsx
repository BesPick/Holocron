import { clerkClient } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import { checkRole } from '@/server/auth/check-role';

import {
  ENLISTED_RANKS,
  GROUP_OPTIONS,
  OFFICER_RANKS,
  isValidGroup,
  isValidPortfolioForGroup,
  isValidRankCategory,
  isValidRankForCategory,
} from '@/lib/org';

import { SearchUsers } from './_components/SearchUsers';
import { UserRoleCard } from './_components/UserRoleCard';

const ALL_PORTFOLIOS = GROUP_OPTIONS.flatMap(
  (option) => option.portfolios,
).map((value) => value as string);
const ALL_RANKS = [...ENLISTED_RANKS, ...OFFICER_RANKS].map(
  (value) => value as string,
);
const UNASSIGNED_VALUE = 'unassigned';

export default async function AdminRosterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await checkRole('admin'))) {
    redirect('/');
  }

  const params = await searchParams;
  const getParam = (key: string) => {
    const value = params?.[key];
    if (Array.isArray(value)) {
      return value.find(Boolean)?.trim() ?? '';
    }
    return typeof value === 'string' ? value.trim() : '';
  };

  const query = getParam('search');
  const rawRole = getParam('role');
  const rawGroup = getParam('group');
  const rawPortfolio = getParam('portfolio');
  const rawRankCategory = getParam('rankCategory');
  const rawRank = getParam('rank');
  const isUnassigned = (value: string) =>
    value === UNASSIGNED_VALUE;

  const roleFilter =
    rawRole === 'admin' || rawRole === 'member' ? rawRole : '';
  const groupFilter = isValidGroup(rawGroup)
    ? rawGroup
    : isUnassigned(rawGroup)
    ? UNASSIGNED_VALUE
    : '';
  const rankCategoryFilter = isValidRankCategory(rawRankCategory)
    ? rawRankCategory
    : isUnassigned(rawRankCategory)
    ? UNASSIGNED_VALUE
    : '';
  const isKnownPortfolio = (value: string) =>
    ALL_PORTFOLIOS.includes(value);
  const isKnownRank = (value: string) => ALL_RANKS.includes(value);

  const portfolioFilter = isUnassigned(rawPortfolio)
    ? UNASSIGNED_VALUE
    : rawPortfolio &&
      (groupFilter && groupFilter !== UNASSIGNED_VALUE
        ? isValidPortfolioForGroup(groupFilter, rawPortfolio)
        : isKnownPortfolio(rawPortfolio))
    ? rawPortfolio
    : '';
  const rankFilter = isUnassigned(rawRank)
    ? UNASSIGNED_VALUE
    : rawRank &&
      (rankCategoryFilter && rankCategoryFilter !== UNASSIGNED_VALUE
        ? isValidRankForCategory(rankCategoryFilter, rawRank)
        : isKnownRank(rawRank))
    ? rawRank
    : '';
  const hasFilters = Boolean(
    query ||
      roleFilter ||
      groupFilter ||
      portfolioFilter ||
      rankCategoryFilter ||
      rankFilter,
  );

  const client = await clerkClient();

  const listOptions = query
    ? { query, limit: 100 }
    : { limit: 100 };
  const users = (await client.users.getUserList(listOptions)).data;

  const getLastName = (user: (typeof users)[number]) =>
    (user.lastName ?? '').trim();
  const getFirstName = (user: (typeof users)[number]) =>
    (user.firstName ?? '').trim();
  const getFallbackName = (user: (typeof users)[number]) =>
    (user.username ??
      user.emailAddresses[0]?.emailAddress ??
      'Unnamed') as string;

  const primaryEmail = (user: (typeof users)[number]) =>
    user.emailAddresses.find((email) => email.id === user.primaryEmailAddressId)
      ?.emailAddress ?? 'No email available';

  const normalizedUsers = users.map((user) => {
    const rawGroup = user.publicMetadata.group;
    const normalizedGroup = isValidGroup(rawGroup) ? rawGroup : null;
    const rawPortfolio = user.publicMetadata.portfolio;
    const normalizedPortfolio =
      normalizedGroup &&
      isValidPortfolioForGroup(normalizedGroup, rawPortfolio)
        ? rawPortfolio
        : null;
    const rawRankCategory = user.publicMetadata.rankCategory;
    const normalizedRankCategory = isValidRankCategory(rawRankCategory)
      ? rawRankCategory
      : null;
    const rawRank = user.publicMetadata.rank;
    const normalizedRank =
      normalizedRankCategory &&
      isValidRankForCategory(normalizedRankCategory, rawRank)
        ? rawRank
        : null;
    const rawRole = user.publicMetadata.role;
    const normalizedRole =
      rawRole === 'admin' ? 'admin' : 'member';

    return {
      user,
      normalizedGroup,
      normalizedPortfolio,
      normalizedRankCategory,
      normalizedRank,
      normalizedRole,
    };
  });

  const filteredUsers = normalizedUsers.filter((entry) => {
    if (roleFilter === 'admin' && entry.normalizedRole !== 'admin') {
      return false;
    }
    if (roleFilter === 'member' && entry.normalizedRole !== 'member') {
      return false;
    }
    if (
      groupFilter === UNASSIGNED_VALUE &&
      entry.normalizedGroup !== null
    ) {
      return false;
    }
    if (
      groupFilter &&
      groupFilter !== UNASSIGNED_VALUE &&
      entry.normalizedGroup !== groupFilter
    ) {
      return false;
    }
    if (
      portfolioFilter === UNASSIGNED_VALUE &&
      entry.normalizedPortfolio !== null
    ) {
      return false;
    }
    if (
      portfolioFilter &&
      portfolioFilter !== UNASSIGNED_VALUE &&
      entry.normalizedPortfolio !== portfolioFilter
    ) {
      return false;
    }
    if (
      rankCategoryFilter === UNASSIGNED_VALUE &&
      entry.normalizedRankCategory !== null
    ) {
      return false;
    }
    if (
      rankCategoryFilter &&
      rankCategoryFilter !== UNASSIGNED_VALUE &&
      entry.normalizedRankCategory !== rankCategoryFilter
    ) {
      return false;
    }
    if (
      rankFilter === UNASSIGNED_VALUE &&
      entry.normalizedRank !== null
    ) {
      return false;
    }
    if (
      rankFilter &&
      rankFilter !== UNASSIGNED_VALUE &&
      entry.normalizedRank !== rankFilter
    ) {
      return false;
    }
    return true;
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const lastA = getLastName(a.user);
    const lastB = getLastName(b.user);
    if (lastA && lastB) {
      const lastCompare = lastA.localeCompare(lastB, undefined, {
        sensitivity: 'base',
      });
      if (lastCompare !== 0) return lastCompare;
    } else if (lastA || lastB) {
      return lastA ? -1 : 1;
    }

    const firstA = getFirstName(a.user);
    const firstB = getFirstName(b.user);
    if (firstA && firstB) {
      const firstCompare = firstA.localeCompare(firstB, undefined, {
        sensitivity: 'base',
      });
      if (firstCompare !== 0) return firstCompare;
    } else if (firstA || firstB) {
      return firstA ? -1 : 1;
    }

    return getFallbackName(a.user).localeCompare(
      getFallbackName(b.user),
      undefined,
      {
        sensitivity: 'base',
      },
    );
  });

  const countLabel = hasFilters
    ? `Showing ${sortedUsers.length} of ${users.length} users`
    : `Showing ${sortedUsers.length} users`;

  return (
    <div className='mx-auto w-full max-w-5xl space-y-8 px-4 py-10'>
      <header className='rounded-2xl border border-border bg-card p-6 shadow-sm'>
        <h1 className='text-3xl font-semibold text-foreground'>
          Admin Dashboard
        </h1>
        <p className='mt-2 text-sm text-muted-foreground'>
          Manage user roles and assignments and other information.
        </p>
      </header>

      <section className='rounded-2xl border border-border bg-card p-6 shadow-sm backdrop-blur'>
        <SearchUsers />
      </section>

      <div className='rounded-2xl border border-border bg-card/70 px-4 py-3 text-sm text-muted-foreground shadow-sm'>
        <span className='font-semibold text-foreground'>{countLabel}</span>
      </div>

      <section className='space-y-4'>
        {sortedUsers.length === 0 ? (
          <p className='rounded-xl border border-dashed border-border bg-secondary/50 px-4 py-6 text-center text-sm text-muted-foreground'>
            {hasFilters
              ? 'No users match your current filters.'
              : 'Search for a user to view and manage their roles data.'}
          </p>
        ) : (
          sortedUsers.map((entry) => {
            const user = entry.user;
            return (
              <UserRoleCard
                key={user.id}
                user={{
                  id: user.id,
                  fullName:
                    `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() ||
                    user.username ||
                    'Unnamed User',
                  email: primaryEmail(user),
                  role: (user.publicMetadata.role as string) ?? null,
                  group: entry.normalizedGroup,
                  portfolio: entry.normalizedPortfolio,
                  rankCategory: entry.normalizedRankCategory,
                  rank: entry.normalizedRank,
                }}
              />
            );
          })
        )}
      </section>
    </div>
  );
}
