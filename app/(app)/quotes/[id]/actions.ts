"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/organizations/getCurrentOrg";
import { priceLineItem, computeTotals } from "@/lib/quotes/pricing";
import { computeExpiryDate } from "@/lib/quotes/expiry";
import { buildPhotoStoragePath, validatePhotoFile, QUOTE_PHOTOS_BUCKET } from "@/lib/quotes/photoValidation";
import { computeNextDueDate, isValidContractInterval, type ContractInterval } from "@/lib/contracts/interval";

type UpdateLineItemInput = {
  description: string;
  quantity: number;
  unit: string;
  unitPriceCents: number;
  costCents?: number | null;
};

type LineItemRow = {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price_cents: number;
  cost_cents: number | null;
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
  const costCents = input.costCents ?? null;
  if (costCents !== null && (!Number.isInteger(costCents) || costCents < 0)) {
    return { error: "Kosten müssen 0 oder größer sein." };
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
      cost_cents: costCents,
      line_total_cents: priced.lineTotalCents,
    })
    .eq("id", lineItemId)
    .eq("quote_id", quoteId);
  if (updateError) {
    return { error: "Position konnte nicht gespeichert werden." };
  }

  const { data: allItems, error: fetchError } = await supabase
    .from("quote_line_items")
    .select("id, description, quantity, unit, unit_price_cents, cost_cents, line_total_cents, position")
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

/**
 * Assigns a job/quote to an org member, or clears the assignment when
 * assigneeUserId is null (issue #128).
 *
 * This is purely a label on top of the existing org-membership RLS on
 * `quotes` (see 0023_job_assignment.sql) -- it does not grant or restrict
 * anyone's view/edit access, which stays governed by is_org_member as before.
 * What this action DOES enforce server-side:
 *   1. the caller must belong to an organization (any member, not owner-only
 *      -- assigning a helper to a job is an ordinary editing action, same
 *      bar as updateLineItem/finalizeQuote elsewhere in this file);
 *   2. the target quote must belong to the caller's org (never trust a
 *      client-supplied quoteId blindly -- RLS would reject the update anyway,
 *      but returning a clear error here is better UX than a silent no-op);
 *   3. the assignee, if any, must themselves be a member of that same org --
 *      same "server validates the target membership" pattern as
 *      settings/team/actions.ts's removeMember, so a client can't wire a job
 *      up to an arbitrary user id from another organization entirely.
 */
export async function assignQuote(
  quoteId: string,
  assigneeUserId: string | null,
): Promise<{ error: string | null }> {
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
    .select("id, organization_id")
    .eq("id", quoteId)
    .maybeSingle();
  if (!quote || quote.organization_id !== org.organizationId) {
    return { error: "Angebot nicht gefunden." };
  }

  if (assigneeUserId !== null) {
    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", org.organizationId)
      .eq("user_id", assigneeUserId)
      .maybeSingle();
    if (!membership) {
      return { error: "Person ist kein Mitglied dieses Unternehmens." };
    }
  }

  const { error: updateError } = await supabase
    .from("quotes")
    .update({ assigned_to: assigneeUserId })
    .eq("id", quoteId);
  if (updateError) {
    console.error("Failed to assign quote:", updateError);
    return { error: "Zuweisung konnte nicht gespeichert werden." };
  }

  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath("/jobs");
  return { error: null };
}

/**
 * Toggles the opt-in public before/after photo gallery for a quote (issue
 * #156). Defaults to OFF (see 0030_photo_gallery_sharing.sql) -- this is the
 * only path that can turn it on, and it always requires the caller to belong
 * to the quote's organization, same pattern as assignQuote above. Flipping
 * the flag back off takes effect immediately: the public gallery page
 * (app/gallery/[token]/page.tsx) re-checks gallery_enabled on every request,
 * it does not just rely on the token being unguessable.
 */
export async function setGallerySharing(
  quoteId: string,
  enabled: boolean,
): Promise<{ error: string | null }> {
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
    .select("id, organization_id")
    .eq("id", quoteId)
    .maybeSingle();
  if (!quote || quote.organization_id !== org.organizationId) {
    return { error: "Angebot nicht gefunden." };
  }

  const { error: updateError } = await supabase
    .from("quotes")
    .update({ gallery_enabled: enabled })
    .eq("id", quoteId);
  if (updateError) {
    console.error("Failed to update gallery sharing:", updateError);
    return { error: "Einstellung konnte nicht gespeichert werden." };
  }

  revalidatePath(`/quotes/${quoteId}`);
  return { error: null };
}

type ContractRow = {
  id: string;
  interval: ContractInterval;
  status: string;
  next_due_date: string;
};

type ConvertToContractResult =
  | { error: string; contract?: never }
  | { error: null; contract: ContractRow };

/**
 * Converts a signed quote (issue #126) into a recurring `contracts` row: the
 * contract-renewal cron (app/api/cron/contract-renewal/route.ts) picks up
 * active contracts whose next_due_date has arrived and generates a fresh
 * quote by duplicating this one. Only a 'signed' quote can be converted --
 * mirrors createInvoice's `.eq status "signed"` guard above, since a
 * maintenance contract only makes sense once the customer has actually
 * agreed to the original job.
 *
 * At most one contract per source quote (checked here, not enforced by a DB
 * unique constraint -- acceptable since this is a user-initiated action
 * behind a button, not a race-prone webhook like invoice creation).
 */
export async function convertQuoteToContract(
  quoteId: string,
  interval: string,
): Promise<ConvertToContractResult> {
  if (!isValidContractInterval(interval)) {
    return { error: "Ungültiges Intervall." };
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

  const { data: quote } = await supabase
    .from("quotes")
    .select("status, customer_id")
    .eq("id", quoteId)
    .single();
  if (!quote || quote.status !== "signed") {
    return { error: "Nur signierte Angebote können in einen Wartungsvertrag umgewandelt werden." };
  }

  const { data: existingContract } = await supabase
    .from("contracts")
    .select("id, interval, status, next_due_date")
    .eq("source_quote_id", quoteId)
    .maybeSingle();
  if (existingContract) {
    return { error: null, contract: existingContract };
  }

  const nextDueDate = computeNextDueDate(interval);

  const { data: contract, error: insertError } = await supabase
    .from("contracts")
    .insert({
      organization_id: org.organizationId,
      user_id: user.id,
      source_quote_id: quoteId,
      customer_id: quote.customer_id,
      interval,
      next_due_date: nextDueDate.toISOString().slice(0, 10),
    })
    .select("id, interval, status, next_due_date")
    .single();

  if (insertError || !contract) {
    console.error("Failed to create contract:", insertError);
    return { error: "Wartungsvertrag konnte nicht erstellt werden." };
  }

  return { error: null, contract };
}
