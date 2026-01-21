import { currentUser } from '@clerk/nextjs/server';

import { HostHubSubHeader } from '@/components/header/hosthub-subheader';
import { HostHubCalendar } from './_components/hosthub-calendar';
import { checkRole } from '@/server/auth/check-role';
import {
  ensureDemoDayAssignmentsForWindow,
  getEligibleDemoDayRoster,
  ensureSecurityShiftAssignmentsForWindow,
  ensureStandupAssignmentsForWindow,
  getHostHubRoster,
  getEligibleSecurityShiftRoster,
  getEligibleStandupRoster,
  getScheduleRuleConfig,
  getScheduleRefreshNotice,
  listScheduleEventOverridesInRange,
} from '@/server/services/hosthub-schedule';

export const metadata = {
  title: 'Calendar | HostHub',
};

export default async function HostHubCalendarPage() {
  const user = await currentUser();
  const isAdmin = await checkRole('admin');
  const now = new Date();
  const eligibleRoster = await getEligibleDemoDayRoster();
  const eligibleStandupRoster = await getEligibleStandupRoster();
  const eligibleSecurityRoster = await getEligibleSecurityShiftRoster();
  const demoAssignments = await ensureDemoDayAssignmentsForWindow({
    baseDate: now,
    eligibleUsers: eligibleRoster,
  });
  const standupAssignments = await ensureStandupAssignmentsForWindow({
    baseDate: now,
    eligibleUsers: eligibleStandupRoster,
  });
  const securityAssignments = await ensureSecurityShiftAssignmentsForWindow({
    baseDate: now,
    eligibleUsers: eligibleSecurityRoster,
  });
  const roster = isAdmin ? await getHostHubRoster() : [];
  const demoRule = await getScheduleRuleConfig('demo-day');
  const standupRule = await getScheduleRuleConfig('standup');
  const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 4, 0);
  const overrides = await listScheduleEventOverridesInRange({
    startDate,
    endDate,
  });
  const refreshNotice = await getScheduleRefreshNotice(now);
  const eventOverrides = Object.fromEntries(
    overrides.map((override) => [
      `${override.eventType}-${override.date}`,
      {
        movedToDate: override.movedToDate,
        time: override.time,
        isCanceled: override.isCanceled,
        overrideUserId: override.overrideUserId,
        overrideUserName: override.overrideUserName,
        updatedAt: override.updatedAt,
      },
    ]),
  );

  return (
    <section className='mx-auto w-full max-w-7xl px-4 py-16 space-y-10'>
      <HostHubSubHeader />
      <HostHubCalendar
        demoAssignments={demoAssignments}
        standupAssignments={standupAssignments}
        securityAssignments={securityAssignments}
        currentUserId={user?.id ?? null}
        isAdmin={isAdmin}
        demoDefaultTime={demoRule.defaultTime}
        standupDefaultTime={standupRule.defaultTime}
        eventOverrides={eventOverrides}
        refreshNotice={refreshNotice}
        roster={roster}
      />
    </section>
  );
}
