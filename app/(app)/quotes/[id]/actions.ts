"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrg } from "@/lib/organizations/getCurrentOrg";
import { syncInvoiceToLexoffice } from "@/lib/integrations/lexoffice/sync";
import { createInvoiceCheckoutSession } from "@/lib/stripe/connect";
import { priceLineItem, computeTotals } from "@/lib/quotes/pricing";
import { computeExpiryDate } from "@/lib/quotes/expiry";
import { buildPhotoStoragePath, validatePhotoFile, QUOTE_PHOTOS_BUCKET } from "@/lib/quotes/photoValidation";
import { computeNextDueDate, isValidContractInterval, type ContractInterval } from "@/lib/contracts/interval";
import {
  computeUpsellSuggestions,
  type HistoricalQuote,
  type UpsellSuggestion,
} from "@/lib/quotes/upsellSuggestions";

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
  payment_status: "unpaid" | "partial" | "paid";
  amount_paid_cents: number;
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
    .select("id, invoice_number, issued_at, subtotal_cents, vat_cents, total_cents, payment_status, amount_paid_cents")
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
    .select("id, invoice_number, issued_at, subtotal_cents, vat_cents, total_cents, payment_status, amount_paid_cents")
    .single();

  if (insertError) {
    // Likely lost a double-click race against unique (quote_id): another request
    // already created the invoice between our pre-check and this insert. Return the
    // now-existing invoice instead of surfacing an error.
    const { data: raceWinner } = await supabase
      .from("invoices")
      .select("id, invoice_number, issued_at, subtotal_cents, vat_cents, total_cents, payment_status, amount_paid_cents")
      .eq("quote_id", quoteId)
      .maybeSingle();
    if (raceWinner) {
      return { error: null, invoice: raceWinner };
    }
    console.error("Failed to create invoice:", insertError);
    return { error: "Rechnung konnte nicht erstellt werden." };
  }

  // Best-effort lexoffice push (issue #165): uses the service-role admin
  // client since it needs organizations.lexoffice_api_key, which is never
  // exposed via a client-scoped select. Never awaited-into-failure -- the
  // invoice above is already committed and returned to the caller regardless
  // of what happens here; syncInvoiceToLexoffice swallows all its own errors.
  await syncInvoiceToLexoffice(createAdminClient(), invoice.id);

  return { error: null, invoice };
}

type CreatePaymentSessionResult = { error: string | null; checkoutUrl?: string };

/**
 * Creates a Stripe Checkout Session ON THE ORGANIZATION'S CONNECTED ACCOUNT
 * for an invoice's full total (issue #131 -- customer payment collection,
 * NOT the SaaS-subscription checkout in app/(app)/billing/actions.ts).
 *
 * Requires the org to have finished Stripe Connect onboarding
 * (stripe_connect_onboarded), otherwise there is no connected account to
 * create the session against. Uses the admin client for the write (same
 * "no client-writable surface" reasoning as updateTeamPermissions) but reads
 * org/invoice state through the caller's RLS-scoped client first.
 */
export async function createInvoicePaymentSession(
  quoteId: string,
  invoiceId: string,
): Promise<CreatePaymentSessionResult> {
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

  const { data: orgRow } = await supabase
    .from("organizations")
    .select("stripe_connect_account_id, stripe_connect_onboarded")
    .eq("id", org.organizationId)
    .maybeSingle();
  if (!orgRow?.stripe_connect_onboarded || !orgRow.stripe_connect_account_id) {
    return { error: "Zahlungen sind noch nicht eingerichtet (Stripe verbinden)." };
  }

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, invoice_number, total_cents, payment_status, organization_id")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice || invoice.organization_id !== org.organizationId) {
    return { error: "Rechnung nicht gefunden." };
  }
  if (invoice.payment_status === "paid") {
    return { error: "Rechnung ist bereits bezahlt." };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const session = await createInvoiceCheckoutSession({
    connectedAccountId: orgRow.stripe_connect_account_id,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoice_number,
    totalCents: invoice.total_cents,
    successUrl: `${siteUrl}/quotes/${quoteId}?payment=success`,
    cancelUrl: `${siteUrl}/quotes/${quoteId}?payment=cancelled`,
  });

  if (!session.url) {
    return { error: "Stripe konnte keine Checkout-Sitzung erstellen." };
  }

  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from("invoices")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", invoice.id);
  if (updateError) {
    console.error("Failed to persist checkout session id:", updateError);
  }

  return { error: null, checkoutUrl: session.url };
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

/**
 * Configures (or clears) the deposit percentage a customer will be asked to
 * pay at signing time (issue #162). Allowed any time before the quote is
 * signed -- draft or final -- since the tradesperson may want to add a
 * deposit requirement right up until the customer actually confirms. Once a
 * quote is signed the amount is locked in (snapshotted onto
 * deposit_amount_cents by the sign flow in app/q/[token]/actions.ts), so
 * changing the percentage afterwards would be misleading and is rejected.
 *
 * The actual Stripe Checkout Session is only ever created later, at signing
 * time -- see lib/payments/createDepositCheckoutSession.ts -- this action
 * only stores the tradesperson's chosen percentage.
 */
export async function setDepositPercent(
  quoteId: string,
  percent: number | null,
): Promise<{ error: string | null }> {
  if (percent !== null && (!Number.isInteger(percent) || percent < 1 || percent > 100)) {
    return { error: "Anzahlung muss zwischen 1 und 100 Prozent liegen." };
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
    .select("id, organization_id, status")
    .eq("id", quoteId)
    .maybeSingle();
  if (!quote || quote.organization_id !== org.organizationId) {
    return { error: "Angebot nicht gefunden." };
  }
  if (quote.status === "signed" || quote.status === "declined") {
    return { error: "Anzahlung kann nach Unterschrift nicht mehr geändert werden." };
  }

  const { error: updateError } = await supabase
    .from("quotes")
    .update({ deposit_percent: percent })
    .eq("id", quoteId);
  if (updateError) {
    console.error("Failed to set deposit percent:", updateError);
    return { error: "Anzahlung konnte nicht gespeichert werden." };
  }

  revalidatePath(`/quotes/${quoteId}`);
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

/**
 * Computes "commonly paired" price-list item suggestions for a draft quote
 * (issue #159): items that, across the org's own past quotes, often appear
 * alongside the items already added to this one.
 *
 * Read-only analysis of existing data -- no new schema needed. Only draws on
 * the org's own historical quote_line_items (see
 * lib/quotes/upsellSuggestions.ts for the co-occurrence logic and the
 * "too little history" cutoff), never a static per-trade guess.
 */
export async function getUpsellSuggestions(quoteId: string): Promise<UpsellSuggestion[]> {
  const supabase = await createClient();

  const org = await getCurrentOrg(supabase);
  if (!org) return [];

  const { data: quote } = await supabase
    .from("quotes")
    .select("id, status")
    .eq("id", quoteId)
    .maybeSingle();
  if (!quote || quote.status !== "draft") return [];

  const { data: currentItems } = await supabase
    .from("quote_line_items")
    .select("price_list_item_id")
    .eq("quote_id", quoteId);
  const currentPriceListItemIds = (currentItems ?? [])
    .map((item) => item.price_list_item_id)
    .filter((id): id is string => id !== null);
  if (currentPriceListItemIds.length === 0) return [];

  // RLS scopes this to the caller's own org; excludes the current quote (a
  // quote can't be historical evidence for its own suggestions) and any line
  // item with no confident price-list match (nothing to key co-occurrence
  // off of -- see lib/inventory/matchPriceListItem.ts).
  const { data: historicalRows, error: historyError } = await supabase
    .from("quote_line_items")
    .select("quote_id, price_list_item_id")
    .neq("quote_id", quoteId)
    .not("price_list_item_id", "is", null);
  if (historyError) {
    console.error("Failed to load historical line items for upsell suggestions:", historyError);
    return [];
  }

  const { data: priceList, error: priceListError } = await supabase
    .from("price_list_items")
    .select("id, label, unit, unit_price_cents");
  if (priceListError || !priceList) {
    console.error("Failed to load price list for upsell suggestions:", priceListError);
    return [];
  }

  const byQuote = new Map<string, Set<string>>();
  for (const row of historicalRows ?? []) {
    if (!row.price_list_item_id) continue;
    const set = byQuote.get(row.quote_id) ?? new Set<string>();
    set.add(row.price_list_item_id);
    byQuote.set(row.quote_id, set);
  }
  const historicalQuotes: HistoricalQuote[] = [...byQuote.entries()].map(
    ([historyQuoteId, ids]) => ({
      quoteId: historyQuoteId,
      priceListItemIds: [...ids],
    }),
  );

  return computeUpsellSuggestions(
    historicalQuotes,
    currentPriceListItemIds,
    priceList.map((p) => ({
      id: p.id,
      label: p.label,
      unit: p.unit,
      unitPriceCents: p.unit_price_cents,
    })),
  );
}

type AddSuggestedLineItemResult =
  | { error: string; lineItems?: never; totals?: never }
  | {
      error: null;
      lineItems: LineItemRow[];
      totals: { subtotalCents: number; vatCents: number; totalCents: number };
    };

/**
 * Adds one of the suggested price-list items (from getUpsellSuggestions)
 * onto a draft quote as a new line item, priced straight from the price
 * list (quantity 1), and recomputes totals -- mirrors updateLineItem's
 * draft-only guard and totals recompute.
 */
export async function addSuggestedLineItem(
  quoteId: string,
  priceListItemId: string,
): Promise<AddSuggestedLineItemResult> {
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
    .select("id, status, organization_id")
    .eq("id", quoteId)
    .maybeSingle();
  if (!quote || quote.organization_id !== org.organizationId) {
    return { error: "Angebot nicht gefunden." };
  }
  if (quote.status !== "draft") {
    return { error: "Angebot ist bereits final und kann nicht mehr bearbeitet werden." };
  }

  const { data: priceListItem } = await supabase
    .from("price_list_items")
    .select("id, label, unit, unit_price_cents")
    .eq("id", priceListItemId)
    .eq("organization_id", org.organizationId)
    .maybeSingle();
  if (!priceListItem) {
    return { error: "Preislistenposition nicht gefunden." };
  }

  const { data: existingItems } = await supabase
    .from("quote_line_items")
    .select("position")
    .eq("quote_id", quoteId)
    .order("position", { ascending: false })
    .limit(1);
  const nextPosition = (existingItems?.[0]?.position ?? -1) + 1;

  const priced = priceLineItem({
    description: priceListItem.label,
    quantity: 1,
    unit: priceListItem.unit,
    unitPriceCents: priceListItem.unit_price_cents,
  });

  const { error: insertError } = await supabase.from("quote_line_items").insert({
    quote_id: quoteId,
    description: priced.description,
    quantity: priced.quantity,
    unit: priced.unit,
    unit_price_cents: priced.unitPriceCents,
    line_total_cents: priced.lineTotalCents,
    position: nextPosition,
    organization_id: org.organizationId,
    user_id: user.id,
    price_list_item_id: priceListItem.id,
  });
  if (insertError) {
    console.error("Failed to add suggested line item:", insertError);
    return { error: "Position konnte nicht hinzugefügt werden." };
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

  revalidatePath(`/quotes/${quoteId}`);
  return { error: null, lineItems: allItems, totals };
}

const MAX_COMMENT_LENGTH = 2000;

export type QuoteCommentRow = {
  id: string;
  author_type: "customer" | "member";
  author_name: string;
  body: string;
  created_at: string;
};

// Tradesperson-side half of the #155 comment thread. Regular org-scoped
// client (not the admin client) -- reads/writes are covered entirely by
// quote_comments' is_org_member RLS policies (0029_quote_comments.sql), same
// as the rest of this file. author_name is the member's own email, since
// there's no display-name field on organization_members to draw from
// (getOrgMembers.ts uses the same fallback for the assign-to selector).
export async function addMemberComment(
  quoteId: string,
  body: string,
): Promise<{ error: string | null; comment?: QuoteCommentRow }> {
  const trimmedBody = body.trim().slice(0, MAX_COMMENT_LENGTH);
  if (trimmedBody.length === 0) {
    return { error: "Bitte geben Sie eine Nachricht ein." };
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
    .select("id, organization_id")
    .eq("id", quoteId)
    .maybeSingle();
  if (!quote || quote.organization_id !== org.organizationId) {
    return { error: "Angebot nicht gefunden." };
  }

  const { data: comment, error: insertError } = await supabase
    .from("quote_comments")
    .insert({
      organization_id: org.organizationId,
      quote_id: quoteId,
      author_type: "member",
      author_name: user.email ?? "Team",
      member_id: user.id,
      body: trimmedBody,
    })
    .select("id, author_type, author_name, body, created_at")
    .single();
  if (insertError || !comment) {
    console.error("Failed to insert member comment:", insertError);
    return { error: "Nachricht konnte nicht gespeichert werden." };
  }

  revalidatePath(`/quotes/${quoteId}`);

  return { error: null, comment };
}
