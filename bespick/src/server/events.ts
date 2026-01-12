import { EventEmitter } from 'node:events';

type LiveEvent = { channel: string; payload?: unknown };

const emitter = new EventEmitter();
emitter.setMaxListeners(0);

export function broadcast(channels: string[] | string, payload?: unknown) {
  const list = Array.isArray(channels) ? channels : [channels];
  for (const channel of list) {
    emitter.emit(channel, { channel, payload } satisfies LiveEvent);
  }
}

export function subscribe(
  channel: string,
  listener: (event: LiveEvent) => void,
) {
  emitter.on(channel, listener);
  return () => emitter.off(channel, listener);
}
