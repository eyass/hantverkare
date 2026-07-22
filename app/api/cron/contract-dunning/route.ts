import { createAdminClient } from "@/lib/supabase/admin";
import { contractRiskReason } from "@/lib/contracts/dunning";
import { sendContractAtRiskEmail } from "@/lib/notifications/sendContractAtRiskEmail";

// Renewal-failure / dunning handling for recurring contracts (issue #153),
// extending the existing dunning pattern from
// app/api/cron/invoice-dunning/route.ts (issue #122) to contracts. Mirrors
// that route's structure and app/api/cron/contract-renewal/route.ts's auth
// exactly -- same CRON_SECRET bearer-token check, same service-role admin
// client (no auth.uid() on a cron-triggered request).
//
// A contract is "at risk" for one of two reasons (see
// lib/contracts/dunning.ts for the pure decision logic):
//   1. renewal_failed -- the renewal cron itself couldn't generate the next
//      period's quote (contracts.renewal_failed_at is set).
//   2. invoice_overdue -- the contract's latest generated quote has an
//      invoice that has reached the formal Mahnung stage without being paid.
//
// This cron does NOT re-decide invoice-level dunning stages (that's still
// entirely owned by invoice-dunning) -- it only reads the timestamps that
// cron already stamps and reacts at the contract level: notify the
// contract's owner once per risk episode (dunning_notified_at gates this,
// exactly like invoices.payment_reminder_sent_at gates the first invoice
// dunning email), and let the /contracts list surface the same reason as a
// badge (computed live from the same inputs, see app/(app)/contracts/page.tsx).
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

  // Every non-cancelled contract: a paused contract can still have an
  // unpaid overdue invoice from before it was paused, and should keep
  // surfacing as at-risk until that's resolved. Only cancelled contracts
  // (a deliberate end state) are excluded.
  const { data: contracts, error } = await supabase
    .from("contracts")
    .select("id, user_id, source_quote_id, latest_quote_id, renewal_failed_at, dunning_notified_at")
    .neq("status", "cancelled");

  if (error) {
    console.error("Failed to load contracts for dunning check:", error);
    return Response.json({ error: "Failed to load contracts." }, { status: 500 });
  }

  let flagged = 0;
  let recovered = 0;
  let skipped = 0;
  let failed = 0;

  for (const contract of contracts ?? []) {
    try {
      let invoiceInfo: { paidAt: Date | null; mahnungSentAt: Date | null } | null = null;

      if (contract.latest_quote_id) {
        const { data: invoice, error: invoiceError } = await supabase
          .from("invoices")
          .select("paid_at, mahnung_sent_at")
          .eq("quote_id", contract.latest_quote_id)
          .maybeSingle();
        if (invoiceError) {
          console.error("Failed to look up invoice for contract dunning check:", contract.id, invoiceError);
          failed += 1;
          continue;
        }
        if (invoice) {
          invoiceInfo = {
            paidAt: invoice.paid_at ? new Date(invoice.paid_at as string) : null,
            mahnungSentAt: invoice.mahnung_sent_at ? new Date(invoice.mahnung_sent_at as string) : null,
          };
        }
      }

      const reason = contractRiskReason({
        renewalFailedAt: contract.renewal_failed_at ? new Date(contract.renewal_failed_at as string) : null,
        invoice: invoiceInfo,
      });

      if (!reason) {
        // Healthy. Clear any stale notified-flag so a future episode can
        // notify again, mirroring invoice-dunning's "each stage sent at
        // most once per episode" gate.
        if (contract.dunning_notified_at) {
          const { error: clearError } = await supabase
            .from("contracts")
            .update({ dunning_notified_at: null })
            .eq("id", contract.id);
          if (clearError) {
            console.error("Failed to clear dunning_notified_at for recovered contract:", contract.id, clearError);
            failed += 1;
            continue;
          }
          recovered += 1;
        } else {
          skipped += 1;
        }
        continue;
      }

      if (contract.dunning_notified_at) {
        // Already notified for this episode; nothing new to do.
        skipped += 1;
        continue;
      }

      const { data: ownerData, error: ownerError } = await supabase.auth.admin.getUserById(
        contract.user_id as string,
      );
      const ownerEmail = ownerData?.user?.email;
      if (ownerError || !ownerEmail) {
        console.error("Failed to look up contract owner for at-risk notification:", contract.id, ownerError);
      } else {
        const { data: sourceQuote, error: sourceQuoteError } = await supabase
          .from("quotes")
          .select("customer_description")
          .eq("id", contract.source_quote_id)
          .maybeSingle();
        if (sourceQuoteError) {
          console.error("Failed to look up source quote description for at-risk notification:", contract.id, sourceQuoteError);
        }

        await sendContractAtRiskEmail({
          toEmail: ownerEmail,
          reason,
          contractId: contract.id,
          customerDescription: sourceQuote?.customer_description ?? "",
        });
      }

      const { error: stampError } = await supabase
        .from("contracts")
        .update({ dunning_notified_at: new Date().toISOString() })
        .eq("id", contract.id)
        .is("dunning_notified_at", null);
      if (stampError) {
        console.error("Failed to stamp dunning_notified_at for contract:", contract.id, stampError);
        failed += 1;
        continue;
      }

      flagged += 1;
    } catch (err) {
      console.error("Unexpected error processing contract dunning check:", contract.id, err);
      failed += 1;
    }
  }

  return Response.json({ checked: contracts?.length ?? 0, flagged, recovered, skipped, failed });
}
