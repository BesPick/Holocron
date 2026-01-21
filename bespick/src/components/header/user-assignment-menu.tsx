'use client';

import { UserButton } from '@clerk/nextjs';
import { BadgeCheck, Info, Layers, Users } from 'lucide-react';

type AssignmentInfoProps = {
  groupLabel: string;
  portfolioLabel: string;
  rankCategoryLabel: string;
  rankLabel: string;
  onEditGroup: () => void;
  onEditPortfolio: () => void;
  onEditRankCategory: () => void;
  onEditRank: () => void;
};

export function UserAssignmentMenu({
  groupLabel,
  portfolioLabel,
  rankCategoryLabel,
  rankLabel,
  onEditGroup,
  onEditPortfolio,
  onEditRankCategory,
  onEditRank,
}: AssignmentInfoProps) {
  return (
    <UserButton>
      <UserButton.MenuItems>
        <UserButton.Action
          label={`Rank Type: ${rankCategoryLabel}`}
          labelIcon={<BadgeCheck className='h-4 w-4' aria-hidden={true} />}
          onClick={onEditRankCategory}
        />
        <UserButton.Action
          label={`Rank: ${rankLabel}`}
          labelIcon={<BadgeCheck className='h-4 w-4' aria-hidden={true} />}
          onClick={onEditRank}
        />
        <UserButton.Action
          label={`Group: ${groupLabel}`}
          labelIcon={<Users className='h-4 w-4' aria-hidden={true} />}
          onClick={onEditGroup}
        />
        <UserButton.Action
          label={`Portfolio: ${portfolioLabel}`}
          labelIcon={<Layers className='h-4 w-4' aria-hidden={true} />}
          onClick={onEditPortfolio}
        />
        <UserButton.Action
          label='Click on the information above to update it'
          labelIcon={
            <Info
              className='h-4 w-4 text-amber-700 user-profile-note-icon'
              aria-hidden={true}
            />
          }
          onClick={() => {}}
        />
      </UserButton.MenuItems>
    </UserButton>
  );
}
