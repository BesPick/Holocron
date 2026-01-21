import { currentUser } from '@clerk/nextjs/server';

import { HostHubSubHeader } from '@/components/header/hosthub-subheader';
import { MyScheduleList, type ShiftEntry } from './_components/my-schedule-list';
import {
  DEMO_DAY_RESOURCES,
  STANDUP_RESOURCES,
} from '@/lib/hosthub-docs';
import { getEventOverrideId } from '@/lib/hosthub-events';
import {
  formatShortDateLabel,
  isFirstWednesday,
  resolveEventTime,
} from '@/lib/hosthub-schedule-utils';
import {
  ensureDemoDayAssignmentsForWindow,
  getEligibleDemoDayRoster,
  ensureStandupAssignmentsForWindow,
  getEligibleStandupRoster,
  getScheduleRuleConfig,
  listDemoDayAssignmentsInRange,
  listScheduleEventOverridesInRange,
  listStandupAssignmentsInRange,
  toDateKey,
} from '@/server/services/hosthub-schedule';

export const metadata = {
  title: 'HostHub | BESPIN Holocron',
};

export default async function HostHubPage() {
  const user = await currentUser();
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 4, 0);

  const currentShifts: ShiftEntry[] = [];
  const pastShifts: ShiftEntry[] = [];
  const todayKey = toDateKey(now);

  if (user) {
    const eligibleRoster = await getEligibleDemoDayRoster();
    const eligibleStandupRoster = await getEligibleStandupRoster();
    await ensureDemoDayAssignmentsForWindow({
      baseDate: now,
      eligibleUsers: eligibleRoster,
    });
    await ensureStandupAssignmentsForWindow({
      baseDate: now,
      eligibleUsers: eligibleStandupRoster,
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
    const overrides = await listScheduleEventOverridesInRange({
      startDate,
      endDate,
    });
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

    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      const dateLabel = formatShortDateLabel(cursor);
      const dateKey = toDateKey(cursor);
      const targetShifts =
        dateKey < todayKey ? pastShifts : currentShifts;

      const standupAssignment = standupAssignmentsByDate.get(dateKey);
      const standupOverride = overridesByKey.get(
        getEventOverrideId(dateKey, 'standup'),
      );
      const standupTime = resolveEventTime(
        standupOverride?.time,
        standupRule.defaultTime,
      );
      const standupCanceled = standupOverride?.isCanceled ?? false;
      if (standupAssignment?.userId === user.id) {
        targetShifts.push({
          id: `standup-${dateKey}`,
          date: dateLabel,
          time: standupTime,
          details: standupCanceled
            ? 'Standup • Canceled'
            : 'Standup • Assigned to you',
          resources: STANDUP_RESOURCES,
        });
      }

      const movedDemoOverrides = movedDemoTargets.get(dateKey);
      if (movedDemoOverrides) {
        movedDemoOverrides.forEach((movedDemoOverride) => {
          const assignment = demoAssignmentsByDate.get(movedDemoOverride.date);
          const demoTime = resolveEventTime(
            movedDemoOverride?.time,
            demoRule.defaultTime,
          );
          const demoCanceled = movedDemoOverride?.isCanceled ?? false;
          if (assignment?.userId === user.id) {
            targetShifts.push({
              id: `demo-${movedDemoOverride.date}`,
              date: dateLabel,
              time: demoTime,
              details: demoCanceled
                ? 'Demo Day • Canceled'
                : 'Demo Day • Assigned to you',
              resources: DEMO_DAY_RESOURCES,
            });
          }
        });
      }

      if (isFirstWednesday(cursor) && !movedDemoSources.has(dateKey)) {
        const assignment = demoAssignmentsByDate.get(dateKey);
        const demoOverride = overridesByKey.get(
          getEventOverrideId(dateKey, 'demo'),
        );
        const demoTime = resolveEventTime(
          demoOverride?.time,
          demoRule.defaultTime,
        );
        const demoCanceled = demoOverride?.isCanceled ?? false;
        if (assignment?.userId === user.id) {
          targetShifts.push({
            id: `demo-${dateKey}`,
            date: dateLabel,
            time: demoTime,
            details: demoCanceled
              ? 'Demo Day • Canceled'
              : 'Demo Day • Assigned to you',
            resources: DEMO_DAY_RESOURCES,
          });
        }
      }

      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return (
    <section className='mx-auto w-full max-w-5xl px-4 py-16 space-y-10'>
      <HostHubSubHeader />
      {!user ? (
        <div className='rounded-2xl border border-border bg-card/70 p-6 text-sm text-muted-foreground shadow-sm'>
          Sign in to view your schedule.
        </div>
      ) : (
        <MyScheduleList
          currentShifts={currentShifts}
          pastShifts={pastShifts}
        />
      )}
    </section>
  );
}
