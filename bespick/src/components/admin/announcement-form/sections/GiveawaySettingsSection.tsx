'use client';

type GiveawaySettingsSectionProps = {
  isGiveaway: boolean;
  allowMultiple: boolean;
  entryCap: string;
  winnersCount: string;
  entryPriceEnabled: boolean;
  entryPrice: string;
  autoCloseEnabled: boolean;
  closeDate: string;
  closeTime: string;
  minCloseDate: string;
  displayCloseTimeSlots: string[];
  noCloseSlotsLeftToday: boolean;
  closeSummary: string | null;
  onToggleAllowMultiple: (value: boolean) => void;
  onChangeEntryCap: (value: string) => void;
  onChangeWinnersCount: (value: string) => void;
  onToggleEntryPrice: (value: boolean) => void;
  onChangeEntryPrice: (value: string) => void;
  onToggleAutoClose: (value: boolean) => void;
  onChangeCloseDate: (value: string) => void;
  onChangeCloseTime: (value: string) => void;
};

export function GiveawaySettingsSection({
  isGiveaway,
  allowMultiple,
  entryCap,
  winnersCount,
  entryPriceEnabled,
  entryPrice,
  autoCloseEnabled,
  closeDate,
  closeTime,
  minCloseDate,
  displayCloseTimeSlots,
  noCloseSlotsLeftToday,
  closeSummary,
  onToggleAllowMultiple,
  onChangeEntryCap,
  onChangeWinnersCount,
  onToggleEntryPrice,
  onChangeEntryPrice,
  onToggleAutoClose,
  onChangeCloseDate,
  onChangeCloseTime,
}: GiveawaySettingsSectionProps) {
  if (!isGiveaway) return null;

  return (
    <section className='space-y-4 rounded-2xl border border-border bg-card/60 p-5 shadow-sm'>
      <div>
        <h3 className='text-base font-semibold text-foreground'>
          Giveaway settings
        </h3>
        <p className='text-xs text-muted-foreground'>
          Control entries, ticket limits, winners, and auto close.
        </p>
      </div>

      <div className='grid gap-4 sm:grid-cols-2'>
        <label className='flex flex-col gap-2 text-sm text-foreground'>
          Winner count
          <input
            type='number'
            min='1'
            step='1'
            value={winnersCount}
            onChange={(event) => onChangeWinnersCount(event.target.value)}
            className='rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
          />
        </label>
        <label className='flex items-center gap-3 text-sm text-foreground'>
          <input
            type='checkbox'
            checked={allowMultiple}
            onChange={(event) => onToggleAllowMultiple(event.target.checked)}
            className='h-4 w-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
          />
          Allow multiple entries per user
        </label>
      </div>

      {allowMultiple && (
        <label className='flex flex-col gap-2 text-sm text-foreground'>
          Entry cap per user (optional)
          <input
            type='number'
            min='1'
            step='1'
            value={entryCap}
            onChange={(event) => onChangeEntryCap(event.target.value)}
            placeholder='No cap'
            className='rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
          />
        </label>
      )}

      <div className='space-y-3 rounded-xl border border-border/60 bg-card/70 p-4'>
        <label className='flex items-center gap-3 text-sm font-medium text-foreground'>
          <input
            type='checkbox'
            checked={entryPriceEnabled}
            onChange={(event) => onToggleEntryPrice(event.target.checked)}
            className='h-4 w-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
          />
          Paid entry
        </label>
        <p className='text-xs text-muted-foreground'>
          Charge per ticket. Free entries use a submit button.
        </p>
        {entryPriceEnabled && (
          <label className='flex flex-col gap-2 text-sm text-foreground'>
            Entry price per ticket
            <input
              type='number'
              min='0.01'
              step='0.01'
              value={entryPrice}
              onChange={(event) => onChangeEntryPrice(event.target.value)}
              className='rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
            />
          </label>
        )}
      </div>

      <div className='space-y-3 rounded-xl border border-border/60 bg-card/70 p-4'>
        <label className='flex items-center gap-3 text-sm font-medium text-foreground'>
          <input
            type='checkbox'
            checked={autoCloseEnabled}
            onChange={(event) => onToggleAutoClose(event.target.checked)}
            className='h-4 w-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
          />
          Auto close giveaway
        </label>
        <p className='text-xs text-muted-foreground'>
          Auto close ends entries and draws winners without archiving.
        </p>

        {autoCloseEnabled && (
          <div className='grid gap-4 sm:grid-cols-2'>
            <label className='flex flex-col gap-2 text-sm text-foreground'>
              Close Date
              <input
                type='date'
                name='closeDate'
                value={closeDate}
                min={minCloseDate}
                onChange={(event) => onChangeCloseDate(event.target.value)}
                required
                className='rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
              />
            </label>

            <label className='flex flex-col gap-2 text-sm text-foreground'>
              Close Time (15 min slots)
              <select
                name='closeTime'
                value={closeTime}
                onChange={(event) => onChangeCloseTime(event.target.value)}
                required
                disabled={noCloseSlotsLeftToday}
                className='rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-70'
              >
                <option value=''>--</option>
                {noCloseSlotsLeftToday ? (
                  <option value='' disabled>
                    No close slots remain today — pick another date
                  </option>
                ) : (
                  displayCloseTimeSlots.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))
                )}
              </select>
            </label>
          </div>
        )}

        {autoCloseEnabled && (
          <p className='text-xs text-muted-foreground'>
            {closeSummary
              ? `Will close on ${closeSummary}.`
              : 'Pick a close date and time to enable auto close.'}
          </p>
        )}
      </div>
    </section>
  );
}
