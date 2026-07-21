import { createClient } from "@/lib/supabase/server";

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
    </div>
  );
}
