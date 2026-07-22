import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CONTRACT_INTERVAL_LABELS, type ContractInterval } from "@/lib/contracts/interval";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE");
}

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
    .select("id, interval, status, next_due_date, source_quote_id, customers(name)")
    .order("next_due_date", { ascending: true });

  if (error) {
    console.error("Failed to load contracts:", error);
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
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
          <div className="grid grid-cols-4 gap-4 border-b border-[#e9edf2] bg-[#f8fafc] p-4 text-xs font-semibold uppercase tracking-wide text-[#64748b]">
            <span>Kunde</span>
            <span>Intervall</span>
            <span>Status</span>
            <span>Nächste Fälligkeit</span>
          </div>
          {contracts.map((contract, index) => {
            const customerName =
              (contract.customers as unknown as { name: string } | { name: string }[] | null) &&
              (Array.isArray(contract.customers) ? contract.customers[0]?.name : contract.customers?.name);
            return (
              <Link
                key={contract.id}
                href={`/quotes/${contract.source_quote_id}`}
                className={`grid grid-cols-4 items-center gap-4 p-4 transition-colors hover:bg-[#f4f6f8] ${
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
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
