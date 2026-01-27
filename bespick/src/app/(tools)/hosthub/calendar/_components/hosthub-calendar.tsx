'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import {
  clearScheduleEventOverride,
  getScheduleEventOverrideHistory,
  updateScheduleEventOverride,
  type ScheduleEventOverrideHistoryEntry,
} from '@/server/actions/hosthub-event-overrides';
import {
  getEventOverrideId,
  getSecurityShiftWindow,
  isSecurityShiftEventType,
  type HostHubEventType,
} from '@/lib/hosthub-events';
import { formatShortDateLabel } from '@/lib/hosthub-schedule-utils';
import { useMetadataOptions } from '@/components/metadata/metadata-options-provider';

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
import {
  EditHistoryModal,
  type EditHistoryEntry,
} from './edit-history-modal';

const BUILDING_892_WEEK_START_DAY = 1;

const getWeekStart = (date: Date) => {
  const start = new Date(date);
  const offset =
    (start.getDay() - BUILDING_892_WEEK_START_DAY + 7) % 7;
  start.setDate(start.getDate() - offset);
  start.setHours(0, 0, 0, 0);
  return start;
};

const getWeekStartsForMonth = (date: Date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const cursor = getWeekStart(start);
  const weeks: Date[] = [];
  while (cursor <= end) {
    weeks.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  return weeks;
};

type HostHubCalendarProps = {
  demoAssignments: Record<string, { userId: string | null; userName: string }>;
  standupAssignments: Record<string, { userId: string | null; userName: string }>;
  securityAssignments: Record<
    string,
    { userId: string | null; userName: string }
  >;
  building892Assignments: Record<string, { team: string }>;
  currentUserId: string | null;
  currentUserTeam?: string | null;
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
  building892Assignments,
  currentUserId,
  currentUserTeam = null,
  isAdmin,
  demoDefaultTime,
  standupDefaultTime,
  eventOverrides,
  refreshNotice = null,
  roster,
}: HostHubCalendarProps) {
  const { teamOptions } = useMetadataOptions();
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
  const [buildingEditWeek, setBuildingEditWeek] = useState<string | null>(null);
  const [buildingEditTeam, setBuildingEditTeam] = useState('');
  const [buildingEditMessage, setBuildingEditMessage] = useState<string | null>(
    null,
  );
  const [historyEntries, setHistoryEntries] = useState<EditHistoryEntry[]>([]);
  const [historyTitle, setHistoryTitle] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
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
  const teamLabelMap = useMemo(() => {
    return new Map(
      teamOptions.map((option) => [option.value, option.label]),
    );
  }, [teamOptions]);
  const eligibleTeamOptions = useMemo(
    () =>
      teamOptions.filter(
        (option) =>
          option.value.trim().length > 0 &&
          option.value.trim().toLowerCase() !== 'n/a',
      ),
    [teamOptions],
  );
  const resolveDefaultTime = (variant: HostHubEventType) => {
    if (variant === 'standup') return standupDefaultTime;
    if (variant === 'demo') return demoDefaultTime;
    if (variant === 'building-892') return '';
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
  const building892Weeks = useMemo(
    () => getWeekStartsForMonth(selectedMonth),
    [selectedMonth],
  );
  const building892Entries = useMemo(() => {
    return building892Weeks.map((weekStart) => {
      const weekKey = dateKey(weekStart);
      const assignment = building892Assignments[weekKey];
      const overrideKey = getEventOverrideId(weekKey, 'building-892');
      const override = localOverrides[overrideKey];
      const teamValue = override?.overrideUserId ?? assignment?.team ?? null;
      const teamLabel =
        override?.overrideUserName ??
        (teamValue ? teamLabelMap.get(teamValue) ?? teamValue : 'TBD');
      const displayTeam =
        teamValue && teamValue !== 'TBD' ? teamLabel : 'TBD';
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 4);
      return {
        weekKey,
        weekStart,
        weekEnd,
        teamValue,
        teamLabel: displayTeam,
        override,
      };
    });
  }, [building892Weeks, building892Assignments, localOverrides, teamLabelMap]);
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
    setBuildingEditWeek(null);
    setBuildingEditTeam('');
    setBuildingEditMessage(null);
    setHistoryEntries([]);
    setHistoryTitle(null);
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
      ? event.variant === 'building-892'
        ? teamLabelMap.get(overrideUserId) ?? overrideUserId
        : rosterMap.get(overrideUserId) ?? event.assignee ?? 'Unknown'
      : null;
    const timeValue =
      isSecurityShiftEventType(event.variant) ||
      event.variant === 'building-892'
        ? ''
        : editTime;
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

  const openBuildingEdit = (weekKey: string) => {
    const override = localOverrides[getEventOverrideId(weekKey, 'building-892')];
    setBuildingEditWeek(weekKey);
    setBuildingEditTeam(override?.overrideUserId ?? '');
    setBuildingEditMessage(null);
  };

  const closeBuildingEdit = () => {
    setBuildingEditWeek(null);
    setBuildingEditTeam('');
    setBuildingEditMessage(null);
  };

  const saveBuildingEdit = (weekKey: string) => {
    const trimmedTeam = buildingEditTeam.trim();
    const overrideKey = getEventOverrideId(weekKey, 'building-892');
    setBuildingEditMessage(null);
    startTransition(async () => {
      if (!trimmedTeam) {
        const result = await clearScheduleEventOverride({
          date: weekKey,
          eventType: 'building-892',
        });
        if (result.success) {
          setLocalOverrides((prev) => {
            const next = { ...prev };
            delete next[overrideKey];
            return next;
          });
          setBuildingEditMessage(result.message);
          setBuildingEditTeam('');
        } else {
          setBuildingEditMessage(result.message);
        }
        return;
      }

      const overrideUserName =
        teamLabelMap.get(trimmedTeam) ?? trimmedTeam;
      const result = await updateScheduleEventOverride({
        date: weekKey,
        eventType: 'building-892',
        time: '',
        isCanceled: false,
        movedToDate: null,
        overrideUserId: trimmedTeam,
        overrideUserName,
      });
      if (result.success) {
        setLocalOverrides((prev) => ({
          ...prev,
          [overrideKey]: {
            time: null,
            isCanceled: false,
            movedToDate: null,
            overrideUserId: trimmedTeam,
            overrideUserName,
          },
        }));
        setBuildingEditMessage(result.message);
      } else {
        setBuildingEditMessage(result.message);
      }
    });
  };

  const resetBuildingEdit = (weekKey: string) => {
    const overrideKey = getEventOverrideId(weekKey, 'building-892');
    setBuildingEditMessage(null);
    startTransition(async () => {
      const result = await clearScheduleEventOverride({
        date: weekKey,
        eventType: 'building-892',
      });
      if (result.success) {
        setLocalOverrides((prev) => {
          const next = { ...prev };
          delete next[overrideKey];
          return next;
        });
        setBuildingEditMessage(result.message);
        setBuildingEditTeam('');
      } else {
        setBuildingEditMessage(result.message);
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

  const formatDateKeyLabel = (value: string | null) => {
    if (!value) return 'None';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return formatShortDateLabel(parsed);
  };

  const formatHistoryEntries = (
    entries: ScheduleEventOverrideHistoryEntry[],
  ) => {
    return entries.map((entry) => {
      const changes = [];
      const isBuilding892 = entry.eventType === 'building-892';
      const previousAssignee = entry.previousOverrideUserId
        ? entry.previousOverrideUserName ??
          teamLabelMap.get(entry.previousOverrideUserId) ??
          entry.previousOverrideUserId
        : isBuilding892
          ? 'Assigned team'
          : 'Assigned host';
      const nextAssignee = entry.nextOverrideUserId
        ? entry.nextOverrideUserName ??
          teamLabelMap.get(entry.nextOverrideUserId) ??
          entry.nextOverrideUserId
        : isBuilding892
          ? 'Assigned team'
          : 'Assigned host';
      if (previousAssignee !== nextAssignee) {
        changes.push({
          label: isBuilding892 ? 'Team' : 'Assignee',
          from: previousAssignee,
          to: nextAssignee,
        });
      }

      const previousTime = entry.previousTime ?? 'Default';
      const nextTime = entry.nextTime ?? 'Default';
      if (previousTime !== nextTime && !isBuilding892) {
        changes.push({
          label: 'Time',
          from: previousTime,
          to: nextTime,
        });
      }

      const previousMove = formatDateKeyLabel(entry.previousMovedToDate ?? null);
      const nextMove = formatDateKeyLabel(entry.nextMovedToDate ?? null);
      if (previousMove !== nextMove && entry.eventType === 'demo') {
        changes.push({
          label: 'Move date',
          from: previousMove,
          to: nextMove,
        });
      }

      const previousStatus =
        entry.previousIsCanceled === true ? 'Canceled' : 'Active';
      const nextStatus =
        entry.nextIsCanceled === true ? 'Canceled' : 'Active';
      if (previousStatus !== nextStatus) {
        changes.push({
          label: 'Status',
          from: previousStatus,
          to: nextStatus,
        });
      }

      return {
        id: entry.id,
        changedAt: entry.changedAt,
        changedByName: entry.changedByName,
        changes: changes.length
          ? changes
          : [
              {
                label: 'Update',
                from: 'No changes captured',
                to: 'No changes captured',
              },
            ],
      };
    });
  };

  const openHistory = (weekKey: string) => {
    setHistoryTitle(`892 Manning • Week of ${formatShortDateLabel(new Date(weekKey))}`);
    setIsHistoryOpen(true);
    startTransition(async () => {
      const result = await getScheduleEventOverrideHistory({
        date: weekKey,
        eventType: 'building-892',
      });
      if (result.success) {
        setHistoryEntries(formatHistoryEntries(result.entries));
      } else {
        setHistoryEntries([]);
      }
    });
  };

  const closeHistory = () => {
    setIsHistoryOpen(false);
    setHistoryEntries([]);
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
      <div className='flex flex-col gap-6'>
        <div className='min-w-0 space-y-6'>
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
            currentUserTeam={currentUserTeam}
            getEvents={getDayEvents}
            onDayClick={handleDayClick}
          />
        </div>

        <details
          id='building-892-panel'
          className='rounded-2xl border border-border bg-background/70 p-4 shadow-sm'
          open
        >
          <summary className='flex cursor-pointer list-none items-center justify-between text-left'>
            <div>
              <p className='text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground'>
                892 Manning
              </p>
              <h3 className='mt-2 text-lg font-semibold text-foreground'>
                Weekly team assignments
              </h3>
              <p className='mt-2 text-xs text-muted-foreground'>
                Assigned teams work at 892 Monday through Friday and are
                excluded from other HostHub shifts that week.
              </p>
            </div>
            <span className='ml-4 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground'>
              Toggle
            </span>
          </summary>
          <div className='mt-4 space-y-3'>
            {building892Entries.map((entry) => {
              const rangeLabel = `${formatShortDateLabel(
                entry.weekStart,
              )} - ${formatShortDateLabel(entry.weekEnd)}`;
              const hasOverride = Boolean(entry.override);
              const isCanceled = entry.override?.isCanceled ?? false;
              const isEditing = buildingEditWeek === entry.weekKey;
              const teamDisplay = isCanceled
                ? 'Canceled'
                : entry.teamLabel;
              return (
                <div
                  key={entry.weekKey}
                  className={`rounded-xl border border-border bg-background px-3 py-3 ${
                    isCanceled ? 'opacity-60' : ''
                  }`}
                >
                  <div className='flex items-start justify-between gap-3'>
                    <div>
                      <p className='text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground'>
                        Week of {formatShortDateLabel(entry.weekStart)}
                      </p>
                      <p className='mt-1 text-sm font-semibold text-foreground'>
                        {teamDisplay}
                      </p>
                      <p className='text-xs text-muted-foreground'>
                        {rangeLabel} • Mon-Fri
                      </p>
                    </div>
                    {hasOverride ? (
                      <button
                        type='button'
                        onClick={() => openHistory(entry.weekKey)}
                        className='rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-700 transition hover:bg-teal-500/20'
                      >
                        Updated
                      </button>
                    ) : null}
                  </div>

                  {isAdmin ? (
                    <div className='mt-3 border-t border-border/60 pt-3'>
                      {!isEditing ? (
                        <button
                          type='button'
                          onClick={() => openBuildingEdit(entry.weekKey)}
                          className='rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground transition hover:bg-secondary/70'
                        >
                          Change team
                        </button>
                      ) : (
                        <div className='space-y-2'>
                          <label className='flex flex-col gap-2 text-xs font-semibold text-muted-foreground'>
                            Team override
                            <select
                              value={buildingEditTeam}
                              onChange={(eventValue) =>
                                setBuildingEditTeam(eventValue.target.value)
                              }
                              disabled={isSaving}
                              className='w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60'
                            >
                              <option value=''>
                                Use assigned team ({entry.teamLabel})
                              </option>
                              {eligibleTeamOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className='flex flex-wrap items-center gap-2'>
                            <button
                              type='button'
                              onClick={() =>
                                saveBuildingEdit(entry.weekKey)
                              }
                              disabled={isSaving}
                              className='rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60'
                            >
                              {isSaving ? 'Saving...' : 'Save'}
                            </button>
                            {hasOverride ? (
                              <button
                                type='button'
                                onClick={() =>
                                  resetBuildingEdit(entry.weekKey)
                                }
                                disabled={isSaving}
                                className='rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary/70 disabled:cursor-not-allowed disabled:opacity-60'
                              >
                                Reset
                              </button>
                            ) : null}
                            <button
                              type='button'
                              onClick={closeBuildingEdit}
                              className='rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-secondary/70'
                            >
                              Close
                            </button>
                          </div>
                          {buildingEditMessage ? (
                            <p className='text-xs text-muted-foreground'>
                              {buildingEditMessage}
                            </p>
                          ) : null}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </details>
      </div>

      {selectedDate ? (
        <ScheduleDetailsModal
          selectedDate={selectedDate}
          events={currentEvents}
          currentUserId={currentUserId}
          currentUserTeam={currentUserTeam}
          isAdmin={isAdmin}
          rosterOptions={rosterOptions}
          teamOptions={eligibleTeamOptions}
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
      {isHistoryOpen && historyTitle ? (
        <EditHistoryModal
          title={historyTitle}
          entries={historyEntries}
          onClose={closeHistory}
        />
      ) : null}
    </div>
  );
}
