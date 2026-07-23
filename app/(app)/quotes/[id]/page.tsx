import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrg } from "@/lib/organizations/getCurrentOrg";
import { getOrgMembers } from "@/lib/organizations/getOrgMembers";
import { QuoteEditor } from "./QuoteEditor";
import { QUOTE_PHOTOS_BUCKET } from "@/lib/quotes/photoValidation";
import { getUpsellSuggestions, getUnbilledHoursForQuote } from "./actions";
import { getCostEstimationSuggestions } from "@/lib/quotes/getCostEstimationSuggestions";

const PHOTO_SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour, plenty for a page view

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select(
      "id, customer_description, status, subtotal_cents, vat_cents, total_cents, share_token, gallery_token, gallery_enabled, declined_at, decline_reason, assigned_to, deposit_percent, deposit_amount_cents, deposit_paid_at, ai_risk_flags, ai_risk_flags_acknowledged_at, ai_clarifying_questions, ai_clarifying_questions_resolved_at",
    )
    .eq("id", id)
    .single();
  if (!quote) {
    // A query error (e.g. a column that doesn't exist yet because a pending
    // migration hasn't been applied) looks identical to "no such row" from
    // here on -- log it distinctly so it's diagnosable in server logs instead
    // of just presenting as an indistinguishable 404.
    if (quoteError) {
      console.error("Failed to load quote", id, quoteError);
    }
    notFound();
  }

  const { data: commentRows } = await supabase
    .from("quote_comments")
    .select("id, author_type, author_name, body, created_at")
    .eq("quote_id", id)
    .order("created_at", { ascending: true });

  // Members list for the "assign to" selector (issue #128). Emails require
  // the admin client (see getOrgMembers); the assign action itself still
  // re-validates membership server-side, this is just for the dropdown.
  const org = await getCurrentOrg(supabase);
  const members = org ? await getOrgMembers(createAdminClient(), org.organizationId) : [];

  const { data: lineItems, error: lineItemsError } = await supabase
    .from("quote_line_items")
    .select(
      "id, description, quantity, unit, unit_price_cents, cost_cents, line_total_cents, position, price_list_item_id",
    )
    .eq("quote_id", id)
    .order("position");
  if (lineItemsError) {
    console.error("Failed to load line items for quote", id, lineItemsError);
    notFound();
  }

  // Soft, dismissible cost suggestions (issue #160) -- read-only, never
  // blocks the page if it fails.
  const costSuggestions = org
    ? await getCostEstimationSuggestions(supabase, {
        organizationId: org.organizationId,
        quoteId: id,
        lineItems: (lineItems ?? []).map((item) => ({
          id: item.id,
          price_list_item_id: item.price_list_item_id,
          unit_price_cents: item.unit_price_cents,
        })),
      })
    : {};

  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, issued_at, subtotal_cents, vat_cents, total_cents, payment_status, amount_paid_cents",
    )
    .eq("quote_id", id)
    .maybeSingle();

  // Payment collection (issue #131) only makes sense once the org has
  // finished Stripe Connect onboarding -- read-only flag, no secrets exposed
  // to the client.
  const { data: orgRow } = org
    ? await supabase
        .from("organizations")
        .select("stripe_connect_onboarded")
        .eq("id", org.organizationId)
        .maybeSingle()
    : { data: null };
  const connectOnboarded = orgRow?.stripe_connect_onboarded ?? false;

  const { data: warranty } = await supabase
    .from("warranty_records")
    .select("id, warranty_start_date, warranty_period_months, warranty_expiry_date")
    .eq("quote_id", id)
    .maybeSingle();

  const { data: scheduledJob } = await supabase
    .from("scheduled_jobs")
    .select("id, scheduled_start, scheduled_end, notes")
    .eq("quote_id", id)
    .maybeSingle();

  const { data: contract } = await supabase
    .from("contracts")
    .select("id, interval, status, next_due_date")
    .eq("source_quote_id", id)
    .maybeSingle();

  const { data: photoRows } = await supabase
    .from("quote_photos")
    .select("id, storage_path, caption, quote_line_item_id")
    .eq("quote_id", id)
    .order("created_at", { ascending: false });

  const photos = await Promise.all(
    (photoRows ?? []).map(async (photo) => {
      const { data: signed } = await supabase.storage
        .from(QUOTE_PHOTOS_BUCKET)
        .createSignedUrl(photo.storage_path, PHOTO_SIGNED_URL_TTL_SECONDS);
      return {
        id: photo.id,
        url: signed?.signedUrl ?? null,
        caption: photo.caption,
        quote_line_item_id: photo.quote_line_item_id,
      };
    }),
  );

  // Upsell suggestions (issue #159) only make sense while the quote is still
  // a draft being built -- a finalized/signed quote's items are locked, so
  // there's nothing left to add.
  const upsellSuggestions = quote.status === "draft" ? await getUpsellSuggestions(id) : [];

  // Only worth computing once there's a scheduled job with hours to bill and
  // no invoice yet -- once an invoice exists, hours were already reconciled
  // (or the tradesperson opted not to) and can't be appended again.
  const unbilledHours =
    scheduledJob && !invoice ? await getUnbilledHoursForQuote(id) : 0;

  return (
    <QuoteEditor
      quote={quote}
      lineItems={lineItems ?? []}
      invoice={invoice ?? null}
      unbilledHours={unbilledHours}
      connectOnboarded={connectOnboarded}
      contract={contract ?? null}
      photos={photos}
      warranty={warranty ?? null}
      scheduledJob={scheduledJob ?? null}
      members={members}
      upsellSuggestions={upsellSuggestions}
      comments={commentRows ?? []}
      costSuggestions={costSuggestions}
    />
  );
}
