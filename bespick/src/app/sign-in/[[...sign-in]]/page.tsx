import Link from 'next/link';
import { SignIn } from '@clerk/nextjs';

import { AuthShell, authAppearance } from '@/components/auth/auth-shell';

const allowedDomain =
  process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN ?? 'teambespin.us';

export default function SignInPage() {
  return (
    <AuthShell
      heading='Welcome back!'
      subheading={`Sign in with your ${allowedDomain} email.`}
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
