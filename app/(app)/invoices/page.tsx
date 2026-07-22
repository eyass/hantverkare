import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  reconcileInvoices,
  type AgingBucket,
  type PaymentBucket,
  type ReconciledInvoice,
} from "@/lib/invoices/reconciliation";

function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("de-DE");
}

const BUCKET_LABELS: Record<PaymentBucket, string> = {
  paid: "Bezahlt",
  partiallyPaid: "Teilweise bezahlt",
  overdue: "Überfällig",
  unpaid: "Offen",
};

const AGING_LABELS: Record<AgingBucket, string> = {
  current: "Noch nicht fällig",
  "0-30": "0–30 Tage",
  "30-60": "30–60 Tage",
  "60+": "60+ Tage",
};

export default async function InvoicesPage() {
  const supabase = await createClient();

  // No explicit organization filter: RLS on `invoices` (and the joined
  // `quotes`/`customers`) scopes rows to the caller's organization already
  // (see supabase/migrations/0010_organizations.sql, and app/api/export/invoices
  // for the identical pattern).
  const { data: invoiceRows, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, issued_at, total_cents, quote_id, quotes(customers(name))")
    .order("issued_at", { ascending: false });

  if (error) {
    console.error("Failed to load invoices for reconciliation dashboard:", error);
  }

  const invoices = (invoiceRows ?? []).map((row) => {
    const quote = Array.isArray(row.quotes) ? row.quotes[0] : row.quotes;
    const customer = quote ? (Array.isArray(quote.customers) ? quote.customers[0] : quote.customers) : null;
    return {
      id: row.id as string,
      invoiceNumber: row.invoice_number as string,
      issuedAt: row.issued_at as string,
      totalCents: row.total_cents as number,
      customerName: customer?.name ?? null,
      quoteId: row.quote_id as string,
    };
  });

  const summary = reconcileInvoices(invoices);

  const tiles: { label: string; value: string }[] = [
    { label: "Offener Betrag gesamt", value: formatEuros(summary.totalOutstandingCents) },
    { label: "Überfällig", value: String(summary.countsByBucket.overdue) },
    { label: "Offen (nicht fällig)", value: String(summary.countsByBucket.unpaid) },
    { label: "Bezahlt", value: String(summary.countsByBucket.paid) },
  ];

  const agingTiles: { label: string; count: number; totalCents: number }[] = (
    ["0-30", "30-60", "60+"] as const
  ).map((bucket) => ({
    label: AGING_LABELS[bucket],
    count: summary.aging[bucket].count,
    totalCents: summary.aging[bucket].totalCents,
  }));

  const sortedInvoices = [...summary.invoices].sort((a, b) => {
    // Overdue first (most days past due first), then unpaid, most recent first.
    if (a.bucket !== b.bucket) {
      return a.bucket === "overdue" ? -1 : 1;
    }
    return b.daysPastDue - a.daysPastDue;
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold text-[#0f172a]">Zahlungsabgleich</h1>
        <p className="mt-1 text-sm text-[#64748b]">
          Fälligkeit wird derzeit aus dem Rechnungsdatum abgeleitet (Zahlungsziel 14 Tage) — es
          liegen noch keine echten Zahlungsstatus-Daten vor. Sobald die Online-Zahlungsanbindung
          und das Mahnwesen live sind, zeigt diese Ansicht den tatsächlichen Zahlungsstatus.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="flex flex-col gap-1 rounded-2xl border border-[#e9edf2] bg-white p-4">
            <span className="font-mono text-2xl font-bold text-[#0f172a]">{tile.value}</span>
            <span className="text-sm text-[#64748b]">{tile.label}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-[#0f172a]">Fälligkeitsstruktur (überfällige Rechnungen)</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {agingTiles.map((tile) => (
            <div key={tile.label} className="flex flex-col gap-1 rounded-2xl border border-[#e9edf2] bg-white p-4">
              <span className="font-mono text-xl font-bold text-[#0f172a]">{formatEuros(tile.totalCents)}</span>
              <span className="text-sm text-[#64748b]">
                {tile.label} ({tile.count})
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-[#0f172a]">Rechnungen</h2>
        {sortedInvoices.length === 0 ? (
          <div className="rounded-2xl border border-[#e9edf2] bg-white p-4 text-sm text-[#64748b]">
            Noch keine Rechnungen erstellt.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#e9edf2] bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e9edf2] text-left text-[#64748b]">
                  <th className="px-4 py-2.5 font-medium">Rechnung</th>
                  <th className="px-4 py-2.5 font-medium">Kunde</th>
                  <th className="px-4 py-2.5 font-medium">Fällig am</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Betrag</th>
                </tr>
              </thead>
              <tbody>
                {sortedInvoices.map((invoice: ReconciledInvoice) => (
                  <tr key={invoice.id} className="border-b border-[#e9edf2] last:border-0">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/quotes/${invoice.quoteId}`}
                        className="font-mono font-medium text-[#2563eb] hover:underline"
                      >
                        {invoice.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-[#0f172a]">{invoice.customerName ?? "—"}</td>
                    <td className="px-4 py-2.5 font-mono text-[#0f172a]">{formatDate(invoice.dueDate)}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          invoice.bucket === "overdue"
                            ? "bg-[#fee2e2] text-[#dc2626]"
                            : "bg-[#e0e7ff] text-[#4338ca]"
                        }`}
                      >
                        {BUCKET_LABELS[invoice.bucket]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[#0f172a]">
                      {formatEuros(invoice.totalCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
