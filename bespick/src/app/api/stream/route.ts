import { NextResponse } from 'next/server';
import { getOptionalIdentity } from '@/server/auth';
import { subscribe } from '@/server/events';

export const dynamic = 'force-dynamic';

export async function GET() {
  const identity = await getOptionalIdentity();
  if (!identity) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let keepAlive: ReturnType<typeof setInterval> | null = null;
      let unsubscribeAnnouncements = () => {};
      let unsubscribePollVotes = () => {};
      let unsubscribeVoting = () => {};
      let unsubscribeFormSubmissions = () => {};
      let unsubscribeFundraiserDonations = () => {};
      let unsubscribeGiveawayEntries = () => {};
      let unsubscribeHostHubSchedule = () => {};

      cleanup = () => {
        if (closed) return;
        closed = true;
        if (keepAlive) {
          clearInterval(keepAlive);
          keepAlive = null;
        }
        unsubscribeAnnouncements();
        unsubscribePollVotes();
        unsubscribeVoting();
        unsubscribeFormSubmissions();
        unsubscribeFundraiserDonations();
        unsubscribeGiveawayEntries();
        unsubscribeHostHubSchedule();
        try {
          controller.close();
        } catch {
          // No-op: stream may already be closed.
        }
      };

      const send = (data: unknown) => {
        if (closed) return;
        try {
          const payload = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          cleanup();
        }
      };

      const listener = (event: { channel: string; payload?: unknown }) => {
        send(event);
      };
      unsubscribeAnnouncements = subscribe('announcements', listener);
      unsubscribePollVotes = subscribe('pollVotes', listener);
      unsubscribeVoting = subscribe('voting', listener);
      unsubscribeFormSubmissions = subscribe('formSubmissions', listener);
      unsubscribeFundraiserDonations = subscribe(
        'fundraiserDonations',
        listener,
      );
      unsubscribeGiveawayEntries = subscribe(
        'giveawayEntries',
        listener,
      );
      unsubscribeHostHubSchedule = subscribe('hosthubSchedule', listener);

      send({ channel: 'connected' });
      keepAlive = setInterval(() => send({ channel: 'ping' }), 15000);
    },
    cancel() {
      cleanup();
    },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
