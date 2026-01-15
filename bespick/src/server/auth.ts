import { currentUser } from '@clerk/nextjs/server';

export type Identity = {
  userId: string;
  name?: string | null;
  email?: string | null;
};

const DEFAULT_ALLOWED_DOMAIN = 'teambespin.us';
const allowedEmailDomain = (
  process.env.ALLOWED_EMAIL_DOMAIN ??
  process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN ??
  DEFAULT_ALLOWED_DOMAIN
).toLowerCase();

export function isAllowedEmail(email?: string | null) {
  if (!allowedEmailDomain) return true;
  const domain = email?.split('@')[1]?.toLowerCase() ?? '';
  return domain === allowedEmailDomain;
}

export async function getOptionalIdentity(): Promise<Identity | null> {
  const user = await currentUser();
  if (!user) return null;
  const email = user.emailAddresses[0]?.emailAddress ?? null;
  if (!isAllowedEmail(email)) return null;
  return {
    userId: user.id,
    name: user.fullName ?? user.username ?? null,
    email,
  };
}

export async function requireIdentity(): Promise<Identity> {
  const identity = await getOptionalIdentity();
  if (!identity) {
    throw new Error('Unauthorized');
  }
  return identity;
}
