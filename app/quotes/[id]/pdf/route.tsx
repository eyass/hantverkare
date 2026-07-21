import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { QuotePdfDocument, type PdfLineItem } from "../QuotePdfDocument";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select("id, customer_description, subtotal_cents, vat_cents, total_cents, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!quote) {
    return new Response("Not found", { status: 404 });
  }

  const { data: lineItems, error: lineItemsError } = await supabase
    .from("quote_line_items")
    .select("id, description, quantity, unit, unit_price_cents, line_total_cents, position")
    .eq("quote_id", id)
    .order("position");

  if (lineItemsError) {
    console.error("Failed to load line items for quote PDF", id, lineItemsError);
  }

  const { data: businessSettings, error: businessSettingsError } = await supabase
    .from("business_settings")
    .select("company_name, address, vat_id, tax_number")
    .maybeSingle();

  if (businessSettingsError) {
    console.error("Failed to load business settings for quote PDF", id, businessSettingsError);
  }

  const buffer = await renderToBuffer(
    <QuotePdfDocument
      quote={quote}
      lineItems={(lineItems ?? []) as PdfLineItem[]}
      businessSettings={businessSettings ?? null}
    />,
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="angebot-${id}.pdf"`,
    },
  });
}
