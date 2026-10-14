"use client";

import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
let now = Date.now();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      for (const notify of listeners) notify();
    }, 30_000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/** Current time, refreshed every 30s. Returns null during server render to keep hydration stable. */
export function useNow(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => now,
    () => null,
  );
}
