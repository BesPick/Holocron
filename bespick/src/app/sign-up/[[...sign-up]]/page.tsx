import Link from 'next/link';
import { SignUp } from '@clerk/nextjs';

import { AuthShell, authAppearance } from '@/components/auth/auth-shell';

export default function SignUpPage() {
  return (
    <AuthShell
      heading='Join the crew!'
      subheading='Create your account to stay in the BESPIN loop.'
      footer={
        <p>
          Already have an account?{' '}
          <Link
            href='/sign-in'
            className='font-medium text-primary hover:underline'
          >
            Sign in instead
          </Link>
          .
        </p>
      }
    >
      <SignUp appearance={authAppearance} signInUrl='/sign-in' />
    </AuthShell>
  );
}
