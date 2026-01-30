import { currentUser } from '@clerk/nextjs/server';

import { HostHubSubHeader } from '@/components/header/hosthub-subheader';
import { MyScheduleList, type ShiftEntry } from './_components/my-schedule-list';
import { HostHubAutoRefresh } from './_components/hosthub-auto-refresh';
import {
  DEMO_DAY_RESOURCES,
  SECURITY_SHIFT_RESOURCES,
  STANDUP_RESOURCES,
} from '@/lib/hosthub-docs';
import {
  SECURITY_SHIFT_EVENT_TYPES,
  getEventOverrideId,
  getSecurityShiftWindow,
} from '@/lib/hosthub-events';
import {
  formatTimeRange,
  formatShortDateLabel,
  isSecondWednesday,
  resolveEventTime,
} from '@/lib/hosthub-schedule-utils';
import {
  buildBuilding892BlockedUsers,
  ensureBuilding892AssignmentsForWindow,
  ensureDemoDayAssignmentsForWindow,
  getEligibleDemoDayRoster,
  ensureSecurityShiftAssignmentsForWindow,
  ensureStandupAssignmentsForWindow,
  getBuilding892TeamRoster,
  getHostHubRoster,
  getEligibleSecurityShiftRoster,
  getEligibleStandupRoster,
  getScheduleRuleConfig,
  listBuilding892AssignmentsInRange,
  listDemoDayAssignmentsInRange,
  listSecurityShiftAssignmentsInRange,
  listScheduleEventOverridesInRange,
  listStandupAssignmentsInRange,
  toDateKey,
} from '@/server/services/hosthub-schedule';
import { listShiftSwapRequestsForUser } from '@/server/services/hosthub-shift-swaps';

export const metadata = {
  title: 'HostHub | BESPIN Holocron',
};

const SECURITY_SHIFT_DAYS = new Set([1, 2, 3, 4, 5]);

export default async function HostHubPage() {
  const user = await currentUser();
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  const overridesStart = new Date(startDate);
  overridesStart.setDate(overridesStart.getDate() - 7);
  const currentTeam =
    typeof user?.publicMetadata?.team === 'string'
      ? user.publicMetadata.team
      : null;

  const currentShifts: ShiftEntry[] = [];
  const futureShifts: ShiftEntry[] = [];
  const pastShifts: ShiftEntry[] = [];
  const building892Weeks: Array<{
    id: string;
    label: string;
    range: string;
    weekStart: string;
  }> = [];
  let currentTeamLabel: string | null = null;
  const todayKey = toDateKey(now);
  const roster = user ? await getHostHubRoster() : [];
  const isShiftTimePast = (timeLabel: string) => {
    if (!timeLabel || timeLabel === 'TBD') return false;
    const [startRaw, endRaw] = timeLabel.split('-').map((value) => value.trim());
    const endValue = endRaw || startRaw;
    const match = endValue.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return false;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return false;
    const endAt = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hours,
      minutes,
      0,
      0,
    );
    return now >= endAt;
  };

  if (user) {
    const eligibleRoster = await getEligibleDemoDayRoster();
    const eligibleStandupRoster = await getEligibleStandupRoster();
    const eligibleSecurityRoster = await getEligibleSecurityShiftRoster();
    const building892Roster = await getBuilding892TeamRoster();
    const trimmedTeam = currentTeam?.trim() ?? '';
    if (trimmedTeam) {
      currentTeamLabel =
        building892Roster.teamLabels.get(trimmedTeam) ?? trimmedTeam;
    }
    const overrides = await listScheduleEventOverridesInRange({
      startDate: overridesStart,
      endDate,
    });
    const building892Overrides = new Map(
      overrides
        .filter((override) => override.eventType === 'building-892')
        .map((override) => [override.date, override]),
    );
    const building892Assignments = await ensureBuilding892AssignmentsForWindow({
      baseDate: now,
      eligibleTeams: building892Roster.eligibleTeams,
    });
    const blockedUsersByWeek = buildBuilding892BlockedUsers({
      assignments: building892Assignments,
      teamMembers: building892Roster.teamMembers,
      overrides: building892Overrides,
    });
    await ensureDemoDayAssignmentsForWindow({
      baseDate: now,
      eligibleUsers: eligibleRoster,
      blockedUsersByWeek,
    });
    await ensureStandupAssignmentsForWindow({
      baseDate: now,
      eligibleUsers: eligibleStandupRoster,
      blockedUsersByWeek,
    });
    await ensureSecurityShiftAssignmentsForWindow({
      baseDate: now,
      eligibleUsers: eligibleSecurityRoster,
      blockedUsersByWeek,
    });
    const demoRule = await getScheduleRuleConfig('demo-day');
    const standupRule = await getScheduleRuleConfig('standup');
    const demoAssignments = await listDemoDayAssignmentsInRange({
      startDate,
      endDate,
    });
    const standupAssignments = await listStandupAssignmentsInRange({
      startDate,
      endDate,
    });
    const securityAssignments = await listSecurityShiftAssignmentsInRange({
      startDate,
      endDate,
    });
    const monthEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 2,
      0,
    );
    const building892AssignmentsInMonth =
      currentTeam && currentTeam.trim().length > 0
        ? await listBuilding892AssignmentsInRange({
            startDate,
            endDate: monthEnd,
          })
        : [];
    const overridesByKey = new Map(
      overrides.map((override) => [
        getEventOverrideId(override.date, override.eventType),
        override,
      ]),
    );
    const movedDemoTargets = new Map<
      string,
      (typeof overrides)[number][]
    >();
    const movedDemoSources = new Set<string>();
    overrides.forEach((override) => {
      if (override.eventType !== 'demo' || !override.movedToDate) return;
      const entries = movedDemoTargets.get(override.movedToDate) ?? [];
      entries.push(override);
      movedDemoTargets.set(override.movedToDate, entries);
      movedDemoSources.add(override.date);
    });
    const demoAssignmentsByDate = new Map(
      demoAssignments.map((entry) => [entry.date, entry]),
    );
    const standupAssignmentsByDate = new Map(
      standupAssignments.map((entry) => [entry.date, entry]),
    );
    const securityAssignmentsById = new Map(
      securityAssignments.map((entry) => [entry.id, entry]),
    );
    if (currentTeam && currentTeam.trim().length > 0) {
      building892AssignmentsInMonth.forEach((entry) => {
        const override = overridesByKey.get(
          getEventOverrideId(entry.weekStart, 'building-892'),
        );
        if (override?.isCanceled) return;
        const effectiveTeam =
          override?.overrideUserId ?? entry.team ?? null;
        if (!effectiveTeam || effectiveTeam !== currentTeam) return;
        const weekStart = new Date(entry.weekStart);
        if (Number.isNaN(weekStart.getTime())) return;
        if (weekStart.getMonth() !== now.getMonth()) return;
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 4);
        building892Weeks.push({
          id: `building-892-${entry.weekStart}`,
          label: `Week of ${formatShortDateLabel(weekStart)}`,
          range: `${formatShortDateLabel(weekStart)} - ${formatShortDateLabel(
            weekEnd,
          )}`,
          weekStart: entry.weekStart,
        });
      });
    }

    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const nextMonthDate = new Date(currentYear, currentMonth + 1, 1);
    const nextMonth = nextMonthDate.getMonth();
    const nextYear = nextMonthDate.getFullYear();

    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      const dateLabel = formatShortDateLabel(cursor);
      const dateKey = toDateKey(cursor);
      const isCurrentMonth =
        cursor.getFullYear() === currentYear &&
        cursor.getMonth() === currentMonth;
      const isNextMonth =
        cursor.getFullYear() === nextYear &&
        cursor.getMonth() === nextMonth;
      const resolveShiftBucket = (timeLabel: string) => {
        if (dateKey < todayKey) return pastShifts;
        if (dateKey > todayKey) {
          return isCurrentMonth ? currentShifts : isNextMonth ? futureShifts : futureShifts;
        }
        return isShiftTimePast(timeLabel) ? pastShifts : currentShifts;
      };

      const standupAssignment = standupAssignmentsByDate.get(dateKey);
      const standupOverride = overridesByKey.get(
        getEventOverrideId(dateKey, 'standup'),
      );
      const standupUserId =
        standupOverride?.overrideUserId ?? standupAssignment?.userId ?? null;
      const standupTime = resolveEventTime(
        standupOverride?.time,
        standupRule.defaultTime,
      );
      const standupCanceled = standupOverride?.isCanceled ?? false;
      if (standupUserId === user.id) {
        resolveShiftBucket(standupTime).push({
          id: `standup-${dateKey}`,
          date: dateLabel,
          time: standupTime,
          details: standupCanceled
            ? 'Standup • Canceled'
            : 'Standup • Assigned to you',
          resources: STANDUP_RESOURCES,
          eventType: 'standup',
          eventDate: dateKey,
        });
      }

      if (SECURITY_SHIFT_DAYS.has(cursor.getDay())) {
        SECURITY_SHIFT_EVENT_TYPES.forEach((eventType) => {
          const window = getSecurityShiftWindow(eventType);
          if (!window) return;
          const securityId = getEventOverrideId(dateKey, eventType);
          const assignment = securityAssignmentsById.get(securityId);
          const override = overridesByKey.get(securityId);
          const securityUserId =
            override?.overrideUserId ?? assignment?.userId ?? null;
          const time = formatTimeRange(
            window.startTime,
            window.endTime,
          );
          const canceled = override?.isCanceled ?? false;
          if (securityUserId === user.id) {
            resolveShiftBucket(time).push({
              id: securityId,
              date: dateLabel,
              time,
              details: canceled
                ? `Security Shift (${window.label}) • Canceled`
                : `Security Shift (${window.label}) • Assigned to you`,
              resources: SECURITY_SHIFT_RESOURCES,
              eventType,
              eventDate: dateKey,
            });
          }
        });
      }

      const movedDemoOverrides = movedDemoTargets.get(dateKey);
      if (movedDemoOverrides) {
        movedDemoOverrides.forEach((movedDemoOverride) => {
          const assignment = demoAssignmentsByDate.get(movedDemoOverride.date);
          const demoUserId =
            movedDemoOverride.overrideUserId ??
            assignment?.userId ??
            null;
          const demoTime = resolveEventTime(
            movedDemoOverride?.time,
            demoRule.defaultTime,
          );
          const demoCanceled = movedDemoOverride?.isCanceled ?? false;
          if (demoUserId === user.id) {
            resolveShiftBucket(demoTime).push({
              id: `demo-${movedDemoOverride.date}`,
              date: dateLabel,
              time: demoTime,
              details: demoCanceled
                ? 'Demo Day • Canceled'
                : 'Demo Day • Assigned to you',
              resources: DEMO_DAY_RESOURCES,
              eventType: 'demo',
              eventDate: movedDemoOverride.date,
            });
          }
        });
      }

      if (isSecondWednesday(cursor) && !movedDemoSources.has(dateKey)) {
        const assignment = demoAssignmentsByDate.get(dateKey);
        const demoOverride = overridesByKey.get(
          getEventOverrideId(dateKey, 'demo'),
        );
        const demoUserId =
          demoOverride?.overrideUserId ?? assignment?.userId ?? null;
        const demoTime = resolveEventTime(
          demoOverride?.time,
          demoRule.defaultTime,
        );
        const demoCanceled = demoOverride?.isCanceled ?? false;
        if (demoUserId === user.id) {
          resolveShiftBucket(demoTime).push({
            id: `demo-${dateKey}`,
            date: dateLabel,
            time: demoTime,
            details: demoCanceled
              ? 'Demo Day • Canceled'
              : 'Demo Day • Assigned to you',
            resources: DEMO_DAY_RESOURCES,
            eventType: 'demo',
            eventDate: dateKey,
          });
        }
      }

      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const swapRequests =
    user
      ? await listShiftSwapRequestsForUser({
          userId: user.id,
          startDate,
          endDate,
        })
      : [];

  return (
    <section className='page-shell space-y-10'>
      <HostHubSubHeader />
      {!user ? (
        <div className='rounded-2xl border border-border bg-card/70 p-6 text-sm text-muted-foreground shadow-sm'>
          Sign in to view your schedule.
        </div>
      ) : (
        <>
          <HostHubAutoRefresh />
          <MyScheduleList
            currentShifts={currentShifts}
            futureShifts={futureShifts}
            pastShifts={pastShifts}
            building892Weeks={building892Weeks}
            currentTeamLabel={currentTeamLabel}
            roster={roster}
            swapRequests={swapRequests}
            currentUserId={user?.id ?? null}
          />
        </>
      )}
    </section>
  );
}
