import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { QuoteEditor } from "./QuoteEditor";

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select("id, customer_description, status, subtotal_cents, vat_cents, total_cents")
    .eq("id", id)
    .single();
  if (!quote) notFound();

  const { data: lineItems, error: lineItemsError } = await supabase
    .from("quote_line_items")
    .select("id, description, quantity, unit, unit_price_cents, line_total_cents, position")
    .eq("quote_id", id)
    .order("position");
  if (lineItemsError) {
    console.error("Failed to load line items for quote", id, lineItemsError);
    notFound();
  }

  return <QuoteEditor quote={quote} lineItems={lineItems ?? []} />;
}
