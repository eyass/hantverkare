// localStorage persistence for a queued "/quotes/new" AI-generation request.
//
// Scope note: this queues ONLY the AI-generation call for a single new-quote
// submission made while offline (or that failed specifically because the
// device dropped offline mid-request), so it can be retried automatically
// once the browser reports it's back online (see useOnlineStatus + the
// NewQuoteForm retry effect). It deliberately does NOT attempt cross-device
// sync or conflict resolution -- see PR description for #109 for why that's
// out of scope here. This module follows the same pure, dependency-injected,
// defensively-written pattern as draftStorage.ts.

import type { StorageLike } from "./draftStorage";

export const QUOTE_GENERATION_QUEUE_KEY = "hantverkare:quote-generation-queue:new";

export type QueuedGeneration = {
  customerId: string;
  description: string;
  /** Number of automatic retry attempts made so far for this queued item. */
  attempts: number;
};

/**
 * Persists a queued generation request. Swallows storage errors (private
 * browsing, quota exceeded, disabled storage) since this is a best-effort
 * convenience, not a critical path -- if it fails to persist, the user still
 * sees the queued state in memory for the current tab session.
 */
export function saveQueuedGeneration(storage: StorageLike, queued: QueuedGeneration): void {
  try {
    storage.setItem(QUOTE_GENERATION_QUEUE_KEY, JSON.stringify(queued));
  } catch {
    // Best-effort only.
  }
}

/**
 * Loads a previously queued generation request. Returns null if nothing is
 * queued, storage is unavailable, or the saved value doesn't parse as a
 * valid queued item (e.g. written by a future/incompatible version of this
 * code).
 */
export function loadQueuedGeneration(storage: StorageLike): QueuedGeneration | null {
  let raw: string | null;
  try {
    raw = storage.getItem(QUOTE_GENERATION_QUEUE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "description" in parsed &&
      "customerId" in parsed &&
      typeof (parsed as { description: unknown }).description === "string" &&
      typeof (parsed as { customerId: unknown }).customerId === "string"
    ) {
      const attemptsRaw = (parsed as { attempts?: unknown }).attempts;
      const attempts = typeof attemptsRaw === "number" && Number.isFinite(attemptsRaw) ? attemptsRaw : 0;
      return {
        customerId: (parsed as QueuedGeneration).customerId,
        description: (parsed as QueuedGeneration).description,
        attempts,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearQueuedGeneration(storage: StorageLike): void {
  try {
    storage.removeItem(QUOTE_GENERATION_QUEUE_KEY);
  } catch {
    // Best-effort only.
  }
}

/** Hard cap on automatic retry attempts to avoid hammering the server during
 * a persistent connectivity flap (e.g. repeated online/offline events).
 * Once exceeded, the item stays queued (and is still restorable/submittable
 * manually) but is no longer retried automatically. */
export const MAX_AUTO_RETRY_ATTEMPTS = 3;

/**
 * Pure decision function: should we automatically retry a queued
 * generation request right now?
 */
export function shouldAutoRetry(params: {
  isOnline: boolean;
  isPending: boolean;
  queued: QueuedGeneration | null;
}): boolean {
  const { isOnline, isPending, queued } = params;
  if (!isOnline || isPending || !queued) return false;
  return queued.attempts < MAX_AUTO_RETRY_ATTEMPTS;
}
