import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { QuotePdfDocument, type PdfLineItem, type PdfPhoto } from "../QuotePdfDocument";
import { QUOTE_PHOTOS_BUCKET } from "@/lib/quotes/photoValidation";

export const runtime = "nodejs";

const PHOTO_SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour, plenty for a PDF render

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("id, customer_description, subtotal_cents, vat_cents, total_cents, created_at")
    .eq("id", id)
    .maybeSingle();

  if (quoteError) {
    console.error("Failed to load quote for PDF", id, quoteError);
  }
  if (!quote) {
    return new Response("Not found", { status: 404 });
  }

  const { data: lineItems, error: lineItemsError } = await supabase
    .from("quote_line_items")
    .select("id, description, quantity, unit, unit_price_cents, line_total_cents, position, group_label")
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

  // Customer-visible photo-per-line-item (issue #208) -- only photos tagged
  // to a line item are needed here; general job photos aren't rendered in
  // the PDF today and this doesn't add that.
  const { data: photoRows, error: photoRowsError } = await supabase
    .from("quote_photos")
    .select("id, storage_path, quote_line_item_id")
    .eq("quote_id", id)
    .not("quote_line_item_id", "is", null);
  if (photoRowsError) {
    console.error("Failed to load photos for quote PDF", id, photoRowsError);
  }
  const photos: PdfPhoto[] = await Promise.all(
    (photoRows ?? []).map(async (photo) => {
      const { data: signed } = await supabase.storage
        .from(QUOTE_PHOTOS_BUCKET)
        .createSignedUrl(photo.storage_path, PHOTO_SIGNED_URL_TTL_SECONDS);
      return { id: photo.id, url: signed?.signedUrl ?? null, quote_line_item_id: photo.quote_line_item_id };
    }),
  );

  let buffer: Buffer;
  try {
    buffer = await renderToBuffer(
      <QuotePdfDocument
        quote={quote}
        lineItems={(lineItems ?? []) as PdfLineItem[]}
        businessSettings={businessSettings ?? null}
        photos={photos}
      />,
    );
  } catch (err) {
    console.error("Failed to render quote PDF", id, err);
    return new Response("PDF konnte nicht erstellt werden.", { status: 500 });
  }

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="angebot-${id}.pdf"`,
    },
  });
}
