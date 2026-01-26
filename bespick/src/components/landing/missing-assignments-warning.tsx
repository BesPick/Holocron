'use client';

import { AlertTriangle } from 'lucide-react';
import { useUser } from '@clerk/nextjs';

import {
  isValidGroup,
  isValidRankCategory,
  isValidTeam,
} from '@/lib/org';
import { useMetadataOptions } from '@/components/metadata/metadata-options-provider';
import {
  requestAssignmentModalOpen,
  type AssignmentModalFocus,
} from '@/lib/assignment-modal-events';

type MissingAssignmentsWarningProps = {
  enabled?: boolean;
};

export function MissingAssignmentsWarning({
  enabled = true,
}: MissingAssignmentsWarningProps) {
  const { user, isLoaded, isSignedIn } = useUser();
  const { groupOptions, teamOptions } = useMetadataOptions();

  if (!enabled) return null;
  if (!isLoaded || !isSignedIn || !user) return null;

  const hasRankCategory = isValidRankCategory(
    user.publicMetadata?.rankCategory,
  );
  const groupRequired = groupOptions.length > 0;
  const teamRequired = teamOptions.length > 0;
  const hasGroup =
    !groupRequired ||
    isValidGroup(user.publicMetadata?.group, groupOptions);
  const hasTeam =
    !teamRequired || isValidTeam(user.publicMetadata?.team, teamOptions);

  if (hasRankCategory && hasGroup && hasTeam) return null;

  const missingParts: string[] = [];
  if (!hasRankCategory) missingParts.push('rank category');
  if (groupRequired && !hasGroup) missingParts.push('group');
  if (teamRequired && !hasTeam) missingParts.push('team');

  const missingLabel =
    missingParts.length === 1
      ? missingParts[0]
      : missingParts.length === 2
        ? `${missingParts[0]} and ${missingParts[1]}`
        : `${missingParts.slice(0, -1).join(', ')} and ${
            missingParts[missingParts.length - 1]
          }`;

  let focus: AssignmentModalFocus = 'group';
  if (!hasRankCategory) {
    focus = 'rankCategory';
  } else if (groupRequired && !hasGroup) {
    focus = 'group';
  } else if (teamRequired && !hasTeam) {
    focus = 'team';
  }

  const handleUpdate = () => {
    requestAssignmentModalOpen({ focus });
  };

  return (
    <div className='rounded-2xl border border-amber-500/60 bg-[#483418] px-6 py-4 text-sm text-amber-100 shadow-sm'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex items-start gap-3'>
          <AlertTriangle
            className='mt-0.5 h-5 w-5 text-amber-200'
            aria-hidden={true}
          />
          <div>
            <p className='text-xs font-semibold uppercase tracking-[0.2em] text-amber-200'>
              Action needed
            </p>
            <p className='mt-1 text-sm font-medium text-amber-100'>
              Your profile is missing {missingLabel}. Please update it so that Holocron can
              match you to schedules and rosters.
            </p>
          </div>
        </div>
        <button
          type='button'
          onClick={handleUpdate}
          className='inline-flex items-center justify-center rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-amber-950 shadow-sm transition hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background'
        >
          Update Profile
        </button>
      </div>
    </div>
  );
}
