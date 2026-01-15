import Link from 'next/link';
import { SignIn } from '@clerk/nextjs';

import { AuthShell, authAppearance } from '@/components/auth/auth-shell';

export default function SignInPage() {
  return (
    <AuthShell
      heading='Welcome back!'
      subheading='Sign in to jump into the dashboard.'
      footer={
        <p>
          Need an account?{' '}
          <Link
            href='/sign-up'
            className='font-medium text-primary hover:underline'
          >
            Create one now
          </Link>
          .
        </p>
      }
    >
      <SignIn appearance={authAppearance} signUpUrl='/sign-up' />
    </AuthShell>
  );
}
