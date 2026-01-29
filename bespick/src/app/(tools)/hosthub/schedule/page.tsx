import { redirect } from 'next/navigation';

import { HostHubSubHeader } from '@/components/header/hosthub-subheader';
import { checkRole } from '@/server/auth/check-role';
import { ScheduleRuleCard } from './_components/schedule-rule-card';
import { RefreshScheduleAssignmentsCard } from './_components/refresh-schedule-card';
import { ResetScheduleAssignmentsCard } from './_components/reset-schedule-card';
import { Building892RuleCard } from './_components/building-892-rule-card';
import {
  getBuilding892RuleConfig,
  getScheduleRuleConfig,
} from '@/server/services/hosthub-schedule';
import { getMetadataOptionsConfig } from '@/server/services/site-settings';

export const metadata = {
  title: 'Schedule Settings | HostHub',
};

export default async function HostHubScheduleSettingsPage() {
  if (!(await checkRole(['admin', 'moderator', 'scheduler']))) {
    redirect('/hosthub');
  }

  const demoDayRule = await getScheduleRuleConfig('demo-day');
  const standupRule = await getScheduleRuleConfig('standup');
  const securityShiftRule = await getScheduleRuleConfig('security-shift');
  const building892Rule = await getBuilding892RuleConfig();
  const metadataOptions = await getMetadataOptionsConfig();

  return (
    <section className='mx-auto w-full max-w-5xl px-4 py-16 space-y-10'>
      <HostHubSubHeader />
      <div className='space-y-6'>
        <div className='rounded-2xl border border-border bg-card/70 p-6 shadow-sm'>
          <h2 className='text-2xl font-semibold text-foreground'>
            Scheduling settings
          </h2>
          <p className='mt-2 text-sm text-muted-foreground'>
            Choose who is eligible for each type of shift. These settings
            control the random assignments generated for the calendar and My
            Schedule.
          </p>
        </div>

        <div className='grid gap-6 lg:grid-cols-2'>
          <ScheduleRuleCard
            ruleId='demo-day'
            title='Demo Day eligibility'
            description='Select the ranks that can be assigned to Demo Day.'
            initialConfig={demoDayRule}
          />
          <ScheduleRuleCard
            ruleId='standup'
            title='Standup eligibility'
            description='Select the ranks that can be assigned to Standup.'
            initialConfig={standupRule}
          />
          <ScheduleRuleCard
            ruleId='security-shift'
            title='Security Shift eligibility'
            description='Select the ranks that can be assigned to Security Shift.'
            initialConfig={securityShiftRule}
            showDefaultTime={false}
            timeRanges={[
              { label: 'Morning', value: '07:00-12:00' },
              { label: 'Afternoon', value: '12:00-16:30' },
            ]}
          />
          <Building892RuleCard
            initialConfig={building892Rule}
            teamOptions={metadataOptions.teamOptions}
          />
        </div>

        <RefreshScheduleAssignmentsCard />
        <ResetScheduleAssignmentsCard />
      </div>
    </section>
  );
}
