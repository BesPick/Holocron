'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import {
  clearScheduleEventOverride,
  updateScheduleEventOverride,
} from '@/server/actions/hosthub-event-overrides';
import { type HostHubEventType } from '@/lib/hosthub-events';

type CalendarDay = {
  date: Date;
  inMonth: boolean;
};

type CalendarEvent = {
  id: string;
  dateKey: string;
  label: string;
  time: string;
  assignee?: string;
  assigneeId?: string | null;
  detail?: string;
  variant: 'standup' | 'demo';
  isCanceled?: boolean;
};

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_WINDOW = [-1, 0, 1, 2, 3];
const STANDUP_DAYS = new Set([1, 4]);
const STANDUP_TONE = {
  card: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
  badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
};
const DEMO_TONE = {
  card: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
  badge: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
};
const MY_TONE = {
  card: 'border-primary/30 bg-primary/10 text-primary',
  badge: 'border-primary/30 bg-primary/10 text-primary',
};

const pad2 = (value: number) => value.toString().padStart(2, '0');

const formatMonth = (date: Date) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date);

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate(),
  )}`;

const parseDateKey = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  if ([year, month, day].some((part) => Number.isNaN(part))) return null;
  return new Date(year, month - 1, day);
};

type EventOverride = {
  time: string | null;
  isCanceled: boolean;
  movedToDate?: string | null;
};

const overrideKey = (dateValue: string, eventType: HostHubEventType) =>
  `${eventType}-${dateValue}`;

const resolveEventTime = (
  overrideTime: string | null | undefined,
  defaultTime: string,
) => {
  if (overrideTime && overrideTime.trim()) return overrideTime;
  if (defaultTime && defaultTime.trim()) return defaultTime;
  return 'TBD';
};

const addMonths = (date: Date, offset: number) =>
  new Date(date.getFullYear(), date.getMonth() + offset, 1);

const formatFullDate = (date: Date) =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);

const buildCalendar = (date: Date): CalendarDay[] => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - firstDay.getDay());
  const end = new Date(lastDay);
  end.setDate(lastDay.getDate() + (6 - lastDay.getDay()));

  const days: CalendarDay[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const cellDate = new Date(cursor);
    days.push({
      date: cellDate,
      inMonth: cellDate.getMonth() === month,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
};

const isFirstWednesday = (date: Date) =>
  date.getDay() === 3 && date.getDate() <= 7;

const getEventsForDate = (
  date: Date,
  demoAssignments: Record<string, { userId: string | null; userName: string }>,
  standupAssignments: Record<string, { userId: string | null; userName: string }>,
  eventOverrides: Record<string, EventOverride>,
  demoMoveTargets: Map<
    string,
    { sourceDate: string; override: EventOverride }[]
  >,
  demoMoveSources: Set<string>,
  demoDefaultTime: string,
  standupDefaultTime: string,
) => {
  const events: CalendarEvent[] = [];
  if (STANDUP_DAYS.has(date.getDay())) {
    const key = dateKey(date);
    const standupAssignment = standupAssignments[key];
    const override = eventOverrides[overrideKey(key, 'standup')];
    events.push({
      id: `standup-${key}`,
      dateKey: key,
      label: 'Standup',
      time: resolveEventTime(override?.time, standupDefaultTime),
      assignee: standupAssignment?.userName ?? 'TBD',
      assigneeId: standupAssignment?.userId ?? null,
      variant: 'standup',
      isCanceled: override?.isCanceled ?? false,
    });
  }
  const key = dateKey(date);
  const movedDemoEntries = demoMoveTargets.get(key);
  if (movedDemoEntries) {
    movedDemoEntries.forEach((movedDemo) => {
      const assignment = demoAssignments[movedDemo.sourceDate];
      const movedFromDate = parseDateKey(movedDemo.sourceDate);
      const detail =
        movedFromDate && movedDemo.sourceDate !== key
          ? `Moved from ${formatFullDate(movedFromDate)}`
          : undefined;
      events.push({
        id: `demo-${movedDemo.sourceDate}`,
        dateKey: movedDemo.sourceDate,
        label: 'Demo Day',
        time: resolveEventTime(movedDemo.override?.time, demoDefaultTime),
        assignee: assignment?.userName ?? 'TBD',
        assigneeId: assignment?.userId ?? null,
        detail,
        variant: 'demo',
        isCanceled: movedDemo.override?.isCanceled ?? false,
      });
    });
  }
  if (isFirstWednesday(date)) {
    if (demoMoveSources.has(key)) {
      return events;
    }
    const assignment = demoAssignments[key];
    const override = eventOverrides[overrideKey(key, 'demo')];
    events.push({
      id: `demo-${key}`,
      dateKey: key,
      label: 'Demo Day',
      time: resolveEventTime(override?.time, demoDefaultTime),
      assignee: assignment?.userName ?? 'TBD',
      assigneeId: assignment?.userId ?? null,
      variant: 'demo',
      isCanceled: override?.isCanceled ?? false,
    });
  }
  return events;
};

type HostHubCalendarProps = {
  demoAssignments: Record<string, { userId: string | null; userName: string }>;
  standupAssignments: Record<string, { userId: string | null; userName: string }>;
  currentUserId: string | null;
  isAdmin: boolean;
  demoDefaultTime: string;
  standupDefaultTime: string;
  eventOverrides: Record<string, EventOverride>;
};

export function HostHubCalendar({
  demoAssignments,
  standupAssignments,
  currentUserId,
  isAdmin,
  demoDefaultTime,
  standupDefaultTime,
  eventOverrides,
}: HostHubCalendarProps) {
  const [baseDate] = useState(() => new Date());
  const [selectedIndex, setSelectedIndex] = useState(1);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showOnlyMine, setShowOnlyMine] = useState(false);
  const [showStandup, setShowStandup] = useState(true);
  const [showDemo, setShowDemo] = useState(true);
  const [localOverrides, setLocalOverrides] =
    useState<Record<string, EventOverride>>(eventOverrides);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editTime, setEditTime] = useState('');
  const [editCanceled, setEditCanceled] = useState(false);
  const [editMovedDate, setEditMovedDate] = useState('');
  const [editMessage, setEditMessage] = useState<string | null>(null);
  const [isSaving, startTransition] = useTransition();
  const todayKey = useMemo(() => dateKey(new Date()), []);

  const availableMonths = useMemo(
    () => MONTH_WINDOW.map((offset) => addMonths(baseDate, offset)),
    [baseDate],
  );

  const selectedMonth = availableMonths[selectedIndex];
  const calendarDays = useMemo(
    () => buildCalendar(selectedMonth),
    [selectedMonth],
  );
  const { movedTargets: demoMoveTargets, movedSources: demoMoveSources } =
    useMemo(() => {
      const movedTargets = new Map<
        string,
        { sourceDate: string; override: EventOverride }[]
      >();
      const movedSources = new Set<string>();

      Object.entries(localOverrides).forEach(([key, override]) => {
        if (!override?.movedToDate) return;
        const [eventType, ...dateParts] = key.split('-');
        if (eventType !== 'demo') return;
        const sourceDate = dateParts.join('-');
        const movedToDate = override.movedToDate.trim();
        if (!sourceDate || !movedToDate || movedToDate === sourceDate) return;
        const existing = movedTargets.get(movedToDate) ?? [];
        existing.push({ sourceDate, override });
        movedTargets.set(movedToDate, existing);
        movedSources.add(sourceDate);
      });

      return { movedTargets, movedSources };
    }, [localOverrides]);
  const selectedEvents = useMemo(
    () =>
      selectedDate
        ? getEventsForDate(
            selectedDate,
            demoAssignments,
            standupAssignments,
            localOverrides,
            demoMoveTargets,
            demoMoveSources,
            demoDefaultTime,
            standupDefaultTime,
          )
        : [],
    [
      selectedDate,
      demoAssignments,
      standupAssignments,
      localOverrides,
      demoMoveTargets,
      demoMoveSources,
      demoDefaultTime,
      standupDefaultTime,
    ],
  );

  useEffect(() => {
    setSelectedDate(null);
    setEditingEventId(null);
    setEditMessage(null);
  }, [selectedMonth]);

  useEffect(() => {
    setLocalOverrides(eventOverrides);
  }, [eventOverrides]);

  const handlePrev = () => {
    setSelectedIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setSelectedIndex((prev) =>
      Math.min(availableMonths.length - 1, prev + 1),
    );
  };

  const handleDayClick = (day: CalendarDay) => {
    if (!day.inMonth) return;
    setSelectedDate(day.date);
    setEditingEventId(null);
    setEditMessage(null);
  };

  const closeModal = () => {
    setSelectedDate(null);
    setEditingEventId(null);
    setEditMessage(null);
  };

  const filteredEvents = (events: CalendarEvent[]) =>
    events.filter((event) => {
      if (!showStandup && event.variant === 'standup') return false;
      if (!showDemo && event.variant === 'demo') return false;
      if (showOnlyMine) {
        return event.assigneeId && event.assigneeId === currentUserId;
      }
      return true;
    });

  const currentEvents = filteredEvents(selectedEvents);

  const getOverrideForEvent = (event: CalendarEvent) =>
    localOverrides[overrideKey(event.dateKey, event.variant)];

  const openEdit = (event: CalendarEvent) => {
    const override = getOverrideForEvent(event);
    setEditingEventId(event.id);
    setEditTime(override?.time ?? (event.time === 'TBD' ? '' : event.time));
    setEditCanceled(override?.isCanceled ?? false);
    setEditMovedDate(
      event.variant === 'demo' ? override?.movedToDate ?? '' : '',
    );
    setEditMessage(null);
  };

  const saveEdit = (event: CalendarEvent) => {
    const key = overrideKey(event.dateKey, event.variant);
    const trimmedMoveDate = editMovedDate.trim();
    const nextMoveDate =
      event.variant === 'demo' && trimmedMoveDate ? trimmedMoveDate : null;
    setEditMessage(null);
    startTransition(async () => {
      const result = await updateScheduleEventOverride({
        date: event.dateKey,
        eventType: event.variant,
        time: editTime,
        isCanceled: editCanceled,
        movedToDate: nextMoveDate,
      });
      if (result.success) {
        setLocalOverrides((prev) => ({
          ...prev,
          [key]: {
            time: editTime.trim() ? editTime.trim() : null,
            isCanceled: editCanceled,
            movedToDate: nextMoveDate,
          },
        }));
        setEditMessage(result.message);
      } else {
        setEditMessage(result.message);
      }
    });
  };

  const resetEdit = (event: CalendarEvent) => {
    const key = overrideKey(event.dateKey, event.variant);
    setEditMessage(null);
    startTransition(async () => {
      const result = await clearScheduleEventOverride({
        date: event.dateKey,
        eventType: event.variant,
      });
      if (result.success) {
        setLocalOverrides((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        const nextDefaultTime =
          event.variant === 'standup'
            ? standupDefaultTime
            : demoDefaultTime;
        setEditTime(nextDefaultTime.trim() ? nextDefaultTime : '');
        setEditCanceled(false);
        setEditMovedDate('');
        setEditMessage(result.message);
      } else {
        setEditMessage(result.message);
      }
    });
  };

  return (
    <div className='rounded-2xl border border-border bg-card/70 p-4 shadow-sm sm:p-6'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <p className='text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground'>
            HostHub Calendar
          </p>
          <h2 className='mt-2 text-2xl font-semibold text-foreground'>
            {formatMonth(selectedMonth)}
          </h2>
          <p className='mt-2 text-sm text-muted-foreground'>
            We assign the current month only. Past assignments remain visible,
            and future months appear with TBD placeholders.
          </p>
          <div className='mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground'>
            <button
              type='button'
              onClick={() => setShowStandup((prev) => !prev)}
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
              onClick={() => setShowDemo((prev) => !prev)}
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
                onChange={(event) => setShowOnlyMine(event.target.checked)}
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
            onClick={handlePrev}
            disabled={selectedIndex === 0}
            className='inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:bg-secondary/70 disabled:cursor-not-allowed disabled:opacity-60'
          >
            <ChevronLeft className='h-4 w-4' aria-hidden={true} />
            Prev
          </button>
          <button
            type='button'
            onClick={handleNext}
            disabled={selectedIndex === availableMonths.length - 1}
            className='inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:bg-secondary/70 disabled:cursor-not-allowed disabled:opacity-60'
          >
            Next
            <ChevronRight className='h-4 w-4' aria-hidden={true} />
          </button>
        </div>
      </div>

      <div className='mt-5 flex gap-2 overflow-x-auto pb-1 text-xs text-muted-foreground sm:flex-wrap sm:overflow-visible'>
        {availableMonths.map((month, index) => (
          <button
            key={month.toISOString()}
            type='button'
            onClick={() => setSelectedIndex(index)}
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

      <div className='mt-6 overflow-x-auto pb-2 sm:overflow-visible'>
        <div className='min-w-[720px] sm:min-w-0'>
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
              const events = day.inMonth
                ? filteredEvents(
                    getEventsForDate(
                      day.date,
                      demoAssignments,
                      standupAssignments,
                      localOverrides,
                      demoMoveTargets,
                      demoMoveSources,
                      demoDefaultTime,
                      standupDefaultTime,
                    ),
                  )
                : [];
              return (
                <button
                  key={day.date.toISOString()}
                  type='button'
                  onClick={() => handleDayClick(day)}
                  disabled={!day.inMonth}
                  className={`min-h-[84px] rounded-xl border px-1.5 py-1.5 text-left transition sm:min-h-[110px] sm:px-2 sm:py-2 ${
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

      {selectedDate ? (
        <div
          className='fixed inset-0 z-60 grid place-items-center bg-black/50 p-4'
          role='dialog'
          aria-modal='true'
          aria-label='Schedule details'
          onClick={closeModal}
        >
          <div
            className='w-full max-w-xl rounded-3xl border border-border bg-background p-6 shadow-2xl'
            onClick={(event) => event.stopPropagation()}
          >
            <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
              <div>
                <p className='text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground'>
                  Schedule Details
                </p>
                <h3 className='mt-2 text-2xl font-semibold text-foreground'>
                  {formatFullDate(selectedDate)}
                </h3>
              </div>
              <button
                type='button'
                onClick={closeModal}
                className='rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-secondary/70'
              >
                Close
              </button>
            </div>

            <div className='mt-5 space-y-3'>
              {currentEvents.length > 0 ? (
                currentEvents.map((event) => {
                  const isMine =
                    event.assigneeId &&
                    event.assigneeId === currentUserId;
                  const tone = isMine
                    ? MY_TONE
                    : event.variant === 'standup'
                      ? STANDUP_TONE
                      : DEMO_TONE;
                  const override = getOverrideForEvent(event);
                  const originalDemoDate =
                    event.variant === 'demo' ? parseDateKey(event.dateKey) : null;
                  const isEditing = editingEventId === event.id;
                  return (
                    <div
                      key={event.id}
                      className={`rounded-2xl border p-4 ${tone.card}`}
                    >
                      <div className='flex items-center justify-between gap-2'>
                        <div>
                          <p className='text-sm font-semibold text-foreground'>
                            {event.label}
                          </p>
                          <p className='text-xs text-muted-foreground'>
                            {event.time}
                          </p>
                        </div>
                        <div className='flex items-center gap-2'>
                          {event.isCanceled ? (
                            <span className='rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground'>
                              Canceled
                            </span>
                          ) : null}
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${tone.badge}`}
                          >
                            {event.variant === 'standup' ? 'Standup' : 'Demo'}
                          </span>
                        </div>
                      </div>
                      {event.assignee ? (
                        <p className='mt-2 text-sm text-muted-foreground'>
                          Assigned:{' '}
                          <span className='text-foreground'>{event.assignee}</span>
                        </p>
                      ) : null}
                      {event.detail ? (
                        <p className='mt-2 text-sm text-muted-foreground'>
                          {event.detail}
                        </p>
                      ) : null}
                      {isAdmin ? (
                        <div className='mt-4 rounded-xl border border-border bg-background/70 p-3'>
                          <div className='flex flex-wrap items-center justify-between gap-2'>
                            <p className='text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground'>
                              Admin override
                            </p>
                            {!isEditing ? (
                              <button
                                type='button'
                                onClick={() => openEdit(event)}
                                className='rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground transition hover:bg-secondary/70'
                              >
                                Edit event
                              </button>
                            ) : null}
                          </div>
                          {isEditing ? (
                            <div className='mt-3 space-y-3'>
                              <label className='flex flex-col gap-2 text-sm text-foreground'>
                                Time
                                <input
                                  type='time'
                                  value={editTime}
                                  onChange={(eventValue) =>
                                    setEditTime(eventValue.target.value)
                                  }
                                  disabled={isSaving}
                                  className='w-full max-w-40 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                                />
                              </label>
                              {event.variant === 'demo' ? (
                                <label className='flex flex-col gap-2 text-sm text-foreground'>
                                  Move date
                                  <input
                                    type='date'
                                    value={editMovedDate}
                                    onChange={(eventValue) =>
                                      setEditMovedDate(eventValue.target.value)
                                    }
                                    disabled={isSaving}
                                    className='w-full max-w-50 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                                  />
                                  {originalDemoDate ? (
                                    <span className='text-xs text-muted-foreground'>
                                      Original date:{' '}
                                      {formatFullDate(originalDemoDate)}
                                    </span>
                                  ) : null}
                                </label>
                              ) : null}
                              <label className='inline-flex items-center gap-2 text-sm text-foreground'>
                                <input
                                  type='checkbox'
                                  checked={editCanceled}
                                  onChange={(eventValue) =>
                                    setEditCanceled(eventValue.target.checked)
                                  }
                                  disabled={isSaving}
                                  className='h-4 w-4 accent-primary'
                                />
                                Mark as canceled
                              </label>
                              {editMessage ? (
                                <p className='text-xs text-muted-foreground'>
                                  {editMessage}
                                </p>
                              ) : null}
                              <div className='flex flex-wrap items-center gap-2'>
                                <button
                                  type='button'
                                  onClick={() => saveEdit(event)}
                                  disabled={isSaving}
                                  className='rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60'
                                >
                                  {isSaving ? 'Saving...' : 'Save'}
                                </button>
                                {override ? (
                                  <button
                                    type='button'
                                    onClick={() => resetEdit(event)}
                                    disabled={isSaving}
                                    className='rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary/70 disabled:cursor-not-allowed disabled:opacity-60'
                                  >
                                    Reset
                                  </button>
                                ) : null}
                                <button
                                  type='button'
                                  onClick={() => {
                                    setEditingEventId(null);
                                    setEditMessage(null);
                                  }}
                                  className='rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-secondary/70'
                                >
                                  Close
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <div className='rounded-2xl border border-dashed border-border bg-card/50 px-6 py-8 text-center text-sm text-muted-foreground'>
                  No matching shifts for this day.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
