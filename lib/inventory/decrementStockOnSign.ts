import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Decrements stock_quantity for every price-list-linked line item on a
 * just-signed quote, gated on the org's inventory_decrement_enabled toggle
 * (see 0020_materials_inventory.sql). Called from signQuote() as a
 * best-effort side effect -- the caller wraps this in try/catch and must
 * never let a failure here affect the result returned to the customer, who
 * has already successfully signed by the time this runs.
 *
 * Uses the decrement_price_list_stock() Postgres function (atomic
 * read+write, floors at 0, no-ops for items that aren't track_stock) rather
 * than a client-side read-then-write, to avoid races between concurrently
 * signed quotes touching the same price list item.
 */
export async function decrementStockOnSign(
  supabase: SupabaseClient,
  organizationId: string,
  quoteId: string,
): Promise<void> {
  const { data: orgRow, error: orgError } = await supabase
    .from("organizations")
    .select("inventory_decrement_enabled")
    .eq("id", organizationId)
    .maybeSingle();
  if (orgError) {
    console.error("Failed to look up organization inventory setting:", orgError);
    return;
  }
  if (!orgRow?.inventory_decrement_enabled) {
    return;
  }

  const { data: lineItems, error: lineItemsError } = await supabase
    .from("quote_line_items")
    .select("price_list_item_id, quantity")
    .eq("quote_id", quoteId)
    .not("price_list_item_id", "is", null);
  if (lineItemsError) {
    console.error("Failed to load line items for stock decrement:", lineItemsError);
    return;
  }

  for (const item of lineItems ?? []) {
    if (!item.price_list_item_id) continue;
    const { error: rpcError } = await supabase.rpc("decrement_price_list_stock", {
      item_id: item.price_list_item_id,
      qty: item.quantity,
    });
    if (rpcError) {
      console.error(
        `Failed to decrement stock for price_list_item ${item.price_list_item_id}:`,
        rpcError,
      );
      // Continue with remaining line items rather than aborting the whole
      // batch over one bad row.
    }
  }
}
