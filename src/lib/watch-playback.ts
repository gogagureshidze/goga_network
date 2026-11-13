export type PlaybackSnapshot = { position: number; playing: boolean; updatedAt: string };

export function projectPlayback(snapshot: PlaybackSnapshot, serverNow: number, duration: number) {
  const elapsed = snapshot.playing ? Math.max(0, serverNow - new Date(snapshot.updatedAt).getTime()) / 1000 : 0;
  const position = Math.max(0, snapshot.position + elapsed);
  const finiteDuration = Number.isFinite(duration) && duration >= 0;
  return { position: finiteDuration ? Math.min(position, duration) : position, playing: snapshot.playing && (!finiteDuration || position < duration) };
}

// Native media events are asynchronous even for programmatic play/pause/seek.
// Mark only actual mutations, consuming exactly their corresponding event.
export function createMediaEventGuard() {
  const expected = new Set<string>();
  return {
    expect(event: string) { expected.add(event); },
    consume(event: string) {
      return expected.delete(event);
    },
    cancel(event: string) { expected.delete(event); },
    clear() { expected.clear(); },
  };
}

export function createPlaybackCommandQueue<T extends { version: number }>(options: {
  current: () => T;
  send: (version: number, action: string, extra: Record<string, unknown>) => Promise<T>;
  accept: (snapshot: T) => void;
  recover: () => Promise<T>;
}) {
  let queue = Promise.resolve();
  let cancelled = false;
  return {
    enqueue(action: string, extra: Record<string, unknown> = {}) {
      const next = queue.then(async () => {
        if (cancelled) return;
        try {
          const snapshot = await options.send(options.current().version, action, extra);
          if (!cancelled && snapshot.version >= options.current().version) options.accept(snapshot);
        } catch (error) {
          if (!cancelled) {
            const snapshot = await options.recover();
            if (!cancelled && snapshot.version >= options.current().version) options.accept(snapshot);
          }
          throw error;
        }
      });
      queue = next.catch(() => {});
      return next;
    },
    cancel() { cancelled = true; },
  };
}
