'use client';

import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';

type CalendarHeaderProps = {
  monthLabel: string;
  nextRefreshLabel: string | null;
  showRefreshNotice: boolean;
  showStandup: boolean;
  showSecurity: boolean;
  showDemo: boolean;
  showOnlyMine: boolean;
  currentUserId: string | null;
  onToggleStandup: () => void;
  onToggleSecurity: () => void;
  onToggleDemo: () => void;
  onToggleOnlyMine: (value: boolean) => void;
  onPrev: () => void;
  onNext: () => void;
  isPrevDisabled: boolean;
  isNextDisabled: boolean;
};

export function CalendarHeader({
  monthLabel,
  nextRefreshLabel,
  showRefreshNotice,
  showStandup,
  showSecurity,
  showDemo,
  showOnlyMine,
  currentUserId,
  onToggleStandup,
  onToggleSecurity,
  onToggleDemo,
  onToggleOnlyMine,
  onPrev,
  onNext,
  isPrevDisabled,
  isNextDisabled,
}: CalendarHeaderProps) {
  return (
    <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
      <div>
        <p className='text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground'>
          HostHub Calendar
        </p>
        <h2 className='mt-2 text-2xl font-semibold text-foreground'>
          {monthLabel}
        </h2>
        <p className='mt-2 text-sm text-muted-foreground'>
          Assignments cover the current month only. Past assignments remain visible,
          and future months are TBD.
        </p>
        {showRefreshNotice && nextRefreshLabel ? (
          <div className='mt-3 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700'>
            <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />
            <span>
              Eligibility rules were updated. Next month will regenerate on{' '}
              <span className='font-semibold text-amber-800'>
                {nextRefreshLabel}
              </span>
              .
            </span>
          </div>
        ) : null}
        <div className='mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground'>
          <button
            type='button'
            onClick={onToggleStandup}
            aria-pressed={showStandup}
            className={`rounded-full border px-3 py-1 transition ${
              showStandup
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
                : 'border-border/40 bg-secondary/10 text-muted-foreground/50'
            }`}
          >
            Standup • Mon/Thu
          </button>
          <button
            type='button'
            onClick={onToggleSecurity}
            aria-pressed={showSecurity}
            className={`rounded-full border px-3 py-1 transition ${
              showSecurity
                ? 'border-sky-500/30 bg-sky-500/10 text-sky-700'
                : 'border-border/40 bg-secondary/10 text-muted-foreground/50'
            }`}
          >
            Security Shift • Mon-Fri
          </button>
          <button
            type='button'
            onClick={onToggleDemo}
            aria-pressed={showDemo}
            className={`rounded-full border px-3 py-1 transition ${
              showDemo
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-700'
                : 'border-border/40 bg-secondary/10 text-muted-foreground/50'
            }`}
          >
            Demo Day • 1st Wed
          </button>
          <label className='inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-primary'>
            <input
              type='checkbox'
              checked={showOnlyMine}
              onChange={(event) => onToggleOnlyMine(event.target.checked)}
              disabled={!currentUserId}
              className='h-4 w-4 accent-primary'
            />
            My Shifts Only
          </label>
        </div>
      </div>
      <div className='flex items-center gap-2'>
        <button
          type='button'
          onClick={onPrev}
          disabled={isPrevDisabled}
          className='inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:bg-secondary/70 disabled:cursor-not-allowed disabled:opacity-60'
        >
          <ChevronLeft className='h-4 w-4' aria-hidden={true} />
          Prev
        </button>
        <button
          type='button'
          onClick={onNext}
          disabled={isNextDisabled}
          className='inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:bg-secondary/70 disabled:cursor-not-allowed disabled:opacity-60'
        >
          Next
          <ChevronRight className='h-4 w-4' aria-hidden={true} />
        </button>
      </div>
    </div>
  );
}
