'use client';

import type { FundraiserAnonymityMode } from '@/types/db';

type FundraiserSettingsSectionProps = {
  isFundraiser: boolean;
  goal: string;
  onChangeGoal: (value: string) => void;
  anonymityMode: FundraiserAnonymityMode;
  onChangeAnonymityMode: (value: FundraiserAnonymityMode) => void;
};

export function FundraiserSettingsSection({
  isFundraiser,
  goal,
  onChangeGoal,
  anonymityMode,
  onChangeAnonymityMode,
}: FundraiserSettingsSectionProps) {
  if (!isFundraiser) return null;

  return (
    <section className='space-y-4 rounded-2xl border border-border bg-card/60 p-5 shadow-sm'>
      <div>
        <h3 className='text-base font-semibold text-foreground'>
          Fundraiser settings
        </h3>
        <p className='text-xs text-muted-foreground'>
          Set the goal amount and how donor names should appear.
        </p>
      </div>

      <label className='flex flex-col gap-2 text-sm text-foreground'>
        Fundraiser goal amount
        <input
          type='number'
          min='1'
          step='0.01'
          value={goal}
          onChange={(event) => onChangeGoal(event.target.value)}
          placeholder='500.00'
          className='rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
        />
      </label>

      <label className='flex flex-col gap-2 text-sm text-foreground'>
        Donation anonymity
        <select
          value={anonymityMode}
          onChange={(event) =>
            onChangeAnonymityMode(event.target.value as FundraiserAnonymityMode)
          }
          className='rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
        >
          <option value='user_choice'>Let donors choose</option>
          <option value='anonymous'>Make all donations anonymous</option>
        </select>
      </label>
    </section>
  );
}
