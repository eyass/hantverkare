import { describe, expect, it } from "vitest";
import type { StorageLike } from "./draftStorage";
import {
  MAX_AUTO_RETRY_ATTEMPTS,
  QUOTE_GENERATION_QUEUE_KEY,
  clearQueuedGeneration,
  loadQueuedGeneration,
  saveQueuedGeneration,
  shouldAutoRetry,
} from "./generationQueue";

function createFakeStorage(initial: Record<string, string> = {}): StorageLike {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
}

describe("generationQueue storage", () => {
  it("returns null when nothing is queued", () => {
    const storage = createFakeStorage();
    expect(loadQueuedGeneration(storage)).toBeNull();
  });

  it("saves and reloads a queued generation", () => {
    const storage = createFakeStorage();
    saveQueuedGeneration(storage, {
      customerId: "cust-1",
      description: "Küchenspüle austauschen",
      attempts: 0,
    });
    expect(loadQueuedGeneration(storage)).toEqual({
      customerId: "cust-1",
      description: "Küchenspüle austauschen",
      attempts: 0,
    });
  });

  it("defaults attempts to 0 when missing (older/foreign payload)", () => {
    const storage = createFakeStorage({
      [QUOTE_GENERATION_QUEUE_KEY]: JSON.stringify({
        customerId: "cust-1",
        description: "Notizen",
      }),
    });
    expect(loadQueuedGeneration(storage)).toEqual({
      customerId: "cust-1",
      description: "Notizen",
      attempts: 0,
    });
  });

  it("clearQueuedGeneration removes the saved entry", () => {
    const storage = createFakeStorage();
    saveQueuedGeneration(storage, { customerId: "", description: "Notizen", attempts: 1 });
    clearQueuedGeneration(storage);
    expect(loadQueuedGeneration(storage)).toBeNull();
  });

  it("ignores corrupted JSON instead of throwing", () => {
    const storage = createFakeStorage({ [QUOTE_GENERATION_QUEUE_KEY]: "{not json" });
    expect(loadQueuedGeneration(storage)).toBeNull();
  });

  it("ignores a saved value with the wrong shape", () => {
    const storage = createFakeStorage({
      [QUOTE_GENERATION_QUEUE_KEY]: JSON.stringify({ foo: "bar" }),
    });
    expect(loadQueuedGeneration(storage)).toBeNull();
  });

  it("swallows storage errors on save and load", () => {
    const throwingStorage: StorageLike = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(() =>
      saveQueuedGeneration(throwingStorage, { customerId: "1", description: "x", attempts: 0 }),
    ).not.toThrow();
    expect(loadQueuedGeneration(throwingStorage)).toBeNull();
    expect(() => clearQueuedGeneration(throwingStorage)).not.toThrow();
  });
});

describe("shouldAutoRetry", () => {
  const queued = { customerId: "cust-1", description: "Notizen", attempts: 0 };

  it("does not retry when offline", () => {
    expect(shouldAutoRetry({ isOnline: false, isPending: false, queued })).toBe(false);
  });

  it("does not retry when a request is already pending", () => {
    expect(shouldAutoRetry({ isOnline: true, isPending: true, queued })).toBe(false);
  });

  it("does not retry when nothing is queued", () => {
    expect(shouldAutoRetry({ isOnline: true, isPending: false, queued: null })).toBe(false);
  });

  it("retries when online, idle, and under the attempt cap", () => {
    expect(shouldAutoRetry({ isOnline: true, isPending: false, queued })).toBe(true);
  });

  it("stops retrying once the attempt cap is reached", () => {
    const exhausted = { ...queued, attempts: MAX_AUTO_RETRY_ATTEMPTS };
    expect(shouldAutoRetry({ isOnline: true, isPending: false, queued: exhausted })).toBe(false);
  });

  it("still allows one below the cap", () => {
    const almost = { ...queued, attempts: MAX_AUTO_RETRY_ATTEMPTS - 1 };
    expect(shouldAutoRetry({ isOnline: true, isPending: false, queued: almost })).toBe(true);
  });
});
