"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/organizations/getCurrentOrg";
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
  if (input.quantity <= 0 || input.unitPriceCents <= 0 || !Number.isInteger(input.unitPriceCents)) {
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

type InvoiceRow = {
  id: string;
  invoice_number: string;
  issued_at: string;
  subtotal_cents: number;
  vat_cents: number;
  total_cents: number;
};

type CreateInvoiceResult =
  | { error: string; invoice?: never }
  | { error: null; invoice: InvoiceRow };

export async function createInvoice(quoteId: string): Promise<CreateInvoiceResult> {
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

  const { data: quote } = await supabase
    .from("quotes")
    .select("status, subtotal_cents, vat_cents, total_cents")
    .eq("id", quoteId)
    .single();
  if (!quote || quote.status !== "signed") {
    return { error: "Nur signierte Angebote können in Rechnung gestellt werden." };
  }

  const { data: existingInvoice } = await supabase
    .from("invoices")
    .select("id, invoice_number, issued_at, subtotal_cents, vat_cents, total_cents")
    .eq("quote_id", quoteId)
    .maybeSingle();
  if (existingInvoice) {
    return { error: null, invoice: existingInvoice };
  }

  const { data: invoiceNumber, error: rpcError } = await supabase.rpc("next_invoice_number");
  if (rpcError || !invoiceNumber) {
    console.error("Failed to generate invoice number:", rpcError);
    return { error: "Rechnungsnummer konnte nicht erzeugt werden." };
  }

  const { data: invoice, error: insertError } = await supabase
    .from("invoices")
    .insert({
      organization_id: org.organizationId,
      user_id: user.id,
      quote_id: quoteId,
      invoice_number: invoiceNumber,
      subtotal_cents: quote.subtotal_cents,
      vat_cents: quote.vat_cents,
      total_cents: quote.total_cents,
    })
    .select("id, invoice_number, issued_at, subtotal_cents, vat_cents, total_cents")
    .single();

  if (insertError) {
    // Likely lost a double-click race against unique (quote_id): another request
    // already created the invoice between our pre-check and this insert. Return the
    // now-existing invoice instead of surfacing an error.
    const { data: raceWinner } = await supabase
      .from("invoices")
      .select("id, invoice_number, issued_at, subtotal_cents, vat_cents, total_cents")
      .eq("quote_id", quoteId)
      .maybeSingle();
    if (raceWinner) {
      return { error: null, invoice: raceWinner };
    }
    console.error("Failed to create invoice:", insertError);
    return { error: "Rechnung konnte nicht erstellt werden." };
  }

  return { error: null, invoice };
}

export async function finalizeQuote(quoteId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("quotes")
    .update({ status: "final", finalized_at: new Date().toISOString() })
    .eq("id", quoteId)
    .eq("status", "draft")
    .select("id");
  if (error || !data || data.length === 0) {
    console.error("Failed to finalize quote:", error);
    return { error: "Angebot ist bereits final." };
  }

  return { error: null };
}
