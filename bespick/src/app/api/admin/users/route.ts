import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';

import { checkRole } from '@/server/auth/check-role';
import { isValidGroup, isValidPortfolioForGroup } from '@/lib/org';

export async function GET() {
  const isAdmin = await checkRole('admin');
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const client = await clerkClient();
    const users = await client.users.getUserList({ limit: 500 });
    const payload = users.data.map((user) => {
      const rawGroup = user.publicMetadata.group;
      const normalizedGroup = isValidGroup(rawGroup) ? rawGroup : null;
      const rawPortfolio = user.publicMetadata.portfolio;
      const normalizedPortfolio =
        normalizedGroup &&
        isValidPortfolioForGroup(normalizedGroup, rawPortfolio)
          ? rawPortfolio
          : null;
      return {
        userId: user.id,
        firstName: (user.firstName ?? '').trim(),
        lastName: (user.lastName ?? '').trim(),
        group: normalizedGroup,
        portfolio: normalizedPortfolio,
        votes: 0,
      };
    });
    return NextResponse.json({ users: payload });
  } catch (error) {
    console.error('Failed to load roster for voting events', error);
    return NextResponse.json(
      { error: 'Unable to load users right now.' },
      { status: 500 },
    );
  }
}
