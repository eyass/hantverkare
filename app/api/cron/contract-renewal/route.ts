import { createAdminClient } from "@/lib/supabase/admin";
import { computeNextDueDate, isValidContractInterval } from "@/lib/contracts/interval";
import { VAT_RATE } from "@/lib/quotes/pricing";

// Recurring maintenance contracts (issue #126): once a signed quote is
// converted into a `contracts` row (see the "convert to contract" action in
// app/(app)/quotes/[id]/actions.ts), this cron regenerates a fresh draft
// quote for the customer every time the contract's next_due_date arrives,
// then advances next_due_date by one more interval.
//
// Mirrors app/api/cron/quote-expiry-reminders/route.ts exactly for auth and
// deployment shape: same CRON_SECRET bearer-token check (see isAuthorized
// below), same service-role admin client (no auth.uid() on a cron-triggered
// request, so RLS can't scope a normal client -- see quote-expiry-reminders
// for the full reasoning), and the same "one entry in vercel.json's crons
// array" registration.
//
// Deliberately does NOT send any email/SMS notification: unlike the expiry
// reminder, there is no customer-facing "your quote is about to expire"
// moment here -- generating the next period's quote is the entire feature.
// A human still needs to open the new draft and finalize/send it themselves,
// same as any other draft quote in the quotes list.
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Fail closed, matching quote-expiry-reminders/route.ts: an unconfigured
    // secret must never be treated as "no auth required".
    console.error("CRON_SECRET is not set; rejecting cron request.");
    return false;
  }
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: contracts, error } = await supabase
    .from("contracts")
    .select("id, organization_id, user_id, source_quote_id, customer_id, interval, next_due_date")
    .eq("status", "active")
    .lte("next_due_date", today);

  if (error) {
    console.error("Failed to load due contracts:", error);
    return Response.json({ error: "Failed to load contracts." }, { status: 500 });
  }

  let renewed = 0;
  let failed = 0;

  for (const contract of contracts ?? []) {
    try {
      if (!isValidContractInterval(contract.interval)) {
        console.error("Contract has an invalid interval, skipping:", contract.id, contract.interval);
        failed += 1;
        continue;
      }

      const { data: sourceQuote, error: sourceQuoteError } = await supabase
        .from("quotes")
        .select("customer_description")
        .eq("id", contract.source_quote_id)
        .maybeSingle();
      if (sourceQuoteError || !sourceQuote) {
        console.error("Failed to load source quote for contract:", contract.id, sourceQuoteError);
        failed += 1;
        continue;
      }

      const { data: sourceLineItems, error: sourceLineItemsError } = await supabase
        .from("quote_line_items")
        .select("description, quantity, unit, unit_price_cents, cost_cents, line_total_cents, position")
        .eq("quote_id", contract.source_quote_id)
        .order("position");
      if (sourceLineItemsError || !sourceLineItems) {
        console.error("Failed to load source line items for contract:", contract.id, sourceLineItemsError);
        failed += 1;
        continue;
      }

      const subtotalCents = sourceLineItems.reduce((sum, item) => sum + item.line_total_cents, 0);
      // Uses computeTotals' VAT_RATE directly rather than calling computeTotals
      // itself, since that function recomputes line totals from priced items --
      // here we want an exact copy of the source quote's per-line totals,
      // same "freeze at copy time" philosophy as invoices (0008_invoices.sql).
      const vatCents = Math.round(subtotalCents * VAT_RATE);
      const totalCents = subtotalCents + vatCents;

      const { data: newQuote, error: newQuoteError } = await supabase
        .from("quotes")
        .insert({
          organization_id: contract.organization_id,
          user_id: contract.user_id,
          customer_id: contract.customer_id,
          customer_description: sourceQuote.customer_description,
          status: "draft",
          subtotal_cents: subtotalCents,
          vat_cents: vatCents,
          total_cents: totalCents,
        })
        .select("id")
        .single();
      if (newQuoteError || !newQuote) {
        console.error("Failed to create renewal quote for contract:", contract.id, newQuoteError);
        failed += 1;
        continue;
      }

      const { error: newLineItemsError } = await supabase.from("quote_line_items").insert(
        sourceLineItems.map((item) => ({
          quote_id: newQuote.id,
          organization_id: contract.organization_id,
          user_id: contract.user_id,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price_cents: item.unit_price_cents,
          cost_cents: item.cost_cents,
          line_total_cents: item.line_total_cents,
          position: item.position,
        })),
      );
      if (newLineItemsError) {
        console.error("Failed to create renewal line items for contract:", contract.id, newLineItemsError);
        // Best-effort cleanup so a failed renewal doesn't leave an empty quote
        // behind, mirroring generateQuoteDraft's own rollback-on-failure.
        await supabase.from("quotes").delete().eq("id", newQuote.id);
        failed += 1;
        continue;
      }

      const nextDueDate = computeNextDueDate(contract.interval, new Date(contract.next_due_date));
      const { error: advanceError } = await supabase
        .from("contracts")
        .update({
          next_due_date: nextDueDate.toISOString().slice(0, 10),
          updated_at: new Date().toISOString(),
        })
        .eq("id", contract.id)
        .eq("next_due_date", contract.next_due_date);
      if (advanceError) {
        console.error("Failed to advance next_due_date for contract:", contract.id, advanceError);
        failed += 1;
        continue;
      }

      renewed += 1;
    } catch (err) {
      console.error("Unexpected error renewing contract:", contract.id, err);
      failed += 1;
    }
  }

  return Response.json({ checked: contracts?.length ?? 0, renewed, failed });
}
