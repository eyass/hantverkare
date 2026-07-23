import type { ParsedPriceListRow } from "./importPriceList";

export type ExistingPriceListItem = {
  id: string;
  label: string;
  unit_price_cents: number;
};

export type SupplierPriceDiffRow = {
  id: string;
  label: string;
  unit: string;
  category: string;
  oldUnitPriceCents: number;
  newUnitPriceCents: number;
  /** false when the supplier's price for this item is unchanged. */
  changed: boolean;
};

export type SupplierPriceDiff = {
  /** Rows matched to an existing price-list item (by label, case-insensitive). */
  updates: SupplierPriceDiffRow[];
  /** Rows with no matching existing item -- the supplier introduced a new material. */
  creates: ParsedPriceListRow[];
};

/**
 * Builds a diff between a supplier's price export (already parsed +
 * validated via parsePriceListImport) and the org's current price-list
 * items, matching by label (case-insensitive, same rule as
 * commitPriceListImport's plain re-import) -- this is a pure function so
 * the preview step and the commit step can compute the identical diff from
 * the same inputs without trusting a client-supplied diff.
 *
 * Unlike a plain re-import (which silently overwrites), this is meant to be
 * shown to the owner before anything is written: `updates` carries both the
 * old and new price so a "my supplier sent me a new price list" review can
 * see exactly what's changing, and rows whose price didn't move are still
 * included (with `changed: false`) so the owner can confirm nothing was
 * missed, rather than only surfacing rows that changed.
 */
export function buildSupplierPriceDiff(
  existingItems: ExistingPriceListItem[],
  validRows: ParsedPriceListRow[],
): SupplierPriceDiff {
  const existingByLabel = new Map<string, ExistingPriceListItem>();
  existingItems.forEach((item) => {
    existingByLabel.set(item.label.trim().toLowerCase(), item);
  });

  const updates: SupplierPriceDiffRow[] = [];
  const creates: ParsedPriceListRow[] = [];

  validRows.forEach((row) => {
    const existing = existingByLabel.get(row.label.trim().toLowerCase());
    if (existing) {
      updates.push({
        id: existing.id,
        label: row.label,
        unit: row.unit,
        category: row.category,
        oldUnitPriceCents: existing.unit_price_cents,
        newUnitPriceCents: row.unitPriceCents,
        changed: existing.unit_price_cents !== row.unitPriceCents,
      });
    } else {
      creates.push(row);
    }
  });

  return { updates, creates };
}
