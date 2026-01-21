'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import {
  clearScheduleEventOverride,
  updateScheduleEventOverride,
} from '@/server/actions/hosthub-event-overrides';
import {
  getEventOverrideId,
  getSecurityShiftWindow,
  isSecurityShiftEventType,
  type HostHubEventType,
} from '@/lib/hosthub-events';

import { CalendarGrid } from './calendar-grid';
import { MONTH_WINDOW } from './calendar-constants';
import { CalendarHeader } from './calendar-header';
import { CalendarMonthSelector } from './calendar-month-selector';
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
  securityAssignments: Record<
    string,
    { userId: string | null; userName: string }
  >;
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
  securityAssignments,
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
  const [showSecurity, setShowSecurity] = useState(true);
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
  const resolveDefaultTime = (variant: HostHubEventType) => {
    if (variant === 'standup') return standupDefaultTime;
    if (variant === 'demo') return demoDefaultTime;
    const window = getSecurityShiftWindow(variant);
    return window?.startTime ?? '';
  };

  const availableMonths = useMemo(
    () => MONTH_WINDOW.map((offset) => addMonths(baseDate, offset)),
    [baseDate],
  );

  const selectedMonth = availableMonths[selectedIndex];
  const selectedMonthLabel = useMemo(
    () => formatMonth(selectedMonth),
    [selectedMonth],
  );
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
            securityAssignments,
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
      securityAssignments,
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
      if (!showSecurity && isSecurityShiftEventType(event.variant)) {
        return false;
      }
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
    const defaultTime = resolveDefaultTime(event.variant);
    setEditingEventId(event.id);
    setEditTime(override?.time ?? defaultTime);
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
    const timeValue = isSecurityShiftEventType(event.variant) ? '' : editTime;
    setEditMessage(null);
    startTransition(async () => {
      const result = await updateScheduleEventOverride({
        date: event.dateKey,
        eventType: event.variant,
        time: timeValue,
        isCanceled: editCanceled,
        movedToDate: nextMoveDate,
        overrideUserId,
        overrideUserName,
      });
      if (result.success) {
        setLocalOverrides((prev) => ({
          ...prev,
          [key]: {
            time: timeValue.trim() ? timeValue.trim() : null,
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
        const nextDefaultTime = resolveDefaultTime(event.variant);
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
        securityAssignments,
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
    <div className='rounded-2xl border border-border bg-card/70 p-4 shadow-sm sm:p-7 lg:p-8'>
      <CalendarHeader
        monthLabel={selectedMonthLabel}
        nextRefreshLabel={nextRefreshLabel}
        showRefreshNotice={Boolean(refreshNotice)}
        showStandup={showStandup}
        showSecurity={showSecurity}
        showDemo={showDemo}
        showOnlyMine={showOnlyMine}
        currentUserId={currentUserId}
        onToggleStandup={() => setShowStandup((prev) => !prev)}
        onToggleSecurity={() => setShowSecurity((prev) => !prev)}
        onToggleDemo={() => setShowDemo((prev) => !prev)}
        onToggleOnlyMine={setShowOnlyMine}
        onPrev={handlePrev}
        onNext={handleNext}
        isPrevDisabled={selectedIndex === 0}
        isNextDisabled={selectedIndex === availableMonths.length - 1}
      />

      <CalendarMonthSelector
        months={availableMonths}
        selectedIndex={selectedIndex}
        onSelect={setSelectedIndex}
      />

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
