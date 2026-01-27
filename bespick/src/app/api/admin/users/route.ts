import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';

import { checkRole } from '@/server/auth/check-role';
import { getMetadataOptionsConfig } from '@/server/services/site-settings';
import {
  isValidGroup,
  isValidPortfolioForGroup,
  isValidRankCategory,
  isValidRankForCategory,
  isValidTeam,
} from '@/lib/org';

export async function GET() {
  const canAccess = await checkRole([
    'admin',
    'moderator',
    'scheduler',
    'morale-member',
  ]);
  if (!canAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const client = await clerkClient();
    const metadataOptions = await getMetadataOptionsConfig();
    const groupOptions = metadataOptions.groupOptions;
    const teamOptions = metadataOptions.teamOptions;
    const users = await client.users.getUserList({ limit: 500 });
    const payload = users.data.map((user) => {
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
        isValidPortfolioForGroup(
          normalizedGroup,
          rawPortfolio,
          groupOptions,
        )
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
      return {
        userId: user.id,
        firstName: (user.firstName ?? '').trim(),
        lastName: (user.lastName ?? '').trim(),
        team: normalizedTeam,
        group: normalizedGroup,
        portfolio: normalizedPortfolio,
        rankCategory: normalizedRankCategory,
        rank: normalizedRank,
        votes: 0,
      };
    });
    return NextResponse.json({ users: payload });
  } catch (error) {
    console.error('Failed to load roster for voting events', error);
    return NextResponse.json(
      { error: 'Unable to load users right now.' },
      { status: 500 },
    );
  }
}
