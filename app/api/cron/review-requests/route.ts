import { createAdminClient } from "@/lib/supabase/admin";
import { sendReviewRequestEmail } from "@/lib/notifications/sendReviewRequestEmail";
import { daysSincePaid, isReviewRequestDue } from "@/lib/invoices/reviewRequest";

// Automated review-request follow-up (issue #157): a one-time email per paid
// invoice, sent `review_request_days` days after payment, only for
// organizations that opted in and configured a review-platform link.
// Structured identically to app/api/cron/invoice-dunning/route.ts -- same
// CRON_SECRET bearer-token auth, same admin-client-because-no-session
// reasoning, same "look up org/customer, best-effort send, then stamp the
// timestamp" shape. See that file's comments for the full auth rationale.
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
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
  const now = new Date();

  // Candidates: invoices with a real paid_at (issue #157: never fabricate a
  // "paid" state for invoices that don't have one yet) that haven't already
  // received a review request. We can't push the per-organization
  // review_request_days threshold into this query, so it intentionally
  // over-fetches every paid invoice awaiting a request and
  // isReviewRequestDue() decides in-process whether it's actually due.
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("id, organization_id, quote_id, invoice_number, paid_at")
    .not("paid_at", "is", null)
    .is("review_request_sent_at", null);

  if (error) {
    console.error("Failed to load invoices due for review request:", error);
    return Response.json({ error: "Failed to load invoices." }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const invoice of invoices ?? []) {
    try {
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("name, review_request_enabled, review_request_days, review_platform_url")
        .eq("id", invoice.organization_id)
        .maybeSingle();

      if (orgError || !org) {
        console.error("Failed to look up organization review-request settings:", invoice.id, orgError);
        failed += 1;
        continue;
      }

      // Opt-in feature, off by default: skip entirely unless the owner
      // enabled it AND configured a platform link (no link means nowhere
      // to send the customer).
      if (!org.review_request_enabled || !org.review_platform_url) {
        skipped += 1;
        continue;
      }

      const paidAt = new Date(invoice.paid_at as string);
      const elapsed = daysSincePaid(paidAt, now);

      if (!isReviewRequestDue(elapsed, org.review_request_days, null)) {
        skipped += 1;
        continue;
      }

      // Look up the customer via the invoice's originating quote (invoices
      // don't store customer_id directly -- see 0008_invoices.sql).
      const { data: quote, error: quoteError } = await supabase
        .from("quotes")
        .select("customer_id")
        .eq("id", invoice.quote_id)
        .maybeSingle();
      if (quoteError) {
        console.error("Failed to look up quote for review request:", invoice.id, quoteError);
      }

      let customerEmail: string | null = null;
      if (quote?.customer_id) {
        const { data: customer, error: customerError } = await supabase
          .from("customers")
          .select("email")
          .eq("id", quote.customer_id)
          .maybeSingle();
        if (customerError) {
          console.error("Failed to look up customer for review request:", invoice.id, customerError);
        } else {
          customerEmail = customer?.email ?? null;
        }
      }

      if (!customerEmail) {
        // Nothing to send to. We still don't stamp the column -- if an email
        // address gets added later, this invoice should still receive the
        // request on a later run -- but count it as skipped, not sent.
        console.error("Invoice has no customer email on file; skipping review-request send:", invoice.id);
        skipped += 1;
        continue;
      }

      await sendReviewRequestEmail({
        toEmail: customerEmail,
        organizationName: org.name ?? null,
        invoiceNumber: invoice.invoice_number,
        reviewPlatformUrl: org.review_platform_url,
      });

      const { error: stampError } = await supabase
        .from("invoices")
        .update({ review_request_sent_at: now.toISOString() })
        .eq("id", invoice.id)
        .is("review_request_sent_at", null);
      if (stampError) {
        console.error("Failed to stamp review-request timestamp:", invoice.id, stampError);
        failed += 1;
        continue;
      }
      sent += 1;
    } catch (err) {
      console.error("Unexpected error processing review request:", invoice.id, err);
      failed += 1;
    }
  }

  return Response.json({ checked: invoices?.length ?? 0, sent, skipped, failed });
}
