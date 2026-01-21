'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';

import {
  clearScheduleEventOverride,
  updateScheduleEventOverride,
} from '@/server/actions/hosthub-event-overrides';
import { getEventOverrideId } from '@/lib/hosthub-events';

import { CalendarGrid } from './calendar-grid';
import { MONTH_WINDOW } from './calendar-constants';
import type {
  CalendarDay,
  CalendarEvent,
  DemoMoveEntry,
  EventOverride,
} from './calendar-types';
import {
  addMonths,
  buildCalendar,
  dateKey,
  formatMonth,
  getEventsForDate,
} from './calendar-utils';
import { ScheduleDetailsModal } from './schedule-details-modal';

type HostHubCalendarProps = {
  demoAssignments: Record<string, { userId: string | null; userName: string }>;
  standupAssignments: Record<string, { userId: string | null; userName: string }>;
  currentUserId: string | null;
  isAdmin: boolean;
  demoDefaultTime: string;
  standupDefaultTime: string;
  eventOverrides: Record<string, EventOverride>;
  refreshNotice?: { pendingSince: number; nextRefreshAt: number } | null;
  roster: Array<{ userId: string; name: string }>;
};

export function HostHubCalendar({
  demoAssignments,
  standupAssignments,
  currentUserId,
  isAdmin,
  demoDefaultTime,
  standupDefaultTime,
  eventOverrides,
  refreshNotice = null,
  roster,
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
  const [editHostId, setEditHostId] = useState('');
  const [editMessage, setEditMessage] = useState<string | null>(null);
  const [isSaving, startTransition] = useTransition();
  const todayKey = useMemo(() => dateKey(new Date()), []);
  const nextRefreshLabel = useMemo(() => {
    if (!refreshNotice) return null;
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'long',
    }).format(new Date(refreshNotice.nextRefreshAt));
  }, [refreshNotice]);
  const rosterOptions = useMemo(() => {
    return [...roster].sort((a, b) => a.name.localeCompare(b.name));
  }, [roster]);
  const rosterMap = useMemo(
    () => new Map(rosterOptions.map((entry) => [entry.userId, entry.name])),
    [rosterOptions],
  );

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
      const movedTargets = new Map<string, DemoMoveEntry[]>();
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
    setEditHostId('');
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
    localOverrides[getEventOverrideId(event.dateKey, event.variant)];

  const openEdit = (event: CalendarEvent) => {
    const override = getOverrideForEvent(event);
    setEditingEventId(event.id);
    setEditTime(override?.time ?? (event.time === 'TBD' ? '' : event.time));
    setEditCanceled(override?.isCanceled ?? false);
    setEditMovedDate(
      event.variant === 'demo' ? override?.movedToDate ?? '' : '',
    );
    setEditHostId(override?.overrideUserId ?? '');
    setEditMessage(null);
  };

  const saveEdit = (event: CalendarEvent) => {
    const key = getEventOverrideId(event.dateKey, event.variant);
    const trimmedMoveDate = editMovedDate.trim();
    const nextMoveDate =
      event.variant === 'demo' && trimmedMoveDate ? trimmedMoveDate : null;
    const trimmedHostId = editHostId.trim();
    const overrideUserId = trimmedHostId ? trimmedHostId : null;
    const overrideUserName = overrideUserId
      ? rosterMap.get(overrideUserId) ?? event.assignee ?? 'Unknown'
      : null;
    setEditMessage(null);
    startTransition(async () => {
      const result = await updateScheduleEventOverride({
        date: event.dateKey,
        eventType: event.variant,
        time: editTime,
        isCanceled: editCanceled,
        movedToDate: nextMoveDate,
        overrideUserId,
        overrideUserName,
      });
      if (result.success) {
        setLocalOverrides((prev) => ({
          ...prev,
          [key]: {
            time: editTime.trim() ? editTime.trim() : null,
            isCanceled: editCanceled,
            movedToDate: nextMoveDate,
            overrideUserId,
            overrideUserName,
          },
        }));
        setEditMessage(result.message);
      } else {
        setEditMessage(result.message);
      }
    });
  };

  const resetEdit = (event: CalendarEvent) => {
    const key = getEventOverrideId(event.dateKey, event.variant);
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
        setEditHostId('');
        setEditMessage(result.message);
      } else {
        setEditMessage(result.message);
      }
    });
  };

  const getDayEvents = (date: Date) =>
    filteredEvents(
      getEventsForDate(
        date,
        demoAssignments,
        standupAssignments,
        localOverrides,
        demoMoveTargets,
        demoMoveSources,
        demoDefaultTime,
        standupDefaultTime,
      ),
    );

  const closeEdit = () => {
    setEditingEventId(null);
    setEditHostId('');
    setEditMessage(null);
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
          {refreshNotice && nextRefreshLabel ? (
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

      <CalendarGrid
        calendarDays={calendarDays}
        todayKey={todayKey}
        currentUserId={currentUserId}
        getEvents={getDayEvents}
        onDayClick={handleDayClick}
      />

      {selectedDate ? (
        <ScheduleDetailsModal
          selectedDate={selectedDate}
          events={currentEvents}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          rosterOptions={rosterOptions}
          editingEventId={editingEventId}
          editTime={editTime}
          editCanceled={editCanceled}
          editMovedDate={editMovedDate}
          editHostId={editHostId}
          editMessage={editMessage}
          isSaving={isSaving}
          getOverrideForEvent={getOverrideForEvent}
          onClose={closeModal}
          onOpenEdit={openEdit}
          onSaveEdit={saveEdit}
          onResetEdit={resetEdit}
          onEditTimeChange={setEditTime}
          onEditMovedDateChange={setEditMovedDate}
          onEditHostIdChange={setEditHostId}
          onEditCanceledChange={setEditCanceled}
          onCloseEdit={closeEdit}
        />
      ) : null}
    </div>
  );
}
