import { redirect } from 'next/navigation';
import { checkRole } from '@/server/auth/check-role';
import { ActivityFormTabs } from '@/components/admin/activity-form-tabs';
import { MoraleSubHeader } from '@/components/header/morale-subheader';

export default async function AdminCreatePage({
  searchParams: searchParamsPromise,
}: {
  searchParams?: Promise<{ edit?: string }>;
}) {
  if (!(await checkRole(['admin', 'moderator', 'morale-member']))) {
    redirect('/');
  }

  const searchParams = await searchParamsPromise;
  const isEditing = Boolean(searchParams?.edit);

  return (
    <div className='page-shell-compact space-y-8'>
      <MoraleSubHeader />
      <header className='rounded-2xl border border-border bg-card p-6 shadow-sm'>
        <h1 className='text-3xl font-semibold text-foreground'>
          {isEditing ? 'Edit Activity' : 'Create Activity'}
        </h1>
        <p className='mt-2 text-sm text-muted-foreground'>
          {isEditing
            ? 'Update details before an activity goes live or tweak published content.'
            : 'Draft upcoming morale events and share them with the rest of BESPIN.'}
        </p>
      </header>
      <ActivityFormTabs />
    </div>
  );
}
