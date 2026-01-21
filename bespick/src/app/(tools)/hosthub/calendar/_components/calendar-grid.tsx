'use client';

import type { CalendarDay, CalendarEvent } from './calendar-types';
import {
  DEMO_TONE,
  MY_TONE,
  SECURITY_TONE,
  STANDUP_TONE,
  WEEKDAY_LABELS,
} from './calendar-constants';
import { dateKey, formatFullDate } from './calendar-utils';
import {
  getSecurityShiftWindow,
  isSecurityShiftEventType,
} from '@/lib/hosthub-events';

type CalendarGridProps = {
  calendarDays: CalendarDay[];
  todayKey: string;
  currentUserId: string | null;
  getEvents: (date: Date) => CalendarEvent[];
  onDayClick: (day: CalendarDay) => void;
};

const MAX_EVENTS_PER_DAY = 3;

export function CalendarGrid({
  calendarDays,
  todayKey,
  currentUserId,
  getEvents,
  onDayClick,
}: CalendarGridProps) {
  const inMonthDays = calendarDays.filter((day) => day.inMonth);
  const daysWithEvents = inMonthDays
    .map((day) => ({ day, events: getEvents(day.date) }))
    .filter((entry) => entry.events.length > 0);
  const resolveTone = (event: CalendarEvent) => {
    const isMine =
      event.assigneeId && event.assigneeId === currentUserId;
    if (isMine) return MY_TONE;
    if (event.variant === 'standup') return STANDUP_TONE;
    if (isSecurityShiftEventType(event.variant)) return SECURITY_TONE;
    return DEMO_TONE;
  };
  const resolveLabel = (event: CalendarEvent) => {
    if (!isSecurityShiftEventType(event.variant)) return event.label;
    const window = getSecurityShiftWindow(event.variant);
    return window ? `${window.label} Security` : event.label;
  };

  return (
    <div className='mt-6'>
      <div className='space-y-3 sm:hidden'>
        {daysWithEvents.length === 0 ? (
          <div className='rounded-2xl border border-dashed border-border bg-card/40 px-4 py-6 text-center text-sm text-muted-foreground'>
            No shifts scheduled yet for this month.
          </div>
        ) : (
          daysWithEvents.map(({ day, events }) => {
            const isToday = dateKey(day.date) === todayKey;
            const visibleEvents = events.slice(0, MAX_EVENTS_PER_DAY);
            const hiddenCount = events.length - visibleEvents.length;
            return (
              <button
                key={day.date.toISOString()}
                type='button'
                onClick={() => onDayClick(day)}
                className={`w-full rounded-2xl border bg-background px-4 py-3 text-left shadow-sm transition hover:bg-secondary/20 ${
                  isToday ? 'ring-2 ring-primary/30' : ''
                }`}
                aria-label={`View ${formatFullDate(day.date)}`}
              >
                <div className='flex items-start justify-between gap-2'>
                  <div>
                    <p className='text-sm font-semibold text-foreground'>
                      {formatFullDate(day.date)}
                    </p>
                    <p className='mt-1 text-xs text-muted-foreground'>
                      {events.length} shifts scheduled
                    </p>
                  </div>
                  {isToday ? (
                    <span className='rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary'>
                      Today
                    </span>
                  ) : null}
                </div>
                <div className='mt-3 space-y-2'>
                  {visibleEvents.map((event) => {
                    const tone = resolveTone(event);
                    const label = resolveLabel(event);
                    return (
                      <div
                        key={event.id}
                        className={`rounded-xl border border-l-4 px-3 py-2 ${tone.card} ${
                          event.isCanceled ? 'opacity-60' : ''
                        }`}
                      >
                        <div className='flex items-center justify-between gap-2 text-xs'>
                          <span
                            className={`font-semibold ${
                              event.isCanceled ? 'line-through' : ''
                            }`}
                          >
                            {label}
                          </span>
                          <span className='text-[11px]'>{event.time}</span>
                        </div>
                      </div>
                    );
                  })}
                  {hiddenCount > 0 ? (
                    <p className='text-[11px] text-muted-foreground'>
                      +{hiddenCount} more
                    </p>
                  ) : null}
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className='hidden sm:block'>
        <div className='overflow-x-auto pb-3 lg:overflow-visible'>
          <div className='min-w-[48rem] md:min-w-[64rem] lg:min-w-0'>
            <div className='grid grid-cols-7 gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:text-sm'>
              {WEEKDAY_LABELS.map((label) => (
                <span key={label} className='text-center'>
                  {label}
                </span>
              ))}
            </div>
            <div className='mt-3 grid grid-cols-7 gap-3 text-xs sm:text-sm'>
              {calendarDays.map((day) => {
                const isToday = dateKey(day.date) === todayKey;
                const events = day.inMonth ? getEvents(day.date) : [];
                const visibleEvents = events.slice(0, MAX_EVENTS_PER_DAY);
                const hiddenCount = events.length - visibleEvents.length;
                return (
                  <button
                    key={day.date.toISOString()}
                    type='button'
                    onClick={() => onDayClick(day)}
                    disabled={!day.inMonth}
                    className={`min-h-[7.5rem] rounded-2xl border px-2.5 py-2.5 text-left transition sm:min-h-[9rem] lg:min-h-[10.5rem] ${
                      day.inMonth
                        ? 'border-border bg-background text-foreground hover:bg-secondary/20'
                        : 'border-border/60 bg-secondary/40 text-muted-foreground'
                    } ${isToday ? 'ring-2 ring-primary/40' : ''}`}
                    aria-label={`View ${formatFullDate(day.date)}`}
                  >
                    <div className='flex flex-col gap-2'>
                      <span className='text-right text-xs font-semibold sm:text-sm'>
                        {day.date.getDate()}
                      </span>
                      {events.length > 0 ? (
                        <div className='space-y-1.5 text-left text-[11px] sm:text-xs'>
                          {visibleEvents.map((event) => {
                            const tone = resolveTone(event);
                            const label = resolveLabel(event);
                            return (
                              <div
                                key={event.id}
                                className={`rounded-lg border border-l-4 px-2.5 py-1.5 shadow-sm ${tone.card} ${
                                  event.isCanceled ? 'opacity-60' : ''
                                }`}
                              >
                                <div className='flex items-center justify-between gap-2'>
                                  <span
                                    className={`font-semibold ${
                                      event.isCanceled ? 'line-through' : ''
                                    }`}
                                  >
                                    {label}
                                  </span>
                                  <span className='text-[11px]'>
                                    {event.time}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                          {hiddenCount > 0 ? (
                            <p className='text-[11px] text-muted-foreground'>
                              +{hiddenCount} more
                            </p>
                          ) : null}
                        </div>
                      ) : day.inMonth ? (
                        <div className='text-left text-[11px] text-muted-foreground'>
                          No Events
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
