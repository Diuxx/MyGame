/** Atomically replace a loaded level; a failed load never unloads the current one. */
export interface MapLifecycle {
  activate(): void;
  dispose(): void;
}

export function createMapSession<T extends MapLifecycle>(build: (id: string) => Promise<T>) {
  let current: T | undefined;
  let generation = 0;
  let closed = false;
  const pending = new Set<Promise<T>>();

  async function replace(task: Promise<T>, validate?: (candidate: T) => void): Promise<T | undefined> {
    if (closed) throw new Error("Le système de maps est déjà fermé.");
    const request = ++generation;
    pending.add(task);
    let next: T;
    try {
      next = await task;
    } finally {
      pending.delete(task);
    }
    if (closed || request !== generation) {
      next.dispose();
      return undefined;
    }
    try {
      validate?.(next);
      next.activate();
    } catch (error) {
      next.dispose();
      throw error;
    }
    const previous = current;
    current = next;
    previous?.dispose();
    return next;
  }

  async function load(id: string, validate?: (candidate: T) => void): Promise<T | undefined> {
    if (closed) throw new Error("Le système de maps est déjà fermé.");
    return replace(build(id), validate);
  }

  function unload(): void {
    ++generation;
    current?.dispose();
    current = undefined;
  }

  return {
    load,
    replace,
    unload,
    get active(): T | undefined { return current; },
    async dispose(): Promise<void> {
      if (closed) return;
      closed = true;
      unload();
      await Promise.allSettled(pending);
    },
  };
}
