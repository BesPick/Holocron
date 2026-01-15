import * as React from 'react';

interface SchedulingSectionProps {
  showSchedulingControls: boolean;
  date: string;
  time: string;
  todayLocalISO: string;
  displayTimeSlots: string[];
  noSlotsLeftToday: boolean;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
}

export function SchedulingSection({
  showSchedulingControls,
  date,
  time,
  todayLocalISO,
  displayTimeSlots,
  noSlotsLeftToday,
  onDateChange,
  onTimeChange,
}: SchedulingSectionProps) {
  if (!showSchedulingControls) {
    return null;
  }

  return (
    <div className='grid gap-4 sm:grid-cols-2'>
      <label className='flex flex-col gap-2 text-sm text-foreground'>
        Publish Date
        <input
          type='date'
          name='publishDate'
          value={date}
          min={todayLocalISO}
          onChange={(event) => onDateChange(event.target.value)}
          className='rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
        />
      </label>

      <label className='flex flex-col gap-2 text-sm text-foreground'>
        Publish Time
        <select
          name='publishTime'
          value={time}
          onChange={(event) => onTimeChange(event.target.value)}
          required={date !== todayLocalISO}
          disabled={noSlotsLeftToday}
          className='rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-70'
        >
          <option value=''>--</option>
          {noSlotsLeftToday ? (
            <option value='' disabled>
              No slots remain today — pick another date
            </option>
          ) : (
            displayTimeSlots.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))
          )}
        </select>
      </label>
    </div>
  );
}
