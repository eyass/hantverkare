import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrg } from "@/lib/organizations/getCurrentOrg";
import { getOrgMembers } from "@/lib/organizations/getOrgMembers";
import { QuoteEditor } from "./QuoteEditor";
import { QUOTE_PHOTOS_BUCKET } from "@/lib/quotes/photoValidation";

const PHOTO_SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour, plenty for a page view

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select(
      "id, customer_description, status, subtotal_cents, vat_cents, total_cents, share_token, declined_at, decline_reason, assigned_to",
    )
    .eq("id", id)
    .single();
  if (!quote) notFound();

  // Members list for the "assign to" selector (issue #128). Emails require
  // the admin client (see getOrgMembers); the assign action itself still
  // re-validates membership server-side, this is just for the dropdown.
  const org = await getCurrentOrg(supabase);
  const members = org ? await getOrgMembers(createAdminClient(), org.organizationId) : [];

  const { data: lineItems, error: lineItemsError } = await supabase
    .from("quote_line_items")
    .select("id, description, quantity, unit, unit_price_cents, cost_cents, line_total_cents, position")
    .eq("quote_id", id)
    .order("position");
  if (lineItemsError) {
    console.error("Failed to load line items for quote", id, lineItemsError);
    notFound();
  }

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, invoice_number, issued_at, subtotal_cents, vat_cents, total_cents")
    .eq("quote_id", id)
    .maybeSingle();

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

  return (
    <QuoteEditor
      quote={quote}
      lineItems={lineItems ?? []}
      invoice={invoice ?? null}
      photos={photos}
      warranty={warranty ?? null}
      scheduledJob={scheduledJob ?? null}
      members={members}
    />
  );
}
