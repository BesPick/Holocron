'use client';

import { SignOutButton } from '@clerk/nextjs';
import { AuthShell } from '@/components/auth/auth-shell';

const allowedDomain =
  process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN ?? 'teambespin.us';

export default function DomainRestrictedPage() {
  return (
    <AuthShell
      heading='Email restricted'
      subheading={`Only ${allowedDomain} accounts can access this app.`}
    >
      <div className='space-y-4 text-sm text-muted-foreground'>
        <p>
          Your account email does not match the allowed organization domain.
          Please sign out and try again with a {allowedDomain} email.
        </p>
        <SignOutButton>
          <button
            type='button'
            className='w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
          >
            Sign out
          </button>
        </SignOutButton>
      </div>
    </AuthShell>
  );
}
