// Pure risk-determination logic for recurring contract dunning (issue #153).
// Kept free of any Supabase/env dependency, same rationale as
// lib/invoices/dunning.ts and lib/contracts/interval.ts: unit testable in
// isolation, and reused identically by the contract-dunning cron
// (app/api/cron/contract-dunning/route.ts) and the /contracts list view.

export type ContractRiskReason = "renewal_failed" | "invoice_overdue";

export type ContractInvoiceDunningInfo = {
  /** Null when the contract's latest quote has no invoice yet (still a draft). */
  paidAt: Date | null;
  mahnungSentAt: Date | null;
};

/**
 * Decides why a contract is currently at risk of lapsing, or null if it
 * looks healthy. Two independent triggers, matching the issue's two "flag
 * when..." conditions:
 *
 *   1. renewal_failed: the renewal cron itself failed to generate the next
 *      period's quote (invalid interval, missing source data, insert
 *      failure, ...). Checked first since a contract that isn't even
 *      renewing is a more urgent signal than one whose invoice is overdue.
 *   2. invoice_overdue: the contract's latest generated quote has an
 *      invoice that has reached the formal Mahnung stage (or beyond)
 *      without being paid. Mirrors lib/invoices/dunning.ts's own
 *      "mahnung is the formal, no-longer-a-friendly-nudge stage" framing --
 *      a plain first-stage reminder alone isn't yet "at risk", it's just a
 *      few days overdue. `invoice` is null when the latest quote hasn't
 *      been turned into an invoice at all yet -- not itself a risk signal,
 *      that's normal for a fresh draft renewal quote awaiting signature.
 */
export function contractRiskReason(params: {
  renewalFailedAt: Date | null;
  invoice: ContractInvoiceDunningInfo | null;
}): ContractRiskReason | null {
  if (params.renewalFailedAt !== null) {
    return "renewal_failed";
  }
  if (params.invoice && params.invoice.paidAt === null && params.invoice.mahnungSentAt !== null) {
    return "invoice_overdue";
  }
  return null;
}

export const CONTRACT_RISK_LABELS: Record<ContractRiskReason, string> = {
  renewal_failed: "Verlängerung fehlgeschlagen",
  invoice_overdue: "Rechnung überfällig",
};
