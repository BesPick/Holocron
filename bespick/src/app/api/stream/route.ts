import { NextResponse } from 'next/server';
import { broadcast, subscribe } from '@/server/events';

export const dynamic = 'force-dynamic';

export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let keepAlive: ReturnType<typeof setInterval> | null = null;
      let unsubscribeAnnouncements = () => {};
      let unsubscribePollVotes = () => {};
      let unsubscribeVoting = () => {};

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (keepAlive) {
          clearInterval(keepAlive);
          keepAlive = null;
        }
        unsubscribeAnnouncements();
        unsubscribePollVotes();
        unsubscribeVoting();
      };

      const send = (data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
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

      send({ channel: 'connected' });
      keepAlive = setInterval(() => send({ channel: 'ping' }), 15000);
      controller.onclose = cleanup;
      controller.oncancel = cleanup;
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
