"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/organizations/getCurrentOrg";
import { buildRowsToInsert, type Selection } from "@/lib/priceList/templateSelection";
import { parsePriceListImport, type ParsedPriceListRow, type PriceListRowError } from "@/lib/priceList/importPriceList";

export type PriceListItemInput = {
  label: string;
  unit: string;
  unitPriceCents: number;
  category: string;
  trackStock?: boolean;
  stockQuantity?: number | null;
  lowStockThreshold?: number | null;
};

type PriceListItemRow = {
  id: string;
  label: string;
  unit: string;
  unit_price_cents: number;
  category: string;
  track_stock: boolean;
  stock_quantity: number | null;
  low_stock_threshold: number | null;
};

type CreateResult = { error: string; item?: never } | { error: null; item: PriceListItemRow };

type ActionResult = { error: string | null };

function validateInput(input: PriceListItemInput): string | null {
  if (input.label.trim().length === 0 || input.unit.trim().length === 0) {
    return "Bezeichnung und Einheit dürfen nicht leer sein.";
  }
  if (!Number.isInteger(input.unitPriceCents) || input.unitPriceCents <= 0) {
    return "Preis muss größer als 0 sein.";
  }
  return null;
}

export async function createPriceListItem(input: PriceListItemInput): Promise<CreateResult> {
  const validationError = validateInput(input);
  if (validationError) {
    return { error: validationError };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Bitte melde dich an." };
  }

  const org = await getCurrentOrg(supabase);
  if (!org) {
    return { error: "Keine Organisation gefunden." };
  }

  const { data, error } = await supabase
    .from("price_list_items")
    .insert({
      label: input.label,
      unit: input.unit,
      unit_price_cents: input.unitPriceCents,
      category: input.category,
      organization_id: org.organizationId,
      user_id: user.id,
      track_stock: input.trackStock ?? false,
      stock_quantity: input.stockQuantity ?? null,
      low_stock_threshold: input.lowStockThreshold ?? null,
    })
    .select(
      "id, label, unit, unit_price_cents, category, track_stock, stock_quantity, low_stock_threshold",
    )
    .single();
  if (error || !data) {
    console.error("Failed to create price list item:", error);
    return { error: "Position konnte nicht angelegt werden." };
  }

  return { error: null, item: data };
}

export async function updatePriceListItem(
  id: string,
  input: PriceListItemInput,
): Promise<ActionResult> {
  const validationError = validateInput(input);
  if (validationError) {
    return { error: validationError };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("price_list_items")
    .update({
      label: input.label,
      unit: input.unit,
      unit_price_cents: input.unitPriceCents,
      category: input.category,
      track_stock: input.trackStock ?? false,
      stock_quantity: input.stockQuantity ?? null,
      low_stock_threshold: input.lowStockThreshold ?? null,
    })
    .eq("id", id);
  if (error) {
    console.error("Failed to update price list item:", error);
    return { error: "Position konnte nicht gespeichert werden." };
  }

  return { error: null };
}

export type RestockResult = { error: string; stockQuantity?: never } | { error: null; stockQuantity: number };

/**
 * Manual restock action (issue #125) -- adds `amount` to an item's current
 * stock_quantity. Uses the atomic increment_price_list_stock() RPC (see
 * 0020_materials_inventory.sql) rather than a client read-then-write, so a
 * restock can never race with a concurrent sign-triggered decrement. No
 * live supplier integration -- this is purely "I physically restocked X
 * units, reflect that here" (explicitly out of scope per the issue).
 */
export async function restockPriceListItem(id: string, amount: number): Promise<RestockResult> {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Menge muss größer als 0 sein." };
  }

  const supabase = await createClient();
  const { error: rpcError } = await supabase.rpc("increment_price_list_stock", {
    item_id: id,
    qty: amount,
  });
  if (rpcError) {
    console.error("Failed to restock price list item:", rpcError);
    return { error: "Bestand konnte nicht aktualisiert werden." };
  }

  const { data, error } = await supabase
    .from("price_list_items")
    .select("stock_quantity")
    .eq("id", id)
    .single();
  if (error || !data || data.stock_quantity === null) {
    console.error("Failed to reload stock quantity after restock:", error);
    return { error: "Bestand konnte nicht neu geladen werden." };
  }

  return { error: null, stockQuantity: data.stock_quantity };
}

export async function deletePriceListItem(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("price_list_items").delete().eq("id", id);
  if (error) {
    console.error("Failed to delete price list item:", error);
    return { error: "Position konnte nicht gelöscht werden." };
  }

  return { error: null };
}

export async function createPriceListItemsFromTemplate(
  templateId: string,
  selections: Selection[],
): Promise<{ error: string | null }> {
  if (selections.length === 0) {
    return { error: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Bitte melde dich an." };
  }

  const org = await getCurrentOrg(supabase);
  if (!org) {
    return { error: "Keine Organisation gefunden." };
  }

  const { data: templateItems, error: fetchError } = await supabase
    .from("price_list_template_items")
    .select("id, template_id, label, unit, category")
    .eq("template_id", templateId);
  if (fetchError || !templateItems) {
    console.error("Failed to load price list template items:", fetchError);
    return { error: "Vorlage konnte nicht geladen werden." };
  }

  const result = buildRowsToInsert(templateId, templateItems, selections);
  if (result.error !== null) {
    return { error: result.error };
  }

  const rowsWithOwner = result.rows.map((row) => ({
    ...row,
    organization_id: org.organizationId,
    user_id: user.id,
  }));

  const { error: insertError } = await supabase.from("price_list_items").insert(rowsWithOwner);
  if (insertError) {
    console.error("Failed to bulk-insert price list items from template:", insertError);
    return { error: "Positionen konnten nicht angelegt werden." };
  }

  return { error: null };
}

export type BulkAdjustResult = { error: string | null; updated?: number };

/**
 * Bulk-adjusts every price-list item's unit price by a percentage (issue
 * #129, "increase all materials by 5%"). Positive percent increases prices,
 * negative decreases them. Reads the caller's own items (RLS-scoped to their
 * org via is_org_member), computes new prices in application code, then
 * writes them back with an upsert keyed on `id` -- there's no
 * `unit_price_cents = unit_price_cents * x` update expression available
 * through the Supabase JS client, so this is the simplest correct way to do
 * a bulk numeric update without a new SQL function/migration.
 */
export async function bulkAdjustPriceListPrices(percent: number): Promise<BulkAdjustResult> {
  if (!Number.isFinite(percent)) {
    return { error: "Ungültiger Prozentsatz." };
  }
  // A single adjustment can't zero out or invert prices, and anything wilder
  // than +/-90% is almost certainly a typo (e.g. "500" instead of "5").
  if (percent <= -90 || percent > 1000) {
    return { error: "Prozentsatz muss zwischen -90 und 1000 liegen." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Bitte melde dich an." };
  }

  const org = await getCurrentOrg(supabase);
  if (!org) {
    return { error: "Keine Organisation gefunden." };
  }

  const { data: items, error: fetchError } = await supabase
    .from("price_list_items")
    .select("id, unit_price_cents")
    .eq("organization_id", org.organizationId);
  if (fetchError) {
    console.error("Failed to load price list items for bulk adjustment:", fetchError);
    return { error: "Preisliste konnte nicht geladen werden." };
  }
  if (!items || items.length === 0) {
    return { error: null, updated: 0 };
  }

  const factor = 1 + percent / 100;
  const updates = items.map((item) => ({
    id: item.id,
    unit_price_cents: Math.max(1, Math.round(item.unit_price_cents * factor)),
  }));

  const { error: updateError } = await supabase
    .from("price_list_items")
    .upsert(updates, { onConflict: "id" });
  if (updateError) {
    console.error("Failed to bulk-adjust price list items:", updateError);
    return { error: "Preise konnten nicht angepasst werden." };
  }

  return { error: null, updated: updates.length };
}

export type PriceListImportPreviewResult =
  | { error: string; validRows?: never; errors?: never }
  | { error: null; validRows: ParsedPriceListRow[]; errors: PriceListRowError[] };

/**
 * Parses+validates an uploaded CSV file for the price-list bulk-reimport
 * preview step (issue #129). Purely a parsing/validation pass -- nothing is
 * written to the database here -- mirrors previewCustomerImport in
 * app/(app)/customers/actions.ts.
 */
export async function previewPriceListImport(csvText: string): Promise<PriceListImportPreviewResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Bitte melde dich an." };
  }

  if (csvText.trim().length === 0) {
    return { error: "Die Datei ist leer." };
  }

  const { validRows, errors } = parsePriceListImport(csvText);

  if (validRows.length === 0 && errors.length === 0) {
    return { error: "Die Datei enthält keine Preislisten-Daten." };
  }

  return { error: null, validRows, errors };
}

export type PriceListImportCommitResult =
  | { error: string; updated?: never; created?: never }
  | { error: null; updated: number; created: number };

/**
 * Commits a previously previewed CSV re-import: re-parses the raw CSV text
 * server-side (never trusts client-supplied row objects, same trust-boundary
 * pattern as commitCustomerImport) and overwrites pricing in bulk --
 * matching each valid row to an existing item by its label (case-insensitive)
 * within the caller's org: a match updates unit/price/category in place, a
 * non-match inserts a new item. This lets a supplier's updated price sheet
 * be dropped in wholesale without needing a new unique constraint/migration
 * to upsert on.
 */
export async function commitPriceListImport(csvText: string): Promise<PriceListImportCommitResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Bitte melde dich an." };
  }

  const org = await getCurrentOrg(supabase);
  if (!org) {
    return { error: "Keine Organisation gefunden." };
  }

  const { validRows } = parsePriceListImport(csvText);
  if (validRows.length === 0) {
    return { error: "Keine gültigen Positionen zum Importieren gefunden." };
  }

  const { data: existingItems, error: fetchError } = await supabase
    .from("price_list_items")
    .select("id, label")
    .eq("organization_id", org.organizationId);
  if (fetchError) {
    console.error("Failed to load existing price list items for import:", fetchError);
    return { error: "Preisliste konnte nicht geladen werden." };
  }

  const existingByLabel = new Map<string, string>();
  (existingItems ?? []).forEach((item) => {
    existingByLabel.set(item.label.trim().toLowerCase(), item.id);
  });

  const rowsToUpdate: Array<{
    id: string;
    label: string;
    unit: string;
    unit_price_cents: number;
    category: string;
  }> = [];
  const rowsToInsert: Array<{
    label: string;
    unit: string;
    unit_price_cents: number;
    category: string;
    organization_id: string;
    user_id: string;
  }> = [];

  validRows.forEach((row) => {
    const existingId = existingByLabel.get(row.label.trim().toLowerCase());
    if (existingId) {
      rowsToUpdate.push({
        id: existingId,
        label: row.label,
        unit: row.unit,
        unit_price_cents: row.unitPriceCents,
        category: row.category,
      });
    } else {
      rowsToInsert.push({
        label: row.label,
        unit: row.unit,
        unit_price_cents: row.unitPriceCents,
        category: row.category,
        organization_id: org.organizationId,
        user_id: user.id,
      });
    }
  });

  if (rowsToUpdate.length > 0) {
    const { error: updateError } = await supabase
      .from("price_list_items")
      .upsert(rowsToUpdate, { onConflict: "id" });
    if (updateError) {
      console.error("Failed to bulk-update price list items from import:", updateError);
      return { error: "Import fehlgeschlagen. Es wurde nichts gespeichert." };
    }
  }

  if (rowsToInsert.length > 0) {
    const { error: insertError } = await supabase.from("price_list_items").insert(rowsToInsert);
    if (insertError) {
      console.error("Failed to bulk-insert price list items from import:", insertError);
      return { error: "Import fehlgeschlagen. Es wurden nur bestehende Positionen aktualisiert." };
    }
  }

  return { error: null, updated: rowsToUpdate.length, created: rowsToInsert.length };
}
