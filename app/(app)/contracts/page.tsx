import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CONTRACT_INTERVAL_LABELS, type ContractInterval } from "@/lib/contracts/interval";
import { contractRiskReason, CONTRACT_RISK_LABELS, type ContractRiskReason } from "@/lib/contracts/dunning";
import { formatDateShort as formatDate } from "@/lib/format";

const RISK_BADGE_CLASSES: Record<ContractRiskReason, string> = {
  renewal_failed: "bg-[#fee2e2] text-[#b91c1c]",
  invoice_overdue: "bg-[#fef3c7] text-[#b45309]",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Aktiv",
  paused: "Pausiert",
  cancelled: "Gekündigt",
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  active: "bg-[#dcfce7] text-[#16a34a]",
  paused: "bg-[#fef3c7] text-[#b45309]",
  cancelled: "bg-[#fee2e2] text-[#b91c1c]",
};

export default async function ContractsPage() {
  const supabase = await createClient();

  const { data: contracts, error } = await supabase
    .from("contracts")
    .select(
      "id, interval, status, next_due_date, source_quote_id, customer_id, latest_quote_id, renewal_failed_at",
    )
    .order("next_due_date", { ascending: true });

  if (error) {
    console.error("Failed to load contracts:", error);
  }

  // Risk badges (issue #153): same "flag when renewal failed or the latest
  // generated invoice is unpaid past the Mahnung stage" logic as
  // app/api/cron/contract-dunning/route.ts, computed live here rather than
  // trusting a stored status column -- see lib/contracts/dunning.ts for the
  // shared pure decision function.
  const latestQuoteIds = [
    ...new Set((contracts ?? []).map((c) => c.latest_quote_id).filter((id): id is string => id !== null)),
  ];
  const invoiceByQuoteId = new Map<string, { paidAt: Date | null; mahnungSentAt: Date | null }>();
  if (latestQuoteIds.length > 0) {
    const { data: invoices, error: invoicesError } = await supabase
      .from("invoices")
      .select("quote_id, paid_at, mahnung_sent_at")
      .in("quote_id", latestQuoteIds);
    if (invoicesError) {
      console.error("Failed to load invoices for contract risk badges:", invoicesError);
    } else {
      for (const invoice of invoices ?? []) {
        invoiceByQuoteId.set(invoice.quote_id, {
          paidAt: invoice.paid_at ? new Date(invoice.paid_at) : null,
          mahnungSentAt: invoice.mahnung_sent_at ? new Date(invoice.mahnung_sent_at) : null,
        });
      }
    }
  }

  const riskByContractId = new Map<string, ContractRiskReason>();
  for (const contract of contracts ?? []) {
    const reason = contractRiskReason({
      renewalFailedAt: contract.renewal_failed_at ? new Date(contract.renewal_failed_at) : null,
      invoice: contract.latest_quote_id ? (invoiceByQuoteId.get(contract.latest_quote_id) ?? null) : null,
    });
    if (reason) {
      riskByContractId.set(contract.id, reason);
    }
  }

  // Fetched separately (rather than a nested `customers(name)` select) to
  // sidestep Supabase's generated-type ambiguity for to-one vs to-many joins
  // -- simple enough at this list's expected scale (one row per customer's
  // active contract, not a high-cardinality join).
  const customerIds = [...new Set((contracts ?? []).map((c) => c.customer_id).filter((id): id is string => id !== null))];
  const customerNameById = new Map<string, string>();
  if (customerIds.length > 0) {
    const { data: customers, error: customersError } = await supabase
      .from("customers")
      .select("id, name")
      .in("id", customerIds);
    if (customersError) {
      console.error("Failed to load customers for contracts list:", customersError);
    } else {
      for (const customer of customers ?? []) {
        customerNameById.set(customer.id, customer.name);
      }
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[#0f172a]">Wartungsverträge</h1>
      </div>

      {!contracts || contracts.length === 0 ? (
        <p className="text-sm text-[#64748b]">
          Noch keine Wartungsverträge vorhanden. Wandle ein signiertes Angebot auf dessen
          Detailseite in einen Wartungsvertrag um.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#e9edf2] bg-white">
          <div className="grid grid-cols-5 gap-4 border-b border-[#e9edf2] bg-[#f8fafc] p-4 text-xs font-semibold uppercase tracking-wide text-[#64748b]">
            <span>Kunde</span>
            <span>Intervall</span>
            <span>Status</span>
            <span>Nächste Fälligkeit</span>
            <span>Risiko</span>
          </div>
          {contracts.map((contract, index) => {
            const customerName = contract.customer_id
              ? customerNameById.get(contract.customer_id)
              : undefined;
            const risk = riskByContractId.get(contract.id);
            return (
              <Link
                key={contract.id}
                href={`/quotes/${contract.source_quote_id}`}
                className={`grid grid-cols-5 items-center gap-4 p-4 transition-colors hover:bg-[#f4f6f8] ${
                  index !== 0 ? "border-t border-[#e9edf2]" : ""
                }`}
              >
                <span className="text-sm font-medium text-[#0f172a]">
                  {customerName ?? "Ohne Kunde"}
                </span>
                <span className="text-sm text-[#0f172a]">
                  {CONTRACT_INTERVAL_LABELS[contract.interval as ContractInterval] ?? contract.interval}
                </span>
                <span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      STATUS_BADGE_CLASSES[contract.status] ?? "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {STATUS_LABELS[contract.status] ?? contract.status}
                  </span>
                </span>
                <span className="font-mono text-sm text-[#0f172a]">
                  {formatDate(contract.next_due_date)}
                </span>
                <span>
                  {risk ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${RISK_BADGE_CLASSES[risk]}`}
                    >
                      {CONTRACT_RISK_LABELS[risk]}
                    </span>
                  ) : (
                    <span className="text-xs text-[#94a3b8]">—</span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
