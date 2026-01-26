import { redirect } from 'next/navigation';
import { auth, clerkClient } from '@clerk/nextjs/server';

import { checkRole } from '@/server/auth/check-role';
import { getPrimaryEmail } from '@/server/auth';
import {
  getMattermostNotificationConfig,
  getMetadataOptionsConfig,
  getProfileWarningConfig,
  getWarningBannerConfig,
} from '@/server/services/site-settings';

import { ProfileWarningCard } from './_components/profile-warning-card';
import { WarningBannerCard } from './_components/warning-banner-card';
import { MattermostNotificationsCard } from './_components/mattermost-notifications-card';
import { MattermostTestCard } from './_components/mattermost-test-card';
import { MetadataOptionsCard } from './_components/metadata-options-card';

export default async function AdminSettingsPage() {
  if (!(await checkRole('admin'))) {
    redirect('/');
  }

  const { userId } = await auth();
  const client = await clerkClient();
  const users = (await client.users.getUserList({ limit: 500 })).data;
  const userOptions = users
    .map((user) => {
      const firstName = (user.firstName ?? '').trim();
      const lastName = (user.lastName ?? '').trim();
      const displayName = [firstName, lastName].filter(Boolean).join(' ');
      const email = getPrimaryEmail(user) ?? '';
      const fallbackName =
        (user.username ?? '').trim() ||
        email ||
        user.id;
      const baseLabel = displayName || fallbackName;
      const label =
        email && email !== baseLabel
          ? `${baseLabel} (${email})`
          : baseLabel;
      return { id: user.id, label };
    })
    .sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }),
    );
  const defaultUserId = userOptions.some(
    (option) => option.id === userId,
  )
    ? userId
    : userOptions[0]?.id ?? null;

  const warningBanner = await getWarningBannerConfig();
  const profileWarning = await getProfileWarningConfig();
  const mattermostNotifications = await getMattermostNotificationConfig();
  const metadataOptions = await getMetadataOptionsConfig();

  return (
    <div className='mx-auto w-full max-w-5xl space-y-8 px-4 py-10'>
      <header className='rounded-2xl border border-border bg-card p-6 shadow-sm'>
        <h1 className='text-3xl font-semibold text-foreground'>Settings</h1>
        <p className='mt-2 text-sm text-muted-foreground'>
          Manage global configuration that affects the landing page and other
          shared experiences.
        </p>
      </header>

      <div className='space-y-6'>
        <MetadataOptionsCard initialConfig={metadataOptions} />
        <WarningBannerCard initialConfig={warningBanner} />
        <ProfileWarningCard initialConfig={profileWarning} />
        <MattermostNotificationsCard
          initialConfig={mattermostNotifications}
        />
        <MattermostTestCard
          users={userOptions}
          defaultUserId={defaultUserId}
        />
      </div>
    </div>
  );
}
