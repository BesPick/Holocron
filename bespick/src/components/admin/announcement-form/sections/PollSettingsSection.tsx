import * as React from 'react';

interface PollSettingsSectionProps {
  isPoll: boolean;
  pollAnonymous: boolean;
  pollAllowAdditionalOptions: boolean;
  pollMaxSelections: number;
  pollOptionsCount: number;
  pollHasClose: boolean;
  pollCloseDate: string;
  pollCloseTime: string;
  minPollCloseDate: string;
  displayPollCloseTimeSlots: string[];
  noPollCloseSlotsLeftToday: boolean;
  onToggleAnonymous: (value: boolean) => void;
  onToggleAllowAdditionalOptions: (value: boolean) => void;
  onChangeMaxSelections: (value: number) => void;
  onTogglePollClose: (value: boolean) => void;
  onChangePollCloseDate: (value: string) => void;
  onChangePollCloseTime: (value: string) => void;
}

export function PollSettingsSection({
  isPoll,
  pollAnonymous,
  pollAllowAdditionalOptions,
  pollMaxSelections,
  pollOptionsCount,
  pollHasClose,
  pollCloseDate,
  pollCloseTime,
  minPollCloseDate,
  displayPollCloseTimeSlots,
  noPollCloseSlotsLeftToday,
  onToggleAnonymous,
  onToggleAllowAdditionalOptions,
  onChangeMaxSelections,
  onTogglePollClose,
  onChangePollCloseDate,
  onChangePollCloseTime,
}: PollSettingsSectionProps) {
  if (!isPoll) {
    return null;
  }

  const maxSelectable = Math.max(1, pollOptionsCount);

  return (
    <div className='space-y-3 rounded-2xl border border-border bg-card/70 p-4'>
      <p className='text-sm font-medium text-foreground'>Poll Settings</p>
      <label className='flex items-center gap-2 text-sm text-foreground'>
        <input
          type='checkbox'
          checked={pollAnonymous}
          onChange={(event) => onToggleAnonymous(event.target.checked)}
          className='h-4 w-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
        />
        Anonymous voting
      </label>
      <p className='text-xs text-muted-foreground'>
        When enabled, only admins can see the vote totals. Everyone else sees only their own selections.
      </p>

      <label className='flex items-center gap-2 text-sm text-foreground'>
        <input
          type='checkbox'
          checked={pollAllowAdditionalOptions}
          onChange={(event) => onToggleAllowAdditionalOptions(event.target.checked)}
          className='h-4 w-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
        />
        Allow additional options from users
      </label>
      <p className='text-xs text-muted-foreground'>
        If enabled, users can submit their own option when voting.
      </p>

      <label className='flex flex-col gap-2 text-sm text-foreground'>
        Number of selections
        <input
          type='number'
          min={1}
          max={maxSelectable}
          value={pollMaxSelections}
          onChange={(event) => {
            const value = Number(event.target.value);
            onChangeMaxSelections(Number.isNaN(value) ? 1 : value);
          }}
          className='rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
        />
      </label>
      <p className='text-xs text-muted-foreground'>
        Users can select up to this many options when voting.
      </p>

      <label className='flex items-center gap-2 text-sm text-foreground'>
        <input
          type='checkbox'
          checked={pollHasClose}
          onChange={(event) => onTogglePollClose(event.target.checked)}
          className='h-4 w-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
        />
        Set poll end time
      </label>
      <p className='text-xs text-muted-foreground'>
        After this time passes, the poll becomes read-only and no additional votes can be submitted.
      </p>

      {pollHasClose && (
        <div className='grid grid-cols-2 gap-4'>
          <label className='flex flex-col gap-2 text-sm text-foreground'>
            End Date
            <input
              type='date'
              value={pollCloseDate}
              min={minPollCloseDate}
              onChange={(event) => onChangePollCloseDate(event.target.value)}
              className='rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
            />
          </label>
          <label className='flex flex-col gap-2 text-sm text-foreground'>
            End Time (15 min slots)
            <select
              value={pollCloseTime}
              onChange={(event) => onChangePollCloseTime(event.target.value)}
              disabled={noPollCloseSlotsLeftToday}
              className='rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-70'
            >
              <option value=''>--</option>
              {noPollCloseSlotsLeftToday ? (
                <option value='' disabled>
                  No times remain today — pick another date
                </option>
              ) : (
                displayPollCloseTimeSlots.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
