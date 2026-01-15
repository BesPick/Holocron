import { currentUser } from '@clerk/nextjs/server';

export type Identity = {
  userId: string;
  name?: string | null;
  email?: string | null;
};

type ClerkEmailAddress = {
  id: string;
  emailAddress: string;
};

type ClerkUserLike = {
  primaryEmailAddressId?: string | null;
  emailAddresses?: ClerkEmailAddress[];
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

export function getPrimaryEmail(user?: ClerkUserLike | null) {
  if (!user?.emailAddresses || user.emailAddresses.length === 0) return null;
  const primaryId = user.primaryEmailAddressId ?? null;
  const primary = primaryId
    ? user.emailAddresses.find((address) => address.id === primaryId)
    : undefined;
  const email =
    primary?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null;
  return email?.trim() ?? null;
}

export function getAllowedEmail(user?: ClerkUserLike | null) {
  if (!user?.emailAddresses || user.emailAddresses.length === 0) return null;
  const primaryEmail = getPrimaryEmail(user);
  if (isAllowedEmail(primaryEmail)) return primaryEmail;
  const match = user.emailAddresses.find((address) =>
    isAllowedEmail(address.emailAddress),
  );
  return match?.emailAddress?.trim() ?? null;
}

export async function getOptionalIdentity(): Promise<Identity | null> {
  const user = await currentUser();
  if (!user) return null;
  const email = getAllowedEmail(user);
  if (!email) return null;
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
