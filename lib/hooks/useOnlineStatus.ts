"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot(): boolean {
  return navigator.onLine;
}

function getServerSnapshot(): boolean {
  // Assume online during SSR/first paint; the real value is read on the
  // client via getSnapshot immediately after hydration.
  return true;
}

/**
 * Tracks browser online/offline state via navigator.onLine + the
 * online/offline window events, using useSyncExternalStore (the React-
 * recommended way to subscribe to a browser API like this without the
 * setState-in-effect anti-pattern).
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
