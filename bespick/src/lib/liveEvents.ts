type LiveListener = () => void;

let eventSource: EventSource | null = null;
const listeners = new Map<string, Set<LiveListener>>();

function ensureEventSource() {
  if (typeof window === 'undefined') return;
  if (eventSource) return;
  eventSource = new EventSource('/api/stream');
  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as { channel?: string };
      const channel = data.channel;
      if (!channel) return;
      const channelListeners = listeners.get(channel);
      if (!channelListeners) return;
      for (const listener of channelListeners) {
        listener();
      }
    } catch {
      // ignore malformed events
    }
  };
  eventSource.onerror = () => {
    eventSource?.close();
    eventSource = null;
    setTimeout(ensureEventSource, 2000);
  };
}

export function subscribeLive(channels: string[], listener: LiveListener) {
  if (typeof window === 'undefined') return () => {};
  ensureEventSource();
  for (const channel of channels) {
    if (!listeners.has(channel)) {
      listeners.set(channel, new Set());
    }
    listeners.get(channel)!.add(listener);
  }
  return () => {
    for (const channel of channels) {
      listeners.get(channel)?.delete(listener);
    }
  };
}
