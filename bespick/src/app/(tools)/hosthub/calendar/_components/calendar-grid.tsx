'use client';

import type { CalendarDay, CalendarEvent } from './calendar-types';
import {
  DEMO_TONE,
  MY_TONE,
  STANDUP_TONE,
  WEEKDAY_LABELS,
} from './calendar-constants';
import { dateKey, formatFullDate } from './calendar-utils';

type CalendarGridProps = {
  calendarDays: CalendarDay[];
  todayKey: string;
  currentUserId: string | null;
  getEvents: (date: Date) => CalendarEvent[];
  onDayClick: (day: CalendarDay) => void;
};

export function CalendarGrid({
  calendarDays,
  todayKey,
  currentUserId,
  getEvents,
  onDayClick,
}: CalendarGridProps) {
  return (
    <div className='mt-6 overflow-x-auto pb-2 sm:overflow-visible'>
      <div className='min-w-180 sm:min-w-0'>
        <div className='grid grid-cols-7 gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:text-xs'>
          {WEEKDAY_LABELS.map((label) => (
            <span key={label} className='text-center'>
              {label}
            </span>
          ))}
        </div>
        <div className='mt-2 grid grid-cols-7 gap-2 text-xs sm:text-sm'>
          {calendarDays.map((day) => {
            const isToday = dateKey(day.date) === todayKey;
            const events = day.inMonth ? getEvents(day.date) : [];
            return (
              <button
                key={day.date.toISOString()}
                type='button'
                onClick={() => onDayClick(day)}
                disabled={!day.inMonth}
                className={`min-h-21 rounded-xl border px-1.5 py-1.5 text-left transition sm:min-h-27.5 sm:px-2 sm:py-2 ${
                  day.inMonth
                    ? 'border-border bg-background text-foreground hover:bg-secondary/20'
                    : 'border-border/60 bg-secondary/40 text-muted-foreground'
                } ${isToday ? 'ring-2 ring-primary/40' : ''}`}
                aria-label={`View ${formatFullDate(day.date)}`}
              >
                <div className='flex flex-col gap-2'>
                  <span className='text-right text-[10px] font-semibold sm:text-xs'>
                    {day.date.getDate()}
                  </span>
                  {events.length > 0 ? (
                    <>
                      <div className='space-y-1 text-left text-[10px] sm:hidden'>
                        {events.map((event) => {
                          const isMine =
                            event.assigneeId &&
                            event.assigneeId === currentUserId;
                          const dotTone = isMine
                            ? 'bg-primary'
                            : event.variant === 'standup'
                              ? 'bg-emerald-500'
                              : 'bg-amber-500';
                          return (
                            <div
                              key={event.id}
                              className={`flex items-center gap-1 ${
                                event.isCanceled
                                  ? 'text-muted-foreground line-through'
                                  : ''
                              }`}
                            >
                              <span className={`h-2 w-2 rounded-full ${dotTone}`} />
                              <span className='font-semibold'>
                                {event.label}
                              </span>
                              <span className='text-[9px] text-muted-foreground'>
                                {event.time}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <div className='hidden space-y-1 text-left text-[11px] sm:block'>
                        {events.map((event) => {
                          const isMine =
                            event.assigneeId &&
                            event.assigneeId === currentUserId;
                          const tone = isMine
                            ? MY_TONE
                            : event.variant === 'standup'
                              ? STANDUP_TONE
                              : DEMO_TONE;
                          return (
                            <div
                              key={event.id}
                              className={`rounded-lg border px-2 py-1 ${tone.card} ${
                                event.isCanceled ? 'opacity-60' : ''
                              }`}
                            >
                              <div className='flex items-center justify-between gap-2'>
                                <span className='font-semibold'>
                                  {event.label}
                                </span>
                                <span className='text-[10px]'>
                                  {event.time}
                                </span>
                              </div>
                              {event.isCanceled ? (
                                <div className='mt-1 text-[10px] uppercase text-muted-foreground'>
                                  Canceled
                                </div>
                              ) : null}
                              {event.assignee ? (
                                <div className='mt-1 text-[10px] text-muted-foreground'>
                                  Assigned: {event.assignee}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : day.inMonth ? (
                    <div className='text-left text-[10px] text-muted-foreground sm:text-[11px]'>
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
  );
}
