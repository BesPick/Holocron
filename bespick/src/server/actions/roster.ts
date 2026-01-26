'use server';

import { auth, clerkClient } from '@clerk/nextjs/server';

import { checkRole } from '@/server/auth/check-role';
import { getMetadataOptionsConfig } from '@/server/services/site-settings';
import {
  type Group,
  type Portfolio,
  type Rank,
  type RankCategory,
  type Team,
  getPortfoliosForGroup,
  isValidGroup,
  isValidPortfolioForGroup,
  getRanksForCategory,
  isValidRankCategory,
  isValidRankForCategory,
  isValidTeam,
} from '@/lib/org';

export type UpdateUserRoleResult = {
  success: boolean;
  role: string | null;
  team: Team | null;
  group: Group | null;
  portfolio: Portfolio | null;
  rankCategory: RankCategory | null;
  rank: Rank | null;
  message: string;
};

export type DeleteUserResult = {
  success: boolean;
  message: string;
};

const normalizeRole = (role: string | null) =>
  role === 'admin' || role === 'moderator' ? role : null;

export async function updateUserRole({
  id,
  role,
  team,
  group,
  portfolio,
  rankCategory,
  rank,
}: {
  id: string;
  role: string | null;
  team?: string | null;
  group?: string | null;
  portfolio?: string | null;
  rankCategory?: string | null;
  rank?: string | null;
}): Promise<UpdateUserRoleResult> {
  if (!(await checkRole('admin'))) {
    return {
      success: false,
      role: null,
      team: null,
      group: null,
      portfolio: null,
      rankCategory: null,
      rank: null,
      message: 'You are not authorized to perform this action.',
    };
  }

  try {
    const client = await clerkClient();
    const metadataOptions = await getMetadataOptionsConfig();
    const groupOptions = metadataOptions.groupOptions;
    const teamOptions = metadataOptions.teamOptions;
    const user = await client.users.getUser(id);
    const existingRole = (user.publicMetadata.role as string | null) ?? null;
    const normalizedExistingRole = normalizeRole(existingRole);
    const existingTeam = (user.publicMetadata.team as Team | null) ?? null;
    const existingGroup = (user.publicMetadata.group as Group | null) ?? null;
    const existingPortfolio =
      (user.publicMetadata.portfolio as Portfolio | null) ?? null;
    const existingRankCategory =
      (user.publicMetadata.rankCategory as RankCategory | null) ?? null;
    const existingRank = (user.publicMetadata.rank as Rank | null) ?? null;
    const normalizedRole = normalizeRole(role);
    const normalizedTeam =
      team === undefined
        ? isValidTeam(existingTeam, teamOptions)
          ? existingTeam
          : null
        : isValidTeam(team, teamOptions)
          ? team
          : null;

    const normalizedGroup =
      group === undefined
        ? isValidGroup(existingGroup, groupOptions)
          ? existingGroup
          : null
        : typeof group === 'string' && isValidGroup(group, groupOptions)
          ? group
          : null;

    let normalizedPortfolio: Portfolio | null;
    if (portfolio === undefined) {
      normalizedPortfolio =
        normalizedGroup &&
        existingPortfolio &&
        isValidPortfolioForGroup(
          normalizedGroup,
          existingPortfolio,
          groupOptions,
        )
          ? existingPortfolio
          : null;
    } else {
      normalizedPortfolio =
        typeof portfolio === 'string' &&
        normalizedGroup &&
        isValidPortfolioForGroup(
          normalizedGroup,
          portfolio,
          groupOptions,
        )
          ? portfolio
          : null;
    }

    if (
      normalizedGroup &&
      getPortfoliosForGroup(normalizedGroup, groupOptions).length === 0
    ) {
      normalizedPortfolio = null;
    }

    const normalizedRankCategory =
      rankCategory === undefined
        ? isValidRankCategory(existingRankCategory)
          ? existingRankCategory
          : null
        : isValidRankCategory(rankCategory)
          ? rankCategory
          : null;

    let normalizedRank: Rank | null;
    if (rank === undefined) {
      normalizedRank =
        normalizedRankCategory &&
        existingRank &&
        isValidRankForCategory(normalizedRankCategory, existingRank)
          ? existingRank
          : null;
    } else {
      normalizedRank =
        normalizedRankCategory &&
        isValidRankForCategory(normalizedRankCategory, rank)
          ? rank
          : null;
    }

    if (getRanksForCategory(normalizedRankCategory).length === 0) {
      normalizedRank = null;
    }

    const nextMetadata = {
      ...user.publicMetadata,
      role: normalizedRole,
      team: normalizedTeam,
      group: normalizedGroup,
      portfolio: normalizedPortfolio,
      rankCategory: normalizedRankCategory,
      rank: normalizedRank,
    } as Record<string, unknown>;

    const response = await client.users.updateUserMetadata(id, {
      publicMetadata: nextMetadata,
    });

    const nextRole = normalizeRole(
      (response.publicMetadata.role as string | null) ?? null,
    );
    const nextTeam = isValidTeam(response.publicMetadata.team, teamOptions)
      ? response.publicMetadata.team
      : null;
    const nextGroup = isValidGroup(
      response.publicMetadata.group,
      groupOptions,
    )
      ? response.publicMetadata.group
      : null;
    const nextPortfolio =
      nextGroup &&
      isValidPortfolioForGroup(
        nextGroup,
        response.publicMetadata.portfolio,
        groupOptions,
      )
        ? response.publicMetadata.portfolio
        : null;
    const nextRankCategory = isValidRankCategory(
      response.publicMetadata.rankCategory,
    )
      ? response.publicMetadata.rankCategory
      : null;
    const nextRank =
      nextRankCategory &&
      isValidRankForCategory(nextRankCategory, response.publicMetadata.rank)
        ? response.publicMetadata.rank
        : null;

    const successMessage =
      normalizedRole !== normalizedExistingRole
        ? normalizedRole
          ? `Role updated to ${normalizedRole}.`
          : 'Role removed successfully.'
        : 'Roster updated successfully.';

    return {
      success: true,
      role: nextRole,
      team: nextTeam,
      group: nextGroup,
      portfolio: nextPortfolio,
      rankCategory: nextRankCategory,
      rank: nextRank,
      message: successMessage,
    };
  } catch (error) {
    console.error('Failed to update role', error);
    return {
      success: false,
      role: null,
      team: null,
      group: null,
      portfolio: null,
      rankCategory: null,
      rank: null,
      message: 'Updating the role failed. Please try again.',
    };
  }
}

export async function deleteRosterUser(id: string): Promise<DeleteUserResult> {
  if (!(await checkRole('admin'))) {
    return {
      success: false,
      message: 'You are not authorized to perform this action.',
    };
  }

  const { userId } = await auth();
  if (!userId) {
    return {
      success: false,
      message: 'You must be signed in to perform this action.',
    };
  }

  if (userId === id) {
    return {
      success: false,
      message: 'You cannot delete your own account.',
    };
  }

  try {
    const client = await clerkClient();
    await client.users.deleteUser(id);
    return {
      success: true,
      message: 'User deleted successfully.',
    };
  } catch (error) {
    console.error('Failed to delete user', error);
    return {
      success: false,
      message: 'Deleting the user failed. Please try again.',
    };
  }
}
