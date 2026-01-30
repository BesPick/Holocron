import { clerkClient } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import { checkRole } from '@/server/auth/check-role';

import {
  ENLISTED_RANKS,
  OFFICER_RANKS,
  isValidGroup,
  isValidPortfolioForGroup,
  isValidRankCategory,
  isValidRankForCategory,
  isValidTeam,
} from '@/lib/org';
import { getMetadataOptionsConfig } from '@/server/services/site-settings';

import { SearchUsers } from './_components/SearchUsers';
import { UserRoleCard } from './_components/UserRoleCard';

const ALL_RANKS = [...ENLISTED_RANKS, ...OFFICER_RANKS].map(
  (value) => value as string,
);
const UNASSIGNED_VALUE = 'unassigned';

const escapeCsvValue = (value: string) => {
  const escaped = value.replace(/"/g, '""');
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
};

const buildCsv = (rows: string[][]) =>
  rows.map((row) => row.map(escapeCsvValue).join(',')).join('\n');

export default async function AdminRosterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const canViewRoster = await checkRole([
    'admin',
    'moderator',
    'scheduler',
    'morale-member',
  ]);
  if (!canViewRoster) {
    redirect('/');
  }
  const canEditRoster = await checkRole(['admin', 'moderator']);

  const params = await searchParams;
  const metadataOptions = await getMetadataOptionsConfig();
  const groupOptions = metadataOptions.groupOptions;
  const teamOptions = metadataOptions.teamOptions;
  const allPortfolios = groupOptions.flatMap((option) =>
    option.portfolios.map((value) => value as string),
  );
  const getParam = (key: string) => {
    const value = params?.[key];
    if (Array.isArray(value)) {
      return value.find(Boolean)?.trim() ?? '';
    }
    return typeof value === 'string' ? value.trim() : '';
  };

  const query = getParam('search');
  const rawRole = getParam('role');
  const rawTeam = getParam('team');
  const rawGroup = getParam('group');
  const rawPortfolio = getParam('portfolio');
  const rawRankCategory = getParam('rankCategory');
  const rawRank = getParam('rank');
  const isUnassigned = (value: string) =>
    value === UNASSIGNED_VALUE;

  const roleFilter =
    rawRole === 'admin' ||
    rawRole === 'moderator' ||
    rawRole === 'scheduler' ||
    rawRole === 'morale-member' ||
    rawRole === 'member'
      ? rawRole
      : '';
  const teamFilter = isValidTeam(rawTeam, teamOptions)
    ? rawTeam
    : isUnassigned(rawTeam)
    ? UNASSIGNED_VALUE
    : '';
  const groupFilter = isValidGroup(rawGroup, groupOptions)
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
    allPortfolios.includes(value);
  const isKnownRank = (value: string) => ALL_RANKS.includes(value);

  const portfolioFilter = isUnassigned(rawPortfolio)
    ? UNASSIGNED_VALUE
    : rawPortfolio &&
      (groupFilter && groupFilter !== UNASSIGNED_VALUE
        ? isValidPortfolioForGroup(
            groupFilter,
            rawPortfolio,
            groupOptions,
          )
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
      teamFilter ||
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
    const rawTeam = user.publicMetadata.team;
    const normalizedTeam = isValidTeam(rawTeam, teamOptions)
      ? rawTeam
      : null;
    const rawGroup = user.publicMetadata.group;
    const normalizedGroup = isValidGroup(rawGroup, groupOptions)
      ? rawGroup
      : null;
    const rawPortfolio = user.publicMetadata.portfolio;
    const normalizedPortfolio =
      normalizedGroup &&
      isValidPortfolioForGroup(normalizedGroup, rawPortfolio, groupOptions)
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
      rawRole === 'admin'
        ? 'admin'
        : rawRole === 'moderator'
        ? 'moderator'
        : rawRole === 'scheduler'
        ? 'scheduler'
        : rawRole === 'morale-member'
        ? 'morale-member'
        : 'member';

    return {
      user,
      normalizedTeam,
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
    if (
      roleFilter === 'moderator' &&
      entry.normalizedRole !== 'moderator'
    ) {
      return false;
    }
    if (
      roleFilter === 'scheduler' &&
      entry.normalizedRole !== 'scheduler'
    ) {
      return false;
    }
    if (
      roleFilter === 'morale-member' &&
      entry.normalizedRole !== 'morale-member'
    ) {
      return false;
    }
    if (roleFilter === 'member' && entry.normalizedRole !== 'member') {
      return false;
    }
    if (
      teamFilter === UNASSIGNED_VALUE &&
      entry.normalizedTeam !== null
    ) {
      return false;
    }
    if (
      teamFilter &&
      teamFilter !== UNASSIGNED_VALUE &&
      entry.normalizedTeam !== teamFilter
    ) {
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

  const rosterEntries = sortedUsers.map((entry) => {
    const user = entry.user;
    const fullName =
      `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() ||
      user.username ||
      'Unnamed User';
    return {
      id: user.id,
      fullName,
      email: primaryEmail(user),
      imageUrl: user.imageUrl ?? null,
      role: entry.normalizedRole,
      team: entry.normalizedTeam,
      group: entry.normalizedGroup,
      portfolio: entry.normalizedPortfolio,
      rankCategory: entry.normalizedRankCategory,
      rank: entry.normalizedRank,
      rawRole: (user.publicMetadata.role as string) ?? null,
    };
  });

  const csvRows = [
    [
      'Full Name',
      'Email',
      'Role',
      'Group',
      'Team',
      'Portfolio',
      'Rank Category',
      'Rank',
    ],
    ...rosterEntries.map((entry) => {
      const roleLabel =
        entry.role === 'admin'
          ? 'Admin'
          : entry.role === 'moderator'
          ? 'Moderator'
          : entry.role === 'scheduler'
          ? 'Scheduler'
          : entry.role === 'morale-member'
          ? 'Morale Member'
          : 'Member';
      return [
        entry.fullName,
        entry.email,
        roleLabel,
        entry.group ?? 'No group assigned',
        entry.team ?? 'No team assigned',
        entry.portfolio ?? 'No portfolio assigned',
        entry.rankCategory ?? 'No rank category',
        entry.rank ?? 'No rank assigned',
      ];
    }),
  ];
  const csvContent = buildCsv(csvRows);
  const csvHref = `data:text/csv;charset=utf-8,${encodeURIComponent(
    csvContent,
  )}`;

  return (
    <div className='page-shell-compact space-y-8'>
      <header className='rounded-2xl border border-border bg-card p-6 shadow-sm'>
        <h1 className='text-3xl font-semibold text-foreground'>
          {canEditRoster ? 'Admin Dashboard' : 'Roster Viewer'}
        </h1>
        <p className='mt-2 text-sm text-muted-foreground'>
          {canEditRoster
            ? 'Manage user roles and assignments and other information.'
            : 'View user roles and assignments in read-only mode.'}
        </p>
      </header>

      <section className='rounded-2xl border border-border bg-card p-6 shadow-sm backdrop-blur'>
        <SearchUsers />
      </section>

      <div className='flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/70 px-4 py-3 text-sm text-muted-foreground shadow-sm'>
        <span className='font-semibold text-foreground'>{countLabel}</span>
        <a
          className='inline-flex items-center justify-center rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
          href={csvHref}
          download='morale-roster.csv'
        >
          Download CSV
        </a>
      </div>

      <section className='space-y-4'>
        {sortedUsers.length === 0 ? (
          <p className='rounded-xl border border-dashed border-border bg-secondary/50 px-4 py-6 text-center text-sm text-muted-foreground'>
            {hasFilters
              ? 'No users match your current filters.'
              : 'Search for a user to view and manage their roles data.'}
          </p>
        ) : (
          rosterEntries.map((entry) => (
            <UserRoleCard
              key={entry.id}
              user={{
                id: entry.id,
                fullName: entry.fullName,
                email: entry.email,
                imageUrl: entry.imageUrl,
                role: entry.rawRole,
                team: entry.team,
                group: entry.group,
                portfolio: entry.portfolio,
                rankCategory: entry.rankCategory,
                rank: entry.rank,
              }}
              canEdit={canEditRoster}
            />
          ))
        )}
      </section>
    </div>
  );
}
