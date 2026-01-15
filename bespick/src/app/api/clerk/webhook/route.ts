import { NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { clerkClient } from '@clerk/nextjs/server';
import { isAllowedEmail } from '@/server/auth';

type ClerkWebhookEmailAddress = {
  email_address: string;
};

type ClerkWebhookEvent = {
  type: string;
  data: {
    id: string;
    email_addresses?: ClerkWebhookEmailAddress[];
  };
};

export async function POST(request: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'Missing CLERK_WEBHOOK_SECRET' },
      { status: 500 },
    );
  }

  const payload = await request.text();
  const headers = {
    'svix-id': request.headers.get('svix-id') ?? '',
    'svix-timestamp': request.headers.get('svix-timestamp') ?? '',
    'svix-signature': request.headers.get('svix-signature') ?? '',
  };

  if (!headers['svix-id'] || !headers['svix-timestamp'] || !headers['svix-signature']) {
    return NextResponse.json(
      { error: 'Missing Svix headers' },
      { status: 400 },
    );
  }

  let event: ClerkWebhookEvent;
  try {
    const webhook = new Webhook(secret);
    event = webhook.verify(payload, headers) as ClerkWebhookEvent;
  } catch (error) {
    console.error('Clerk webhook signature verification failed', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type !== 'user.created' && event.type !== 'user.updated') {
    return NextResponse.json({ ok: true });
  }

  const emails = event.data.email_addresses ?? [];
  const hasAllowedEmail = emails.some((address) =>
    isAllowedEmail(address.email_address),
  );

  if (!hasAllowedEmail) {
    const client = await clerkClient();
    await client.users.deleteUser(event.data.id);
    return NextResponse.json({ status: 'deleted' });
  }

  return NextResponse.json({ status: 'ok' });
}
