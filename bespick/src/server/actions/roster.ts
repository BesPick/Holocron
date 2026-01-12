'use server';

import { clerkClient } from '@clerk/nextjs/server';

import { checkRole } from '@/server/auth/check-role';
import {
  type Group,
  type Portfolio,
  getPortfoliosForGroup,
  isValidGroup,
  isValidPortfolioForGroup,
} from '@/lib/org';

export type UpdateUserRoleResult = {
  success: boolean;
  role: string | null;
  group: Group | null;
  portfolio: Portfolio | null;
  message: string;
};

const normalizeRole = (role: string | null) => (role === 'admin' ? role : null);

export async function updateUserRole({
  id,
  role,
  group,
  portfolio,
}: {
  id: string;
  role: string | null;
  group?: string | null;
  portfolio?: string | null;
}): Promise<UpdateUserRoleResult> {
  if (!(await checkRole('admin'))) {
    return {
      success: false,
      role: null,
      group: null,
      portfolio: null,
      message: 'You are not authorized to perform this action.',
    };
  }

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(id);
    const existingRole = (user.publicMetadata.role as string | null) ?? null;
    const normalizedExistingRole = normalizeRole(existingRole);
    const existingGroup = (user.publicMetadata.group as Group | null) ?? null;
    const existingPortfolio =
      (user.publicMetadata.portfolio as Portfolio | null) ?? null;
    const normalizedRole = normalizeRole(role);

    const normalizedGroup =
      group === undefined
        ? existingGroup
        : typeof group === 'string' && isValidGroup(group)
          ? group
          : null;

    let normalizedPortfolio: Portfolio | null;
    if (portfolio === undefined) {
      normalizedPortfolio =
        normalizedGroup &&
        existingPortfolio &&
        isValidPortfolioForGroup(normalizedGroup, existingPortfolio)
          ? existingPortfolio
          : null;
    } else {
      normalizedPortfolio =
        typeof portfolio === 'string' &&
        normalizedGroup &&
        isValidPortfolioForGroup(normalizedGroup, portfolio)
          ? portfolio
          : null;
    }

    if (
      normalizedGroup &&
      getPortfoliosForGroup(normalizedGroup).length === 0
    ) {
      normalizedPortfolio = null;
    }

    const nextMetadata = {
      ...user.publicMetadata,
      role: normalizedRole,
      group: normalizedGroup,
      portfolio: normalizedPortfolio,
    } as Record<string, unknown>;

    const response = await client.users.updateUserMetadata(id, {
      publicMetadata: nextMetadata,
    });

    const nextRole = normalizeRole(
      (response.publicMetadata.role as string | null) ?? null,
    );
    const nextGroup = (response.publicMetadata.group as Group | null) ?? null;
    const nextPortfolio =
      (response.publicMetadata.portfolio as Portfolio | null) ?? null;

    const successMessage =
      normalizedRole !== normalizedExistingRole
        ? normalizedRole
          ? `Role updated to ${normalizedRole}.`
          : 'Role removed successfully.'
        : 'Roster updated successfully.';

    return {
      success: true,
      role: nextRole,
      group: nextGroup,
      portfolio: nextPortfolio,
      message: successMessage,
    };
  } catch (error) {
    console.error('Failed to update role', error);
    return {
      success: false,
      role: null,
      group: null,
      portfolio: null,
      message: 'Updating the role failed. Please try again.',
    };
  }
}
