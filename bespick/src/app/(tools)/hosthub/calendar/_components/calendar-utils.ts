import { getEventOverrideId } from '@/lib/hosthub-events';
import {
  isFirstWednesday,
  resolveEventTime,
} from '@/lib/hosthub-schedule-utils';
import type { CalendarDay, CalendarEvent, DemoMoveEntry, EventOverride } from './calendar-types';

const STANDUP_DAYS = new Set([1, 4]);

const pad2 = (value: number) => value.toString().padStart(2, '0');

export const formatMonth = (date: Date) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date);

export const dateKey = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate(),
  )}`;

export const parseDateKey = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  if ([year, month, day].some((part) => Number.isNaN(part))) return null;
  return new Date(year, month - 1, day);
};

export const addMonths = (date: Date, offset: number) =>
  new Date(date.getFullYear(), date.getMonth() + offset, 1);

export const formatFullDate = (date: Date) =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);

export const buildCalendar = (date: Date): CalendarDay[] => {
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

const resolveAssignee = (
  assignment: { userId: string | null; userName: string } | undefined,
  override: EventOverride | undefined,
) => {
  const name = override?.overrideUserName ?? assignment?.userName ?? 'TBD';
  const id = override?.overrideUserId ?? assignment?.userId ?? null;
  return { name, id };
};

export const getEventsForDate = (
  date: Date,
  demoAssignments: Record<string, { userId: string | null; userName: string }>,
  standupAssignments: Record<
    string,
    { userId: string | null; userName: string }
  >,
  eventOverrides: Record<string, EventOverride>,
  demoMoveTargets: Map<string, DemoMoveEntry[]>,
  demoMoveSources: Set<string>,
  demoDefaultTime: string,
  standupDefaultTime: string,
) => {
  const events: CalendarEvent[] = [];
  if (STANDUP_DAYS.has(date.getDay())) {
    const key = dateKey(date);
    const standupAssignment = standupAssignments[key];
    const override = eventOverrides[getEventOverrideId(key, 'standup')];
    const assignee = resolveAssignee(standupAssignment, override);
    events.push({
      id: `standup-${key}`,
      dateKey: key,
      label: 'Standup',
      time: resolveEventTime(override?.time, standupDefaultTime),
      assignee: assignee.name,
      assigneeId: assignee.id,
      variant: 'standup',
      isCanceled: override?.isCanceled ?? false,
    });
  }
  const key = dateKey(date);
  const movedDemoEntries = demoMoveTargets.get(key);
  if (movedDemoEntries) {
    movedDemoEntries.forEach((movedDemo) => {
      const assignment = demoAssignments[movedDemo.sourceDate];
      const assignee = resolveAssignee(assignment, movedDemo.override);
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
        assignee: assignee.name,
        assigneeId: assignee.id,
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
    const override = eventOverrides[getEventOverrideId(key, 'demo')];
    const assignee = resolveAssignee(assignment, override);
    events.push({
      id: `demo-${key}`,
      dateKey: key,
      label: 'Demo Day',
      time: resolveEventTime(override?.time, demoDefaultTime),
      assignee: assignee.name,
      assigneeId: assignee.id,
      variant: 'demo',
      isCanceled: override?.isCanceled ?? false,
    });
  }
  return events;
};
