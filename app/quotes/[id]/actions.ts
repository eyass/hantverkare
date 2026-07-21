"use server";

import { createClient } from "@/lib/supabase/server";
import { priceLineItem, computeTotals } from "@/lib/quotes/pricing";

type UpdateLineItemInput = {
  description: string;
  quantity: number;
  unit: string;
  unitPriceCents: number;
};

type LineItemRow = {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price_cents: number;
  line_total_cents: number;
  position: number;
};

type UpdateLineItemResult =
  | { error: string; lineItems?: never; totals?: never }
  | {
      error: null;
      lineItems: LineItemRow[];
      totals: { subtotalCents: number; vatCents: number; totalCents: number };
    };

export async function updateLineItem(
  quoteId: string,
  lineItemId: string,
  input: UpdateLineItemInput,
): Promise<UpdateLineItemResult> {
  if (input.quantity <= 0 || input.unitPriceCents <= 0) {
    return { error: "Menge und Preis müssen größer als 0 sein." };
  }

  const supabase = await createClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select("status")
    .eq("id", quoteId)
    .single();
  if (!quote || quote.status !== "draft") {
    return { error: "Angebot ist bereits final und kann nicht mehr bearbeitet werden." };
  }

  const priced = priceLineItem({
    description: input.description,
    quantity: input.quantity,
    unit: input.unit,
    unitPriceCents: input.unitPriceCents,
  });

  const { error: updateError } = await supabase
    .from("quote_line_items")
    .update({
      description: priced.description,
      quantity: priced.quantity,
      unit: priced.unit,
      unit_price_cents: priced.unitPriceCents,
      line_total_cents: priced.lineTotalCents,
    })
    .eq("id", lineItemId)
    .eq("quote_id", quoteId);
  if (updateError) {
    return { error: "Position konnte nicht gespeichert werden." };
  }

  const { data: allItems, error: fetchError } = await supabase
    .from("quote_line_items")
    .select("id, description, quantity, unit, unit_price_cents, line_total_cents, position")
    .eq("quote_id", quoteId)
    .order("position");
  if (fetchError || !allItems) {
    return { error: "Positionen konnten nicht geladen werden." };
  }

  const totals = computeTotals(
    allItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPriceCents: item.unit_price_cents,
      lineTotalCents: item.line_total_cents,
    })),
  );

  const { error: totalsError } = await supabase
    .from("quotes")
    .update({
      subtotal_cents: totals.subtotalCents,
      vat_cents: totals.vatCents,
      total_cents: totals.totalCents,
    })
    .eq("id", quoteId);
  if (totalsError) {
    return { error: "Summen konnten nicht aktualisiert werden." };
  }

  return { error: null, lineItems: allItems, totals };
}

export async function finalizeQuote(quoteId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select("status")
    .eq("id", quoteId)
    .single();
  if (!quote || quote.status !== "draft") {
    return { error: "Angebot ist bereits final." };
  }

  const { error } = await supabase
    .from("quotes")
    .update({ status: "final", finalized_at: new Date().toISOString() })
    .eq("id", quoteId);
  if (error) {
    return { error: "Angebot konnte nicht finalisiert werden." };
  }

  return { error: null };
}
