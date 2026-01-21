'use client';

import { formatMonth } from './calendar-utils';

type CalendarMonthSelectorProps = {
  months: Date[];
  selectedIndex: number;
  onSelect: (index: number) => void;
};

export function CalendarMonthSelector({
  months,
  selectedIndex,
  onSelect,
}: CalendarMonthSelectorProps) {
  return (
    <div className='mt-5 flex gap-2 overflow-x-auto pb-1 text-xs text-muted-foreground sm:flex-wrap sm:overflow-visible'>
      {months.map((month, index) => (
        <button
          key={month.toISOString()}
          type='button'
          onClick={() => onSelect(index)}
          className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold transition ${
            index === selectedIndex
              ? 'border-primary/40 bg-primary/15 text-primary'
              : 'border-border bg-background text-muted-foreground hover:bg-secondary/70'
          }`}
        >
          {formatMonth(month)}
        </button>
      ))}
    </div>
  );
}
