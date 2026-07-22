import { createClient } from "@/lib/supabase/server";
import { computeProfitability } from "@/lib/quotes/profitability";

function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function formatPercent(ratio: number): string {
  return ratio.toLocaleString("de-DE", { style: "percent", maximumFractionDigits: 1 });
}

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: quotes, error } = await supabase.from("quotes").select("status, total_cents");
  if (error) {
    console.error("Failed to load quotes for reports:", error);
  }

  const rows = quotes ?? [];
  const totalQuotes = rows.length;
  const draftCount = rows.filter((q) => q.status === "draft").length;
  const finalCount = rows.filter((q) => q.status === "final").length;
  const signedCount = rows.filter((q) => q.status === "signed").length;

  const conversionDenominator = finalCount + signedCount;
  const conversionRate = conversionDenominator === 0 ? null : signedCount / conversionDenominator;

  const totalRevenueCents = rows
    .filter((q) => q.status === "signed")
    .reduce((sum, q) => sum + q.total_cents, 0);

  const averageSignedValueCents = signedCount === 0 ? null : totalRevenueCents / signedCount;

  // Profitability is only meaningful for quotes the customer actually signed
  // off on (revenue is real, not hypothetical), matching the revenue tile
  // above. We only look at line items that have cost data entered — missing
  // cost is never treated as zero, since that would fabricate a margin.
  const { data: signedQuotes, error: signedQuotesError } = await supabase
    .from("quotes")
    .select("id")
    .eq("status", "signed");
  if (signedQuotesError) {
    console.error("Failed to load signed quotes for profitability:", signedQuotesError);
  }
  const signedQuoteIds = (signedQuotes ?? []).map((q) => q.id);

  let profitability = computeProfitability([]);
  if (signedQuoteIds.length > 0) {
    const { data: signedLineItems, error: lineItemsError } = await supabase
      .from("quote_line_items")
      .select("line_total_cents, cost_cents")
      .in("quote_id", signedQuoteIds);
    if (lineItemsError) {
      console.error("Failed to load line items for profitability:", lineItemsError);
    }
    profitability = computeProfitability(
      (signedLineItems ?? []).map((item) => ({
        lineTotalCents: item.line_total_cents,
        costCents: item.cost_cents,
      })),
    );
  }

  const tiles: { label: string; value: string }[] = [
    { label: "Angebote insgesamt", value: String(totalQuotes) },
    { label: "Entwurf", value: String(draftCount) },
    { label: "Final", value: String(finalCount) },
    { label: "Signiert", value: String(signedCount) },
    {
      label: "Abschlussquote",
      value: conversionRate === null ? "–" : formatPercent(conversionRate),
    },
    { label: "Umsatz (signiert)", value: formatEuros(totalRevenueCents) },
    {
      label: "Ø Wert pro signiertem Angebot",
      value: averageSignedValueCents === null ? "–" : formatEuros(averageSignedValueCents),
    },
  ];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold text-[#0f172a]">Auswertung</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="flex flex-col gap-1 rounded-2xl border border-[#e9edf2] bg-white p-4"
          >
            <span className="font-mono text-2xl font-bold text-[#0f172a]">{tile.value}</span>
            <span className="text-sm text-[#64748b]">{tile.label}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-[#0f172a]">Profitabilität (intern)</h2>
        {profitability.itemsWithCostCount === 0 ? (
          <div className="rounded-2xl border border-[#e9edf2] bg-white p-4 text-sm text-[#64748b]">
            – Noch keine Kostendaten erfasst. Trage bei Angebotspositionen optional Kosten ein, um
            hier die Marge zu sehen.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <div className="flex flex-col gap-1 rounded-2xl border border-[#e9edf2] bg-white p-4">
                <span className="font-mono text-2xl font-bold text-[#0f172a]">
                  {formatEuros(profitability.revenueCents)}
                </span>
                <span className="text-sm text-[#64748b]">Umsatz (mit Kostendaten)</span>
              </div>
              <div className="flex flex-col gap-1 rounded-2xl border border-[#e9edf2] bg-white p-4">
                <span className="font-mono text-2xl font-bold text-[#0f172a]">
                  {formatEuros(profitability.costCents)}
                </span>
                <span className="text-sm text-[#64748b]">Kosten</span>
              </div>
              <div className="flex flex-col gap-1 rounded-2xl border border-[#e9edf2] bg-white p-4">
                <span className="font-mono text-2xl font-bold text-[#0f172a]">
                  {formatEuros(profitability.marginCents)}
                </span>
                <span className="text-sm text-[#64748b]">
                  Rohertrag{" "}
                  {profitability.marginPercent !== null &&
                    `(${formatPercent(profitability.marginPercent)})`}
                </span>
              </div>
            </div>
            {profitability.hasIncompleteData && (
              <p className="text-sm text-[#94a3b8]">
                Hinweis: Nicht für alle Positionen sind Kosten hinterlegt ({profitability.itemsWithCostCount}{" "}
                von {profitability.itemCount}). Die Marge oben bezieht sich nur auf Positionen mit
                erfassten Kosten.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
