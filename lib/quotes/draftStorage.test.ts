import { describe, expect, it } from "vitest";
import { QUOTE_DRAFT_STORAGE_KEY, clearDraft, loadDraft, saveDraft, type StorageLike } from "./draftStorage";

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

describe("draftStorage", () => {
  it("returns null when nothing is saved", () => {
    const storage = createFakeStorage();
    expect(loadDraft(storage)).toBeNull();
  });

  it("saves and reloads a draft", () => {
    const storage = createFakeStorage();
    saveDraft(storage, { customerId: "cust-1", description: "Küchenspüle austauschen" });
    expect(loadDraft(storage)).toEqual({
      customerId: "cust-1",
      description: "Küchenspüle austauschen",
    });
  });

  it("does not persist a blank draft", () => {
    const storage = createFakeStorage();
    saveDraft(storage, { customerId: "", description: "   " });
    expect(loadDraft(storage)).toBeNull();
  });

  it("removes a previously saved draft once it becomes blank", () => {
    const storage = createFakeStorage();
    saveDraft(storage, { customerId: "cust-1", description: "Notizen" });
    saveDraft(storage, { customerId: "", description: "" });
    expect(loadDraft(storage)).toBeNull();
  });

  it("clearDraft removes the saved entry", () => {
    const storage = createFakeStorage();
    saveDraft(storage, { customerId: "cust-1", description: "Notizen" });
    clearDraft(storage);
    expect(loadDraft(storage)).toBeNull();
  });

  it("ignores corrupted JSON instead of throwing", () => {
    const storage = createFakeStorage({ [QUOTE_DRAFT_STORAGE_KEY]: "{not json" });
    expect(loadDraft(storage)).toBeNull();
  });

  it("ignores a saved value with the wrong shape", () => {
    const storage = createFakeStorage({
      [QUOTE_DRAFT_STORAGE_KEY]: JSON.stringify({ foo: "bar" }),
    });
    expect(loadDraft(storage)).toBeNull();
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
    expect(() => saveDraft(throwingStorage, { customerId: "1", description: "x" })).not.toThrow();
    expect(loadDraft(throwingStorage)).toBeNull();
    expect(() => clearDraft(throwingStorage)).not.toThrow();
  });
});
