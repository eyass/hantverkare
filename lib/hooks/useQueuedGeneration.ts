"use client";

import { useSyncExternalStore } from "react";
import {
  clearQueuedGeneration,
  loadQueuedGeneration,
  saveQueuedGeneration,
  type QueuedGeneration,
} from "@/lib/quotes/generationQueue";

// A tiny external store wrapping the queued-generation localStorage entry,
// following the same useSyncExternalStore pattern as useOnlineStatus --
// this keeps all "is there a queued offline generation request" state
// external to React (so reading it never requires setState-in-effect,
// which both defeats the purpose of an external store and trips the
// react-hooks/set-state-in-effect lint rule) while still re-rendering any
// subscribed component when it changes.

type Listener = () => void;

const listeners = new Set<Listener>();
let cache: QueuedGeneration | null | undefined; // undefined = not loaded from storage yet

function notify(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): QueuedGeneration | null {
  if (cache === undefined) {
    cache = typeof window === "undefined" ? null : loadQueuedGeneration(window.localStorage);
  }
  return cache;
}

function getServerSnapshot(): QueuedGeneration | null {
  // Assume nothing queued during SSR/first paint; the real value (if any)
  // is read from localStorage on the client via getSnapshot immediately
  // after hydration, same rationale as useOnlineStatus.
  return null;
}

export function useQueuedGeneration(): QueuedGeneration | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Persists a queued generation request and notifies subscribers. */
export function enqueueGeneration(next: QueuedGeneration): void {
  if (typeof window !== "undefined") {
    saveQueuedGeneration(window.localStorage, next);
  }
  cache = next;
  notify();
}

/** Clears any queued generation request and notifies subscribers. */
export function clearQueuedGenerationStore(): void {
  if (typeof window !== "undefined") {
    clearQueuedGeneration(window.localStorage);
  }
  cache = null;
  notify();
}
