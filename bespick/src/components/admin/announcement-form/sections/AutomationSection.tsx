import * as React from 'react';

interface AutomationSectionProps {
  autoDeleteEnabled: boolean;
  autoArchiveEnabled: boolean;
  deleteDate: string;
  deleteTime: string;
  archiveDate: string;
  archiveTime: string;
  minAutoDeleteDate: string;
  minAutoArchiveDate: string;
  displayDeleteTimeSlots: string[];
  displayArchiveTimeSlots: string[];
  noDeleteSlotsLeftToday: boolean;
  noArchiveSlotsLeftToday: boolean;
  autoDeleteSummary: string | null;
  autoArchiveSummary: string | null;
  onToggleAutoDelete: (enabled: boolean) => void;
  onToggleAutoArchive: (enabled: boolean) => void;
  onChangeDeleteDate: (value: string) => void;
  onChangeDeleteTime: (value: string) => void;
  onChangeArchiveDate: (value: string) => void;
  onChangeArchiveTime: (value: string) => void;
}

export function AutomationSection({
  autoDeleteEnabled,
  autoArchiveEnabled,
  deleteDate,
  deleteTime,
  archiveDate,
  archiveTime,
  minAutoDeleteDate,
  minAutoArchiveDate,
  displayDeleteTimeSlots,
  displayArchiveTimeSlots,
  noDeleteSlotsLeftToday,
  noArchiveSlotsLeftToday,
  autoDeleteSummary,
  autoArchiveSummary,
  onToggleAutoDelete,
  onToggleAutoArchive,
  onChangeDeleteDate,
  onChangeDeleteTime,
  onChangeArchiveDate,
  onChangeArchiveTime,
}: AutomationSectionProps) {
  return (
    <>
      <div className='space-y-3 rounded-2xl border border-border bg-card/70 p-4'>
        <label className='flex items-center gap-3 text-sm font-medium text-foreground'>
          <input
            type='checkbox'
            checked={autoDeleteEnabled}
            onChange={(event) => onToggleAutoDelete(event.target.checked)}
            className='h-4 w-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
          />
          Auto Delete
        </label>
        <p className='text-xs text-muted-foreground'>
          Automatically remove the activity at a future date.
        </p>

        {autoDeleteEnabled && (
          <div className='grid gap-4 sm:grid-cols-2'>
            <label className='flex flex-col gap-2 text-sm text-foreground'>
              Delete Date
              <input
                type='date'
                name='deleteDate'
                value={deleteDate}
                min={minAutoDeleteDate}
                onChange={(event) => onChangeDeleteDate(event.target.value)}
                required
                className='rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
              />
            </label>

            <label className='flex flex-col gap-2 text-sm text-foreground'>
              Delete Time (15 min slots)
              <select
                name='deleteTime'
                value={deleteTime}
                onChange={(event) => onChangeDeleteTime(event.target.value)}
                required
                disabled={noDeleteSlotsLeftToday}
                className='rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-70'
              >
                <option value=''>--</option>
                {noDeleteSlotsLeftToday ? (
                  <option value='' disabled>
                    No delete slots remain today — pick another date
                  </option>
                ) : (
                  displayDeleteTimeSlots.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))
                )}
              </select>
            </label>
          </div>
        )}

        {autoDeleteEnabled && (
          <p className='text-xs text-muted-foreground'>
            {autoDeleteSummary
              ? `Will delete on ${autoDeleteSummary}.`
              : 'Pick a delete date and time to enable auto removal.'}
          </p>
        )}
      </div>

      <div className='space-y-3 rounded-2xl border border-border bg-card/70 p-4'>
        <label className='flex items-center gap-3 text-sm font-medium text-foreground'>
          <input
            type='checkbox'
            checked={autoArchiveEnabled}
            onChange={(event) => onToggleAutoArchive(event.target.checked)}
            className='h-4 w-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
          />
          Auto Archive
        </label>
        <p className='text-xs text-muted-foreground'>
          Archive the activity automatically instead of deleting it.
        </p>

        {autoArchiveEnabled && (
          <div className='grid gap-4 sm:grid-cols-2'>
            <label className='flex flex-col gap-2 text-sm text-foreground'>
              Archive Date
              <input
                type='date'
                name='archiveDate'
                value={archiveDate}
                min={minAutoArchiveDate}
                onChange={(event) => onChangeArchiveDate(event.target.value)}
                required
                className='rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
              />
            </label>

            <label className='flex flex-col gap-2 text-sm text-foreground'>
              Archive Time (15 min slots)
              <select
                name='archiveTime'
                value={archiveTime}
                onChange={(event) => onChangeArchiveTime(event.target.value)}
                required
                disabled={noArchiveSlotsLeftToday}
                className='rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-70'
              >
                <option value=''>--</option>
                {noArchiveSlotsLeftToday ? (
                  <option value='' disabled>
                    No archive slots remain today — pick another date
                  </option>
                ) : (
                  displayArchiveTimeSlots.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))
                )}
              </select>
            </label>
          </div>
        )}

        {autoArchiveEnabled && (
          <p className='text-xs text-muted-foreground'>
            {autoArchiveSummary
              ? `Will archive on ${autoArchiveSummary}.`
              : 'Pick an archive date and time to enable automatic archiving.'}
          </p>
        )}
      </div>
    </>
  );
}
