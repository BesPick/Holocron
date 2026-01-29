import { currentUser } from '@clerk/nextjs/server';

import { HostHubSubHeader } from '@/components/header/hosthub-subheader';
import { HostHubCalendar } from './_components/hosthub-calendar';
import { checkRole } from '@/server/auth/check-role';
import {
  buildBuilding892BlockedUsers,
  ensureBuilding892AssignmentsForWindow,
  ensureDemoDayAssignmentsForWindow,
  getBuilding892TeamRoster,
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
  const isAdmin = await checkRole(['admin', 'moderator', 'scheduler']);
  const now = new Date();
  const currentTeam =
    typeof user?.publicMetadata?.team === 'string'
      ? user.publicMetadata.team
      : null;
  const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  const overridesStart = new Date(startDate);
  overridesStart.setDate(overridesStart.getDate() - 7);
  const eligibleRoster = await getEligibleDemoDayRoster();
  const eligibleStandupRoster = await getEligibleStandupRoster();
  const eligibleSecurityRoster = await getEligibleSecurityShiftRoster();
  const building892Roster = await getBuilding892TeamRoster();
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
  const demoAssignments = await ensureDemoDayAssignmentsForWindow({
    baseDate: now,
    eligibleUsers: eligibleRoster,
    blockedUsersByWeek,
  });
  const standupAssignments = await ensureStandupAssignmentsForWindow({
    baseDate: now,
    eligibleUsers: eligibleStandupRoster,
    blockedUsersByWeek,
  });
  const securityAssignments = await ensureSecurityShiftAssignmentsForWindow({
    baseDate: now,
    eligibleUsers: eligibleSecurityRoster,
    blockedUsersByWeek,
  });
  const roster = isAdmin ? await getHostHubRoster() : [];
  const demoRule = await getScheduleRuleConfig('demo-day');
  const standupRule = await getScheduleRuleConfig('standup');
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
        building892Assignments={building892Assignments}
        currentUserTeam={currentTeam}
      />
    </section>
  );
}
