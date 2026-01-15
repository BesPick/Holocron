import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { getPrimaryEmail, isAllowedEmail } from '@/server/auth';

type ToolsLayoutProps = {
  children: ReactNode;
};

export default async function ToolsLayout({ children }: ToolsLayoutProps) {
  const user = await currentUser();
  if (!user) {
    redirect('/sign-in');
  }

  const email = getPrimaryEmail(user);
  if (!isAllowedEmail(email)) {
    redirect('/domain-restricted');
  }

  return <>{children}</>;
}
