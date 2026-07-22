// localStorage persistence for an in-progress "/quotes/new" draft.
//
// Scope note: this is honest, narrow offline-safety -- it prevents losing
// what a Handwerker already typed if they lose signal, reload, or close the
// tab mid-draft. It does NOT queue the AI-generation request or sync across
// devices; see the NewQuoteForm offline banner copy and the PR description
// for why that broader sync-queue is out of scope for this change.

export const QUOTE_DRAFT_STORAGE_KEY = "hantverkare:quote-draft:new";

export type QuoteDraft = {
  customerId: string;
  description: string;
};

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function isBlankDraft(draft: QuoteDraft): boolean {
  return draft.customerId.trim().length === 0 && draft.description.trim().length === 0;
}

/**
 * Persists a draft, or removes it if both fields are blank (so we don't
 * leave an empty stub around forever). Swallows storage errors (private
 * browsing, quota exceeded, disabled storage) since this is a best-effort
 * convenience, not a critical path.
 */
export function saveDraft(storage: StorageLike, draft: QuoteDraft): void {
  try {
    if (isBlankDraft(draft)) {
      storage.removeItem(QUOTE_DRAFT_STORAGE_KEY);
      return;
    }
    storage.setItem(QUOTE_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Best-effort only.
  }
}

/**
 * Loads a previously saved draft. Returns null if nothing is saved, storage
 * is unavailable, or the saved value doesn't parse as a valid draft (e.g.
 * written by a future/incompatible version of this code).
 */
export function loadDraft(storage: StorageLike): QuoteDraft | null {
  let raw: string | null;
  try {
    raw = storage.getItem(QUOTE_DRAFT_STORAGE_KEY);
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
      return {
        customerId: (parsed as QuoteDraft).customerId,
        description: (parsed as QuoteDraft).description,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearDraft(storage: StorageLike): void {
  try {
    storage.removeItem(QUOTE_DRAFT_STORAGE_KEY);
  } catch {
    // Best-effort only.
  }
}
