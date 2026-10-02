// The subscribe/notify part every store and the feed client share, in the
// shape `useSyncExternalStore` reads.

export class Emitter {
  private readonly listeners = new Set<() => void>();

  /** Adds `fn`; returns the function that removes it. */
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  emit(): void {
    for (const fn of [...this.listeners]) fn();
  }
}
