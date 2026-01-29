import { NextResponse } from 'next/server';
import crypto from 'node:crypto';

import { notifyHostHubShiftsForTomorrow } from '@/server/services/mattermost-notifications';

const getAuthToken = (request: Request) => {
  const authHeader = request.headers.get('authorization') ?? '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }
  return authHeader.trim();
};

const handleRequest = async (request: Request) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'Missing CRON_SECRET configuration.' },
      { status: 500 },
    );
  }
  const token = getAuthToken(request);
  const tokenBuffer = Buffer.from(token);
  const secretBuffer = Buffer.from(secret);
  if (
    tokenBuffer.length !== secretBuffer.length ||
    !crypto.timingSafeEqual(tokenBuffer, secretBuffer)
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await notifyHostHubShiftsForTomorrow();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to send HostHub shift reminders', error);
    return NextResponse.json(
      { error: 'Failed to send reminders.' },
      { status: 500 },
    );
  }
};

export async function POST(request: Request) {
  return handleRequest(request);
}

export async function GET(request: Request) {
  return handleRequest(request);
}
