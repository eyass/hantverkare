"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/organizations/getCurrentOrg";
import { priceLineItem, computeTotals } from "@/lib/quotes/pricing";
import { computeExpiryDate } from "@/lib/quotes/expiry";
import { buildPhotoStoragePath, validatePhotoFile, QUOTE_PHOTOS_BUCKET } from "@/lib/quotes/photoValidation";

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

  const now = new Date();
  const { data, error } = await supabase
    .from("quotes")
    .update({
      status: "final",
      finalized_at: now.toISOString(),
      expires_at: computeExpiryDate(now).toISOString(),
    })
    .eq("id", quoteId)
    .eq("status", "draft")
    .select("id");
  if (error || !data || data.length === 0) {
    console.error("Failed to finalize quote:", error);
    return { error: "Angebot ist bereits final." };
  }

  return { error: null };
}

type PhotoRow = {
  id: string;
  storage_path: string;
  caption: string | null;
  quote_line_item_id: string | null;
  created_at: string;
};

type AddPhotoResult =
  | { error: string; photo?: never }
  | { error: null; photo: PhotoRow };

/**
 * Uploads a job-site photo to Storage and records it against a quote (and
 * optionally one of its line items). Takes FormData rather than plain
 * arguments because a File can only cross the server-action boundary via
 * multipart form data.
 *
 * organization_id is NEVER taken from the client: it is resolved here via
 * getCurrentOrg from the authenticated session, then used both to build the
 * storage path prefix (which storage.objects RLS checks) and to stamp the
 * quote_photos row (which table RLS checks). quoteId/lineItemId are
 * client-supplied but are only ever used as filters against tables that are
 * themselves org-scoped by RLS -- a request for another org's quote_id
 * simply finds no row and errors out, it can't leak or attach to it.
 */
export async function addQuotePhoto(formData: FormData): Promise<AddPhotoResult> {
  const quoteId = formData.get("quoteId");
  const lineItemIdRaw = formData.get("lineItemId");
  const captionRaw = formData.get("caption");
  const file = formData.get("file");

  if (typeof quoteId !== "string" || quoteId.length === 0) {
    return { error: "Angebot fehlt." };
  }
  if (!(file instanceof File)) {
    return { error: "Keine Datei ausgewählt." };
  }
  const lineItemId = typeof lineItemIdRaw === "string" && lineItemIdRaw.length > 0 ? lineItemIdRaw : null;
  const caption = typeof captionRaw === "string" && captionRaw.trim().length > 0 ? captionRaw.trim() : null;

  const validation = validatePhotoFile({ type: file.type, size: file.size });
  if (!validation.ok) {
    return { error: validation.error };
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

  const { data: quote } = await supabase.from("quotes").select("id").eq("id", quoteId).maybeSingle();
  if (!quote) {
    return { error: "Angebot nicht gefunden." };
  }

  if (lineItemId) {
    const { data: lineItem } = await supabase
      .from("quote_line_items")
      .select("id")
      .eq("id", lineItemId)
      .eq("quote_id", quoteId)
      .maybeSingle();
    if (!lineItem) {
      return { error: "Position nicht gefunden." };
    }
  }

  const storagePath = buildPhotoStoragePath(org.organizationId, quoteId, file.name);

  const { error: uploadError } = await supabase.storage
    .from(QUOTE_PHOTOS_BUCKET)
    .upload(storagePath, file, { contentType: file.type || undefined });
  if (uploadError) {
    console.error("Failed to upload quote photo:", uploadError);
    return { error: "Foto konnte nicht hochgeladen werden." };
  }

  const { data: photo, error: insertError } = await supabase
    .from("quote_photos")
    .insert({
      organization_id: org.organizationId,
      quote_id: quoteId,
      quote_line_item_id: lineItemId,
      storage_path: storagePath,
      caption,
      created_by: user.id,
    })
    .select("id, storage_path, caption, quote_line_item_id, created_at")
    .single();

  if (insertError || !photo) {
    console.error("Failed to save quote photo record:", insertError);
    // Best-effort cleanup so a failed insert doesn't leave an orphaned object.
    await supabase.storage.from(QUOTE_PHOTOS_BUCKET).remove([storagePath]);
    return { error: "Foto konnte nicht gespeichert werden." };
  }

  return { error: null, photo };
}

/**
 * Deletes a quote photo: removes the Storage object first, then the
 * quote_photos row. The row lookup is filtered only by id -- RLS on
 * quote_photos (is_org_member(organization_id)) is what actually prevents a
 * user from deleting another org's photo, so a mismatched id simply returns
 * no row here rather than needing an explicit org check.
 */
export async function deleteQuotePhoto(photoId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { data: photo } = await supabase
    .from("quote_photos")
    .select("id, storage_path")
    .eq("id", photoId)
    .maybeSingle();
  if (!photo) {
    return { error: "Foto nicht gefunden." };
  }

  const { error: storageError } = await supabase.storage.from(QUOTE_PHOTOS_BUCKET).remove([photo.storage_path]);
  if (storageError) {
    console.error("Failed to delete quote photo from storage:", storageError);
    return { error: "Foto konnte nicht gelöscht werden." };
  }

  const { error: deleteError } = await supabase.from("quote_photos").delete().eq("id", photoId);
  if (deleteError) {
    console.error("Failed to delete quote photo record:", deleteError);
    return { error: "Foto konnte nicht gelöscht werden." };
  }

  return { error: null };
}
