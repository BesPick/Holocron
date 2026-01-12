import { currentUser } from '@clerk/nextjs/server';

export type Identity = {
  userId: string;
  name?: string | null;
  email?: string | null;
};

export async function getOptionalIdentity(): Promise<Identity | null> {
  const user = await currentUser();
  if (!user) return null;
  return {
    userId: user.id,
    name: user.fullName ?? user.username ?? null,
    email: user.emailAddresses[0]?.emailAddress ?? null,
  };
}

export async function requireIdentity(): Promise<Identity> {
  const identity = await getOptionalIdentity();
  if (!identity) {
    throw new Error('Unauthorized');
  }
  return identity;
}
