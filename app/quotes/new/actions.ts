"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateLineItems, QuoteGenerationError } from "@/lib/quotes/generateLineItems";
import { priceLineItem, computeTotals } from "@/lib/quotes/pricing";

export type GenerateQuoteState = { error: string | null };

export async function generateQuoteDraft(
  _prevState: GenerateQuoteState,
  formData: FormData,
): Promise<GenerateQuoteState> {
  const description = formData.get("description");
  if (typeof description !== "string" || description.trim().length === 0) {
    return { error: "Bitte beschreibe den Auftrag." };
  }
  if (description.length > 2000) {
    return { error: "Die Beschreibung ist zu lang (max. 2000 Zeichen)." };
  }

  const supabase = await createClient();
  const { data: priceList, error: priceListError } = await supabase
    .from("price_list_items")
    .select("label, unit, unit_price_cents, category");
  if (priceListError || !priceList) {
    console.error("Failed to load price list:", priceListError);
    return { error: "Preisliste konnte nicht geladen werden." };
  }

  let lineItems;
  try {
    lineItems = await generateLineItems(
      description,
      priceList.map((p) => ({
        label: p.label,
        unit: p.unit,
        unitPriceCents: p.unit_price_cents,
        category: p.category,
      })),
    );
  } catch (err) {
    if (err instanceof QuoteGenerationError) {
      console.error("Quote generation failed:", err);
      return { error: `Angebot konnte nicht erstellt werden: ${err.message}` };
    }
    throw err;
  }

  const pricedItems = lineItems.map(priceLineItem);
  const totals = computeTotals(pricedItems);

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .insert({
      customer_description: description,
      status: "draft",
      subtotal_cents: totals.subtotalCents,
      vat_cents: totals.vatCents,
      total_cents: totals.totalCents,
    })
    .select("id")
    .single();
  if (quoteError || !quote) {
    console.error("Failed to insert quote:", quoteError);
    return { error: "Angebot konnte nicht gespeichert werden." };
  }

  const { error: lineItemsError } = await supabase.from("quote_line_items").insert(
    pricedItems.map((item, index) => ({
      quote_id: quote.id,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_price_cents: item.unitPriceCents,
      line_total_cents: item.lineTotalCents,
      position: index,
    })),
  );
  if (lineItemsError) {
    console.error("Failed to insert line items:", lineItemsError);
    await supabase.from("quotes").delete().eq("id", quote.id);
    return { error: "Positionen konnten nicht gespeichert werden." };
  }

  redirect(`/quotes/${quote.id}`);
}
