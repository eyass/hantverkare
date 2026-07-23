import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { computeProfitability } from "@/lib/quotes/profitability";
import { getUserLanguage } from "@/lib/i18n/getUserLanguage";
import {
  computeReportsDateRange,
  isReportsRangePreset,
  type ReportsRangePreset,
} from "@/lib/reports/dateRange";
import { REPORTS_DICTIONARY } from "./reports.dictionary";

function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function formatPercent(ratio: number): string {
  return ratio.toLocaleString("de-DE", { style: "percent", maximumFractionDigits: 1 });
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const { range, from, to } = await searchParams;
  const preset: ReportsRangePreset = isReportsRangePreset(range) ? range : "this_month";
  const dateRange = computeReportsDateRange(preset, from ?? null, to ?? null);

  const supabase = await createClient();
  const { data: quotes, error } = await supabase
    .from("quotes")
    .select("status, total_cents")
    .gte("created_at", dateRange.startISO)
    .lt("created_at", dateRange.endISO);
  if (error) {
    console.error("Failed to load quotes for reports:", error);
  }

  const language = await getUserLanguage(supabase);
  const t = REPORTS_DICTIONARY[language];

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
    .eq("status", "signed")
    .gte("created_at", dateRange.startISO)
    .lt("created_at", dateRange.endISO);
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
    { label: t.tileTotalQuotes, value: String(totalQuotes) },
    { label: t.tileDraft, value: String(draftCount) },
    { label: t.tileFinal, value: String(finalCount) },
    { label: t.tileSigned, value: String(signedCount) },
    {
      label: t.tileConversionRate,
      value: conversionRate === null ? "–" : formatPercent(conversionRate),
    },
    { label: t.tileRevenue, value: formatEuros(totalRevenueCents) },
    {
      label: t.tileAvgSignedValue,
      value: averageSignedValueCents === null ? "–" : formatEuros(averageSignedValueCents),
    },
  ];

  const presetPills: { preset: ReportsRangePreset; label: string }[] = [
    { preset: "this_month", label: t.rangeThisMonth },
    { preset: "last_month", label: t.rangeLastMonth },
    { preset: "this_quarter", label: t.rangeThisQuarter },
    { preset: "this_year", label: t.rangeThisYear },
    { preset: "custom", label: t.rangeCustom },
  ];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6 sm:p-8">
      <h1 className="text-2xl font-semibold text-[#0f172a]">{t.title}</h1>

      <div className="flex flex-col gap-3">
        <div className="flex w-fit flex-wrap gap-1 rounded-full border border-[#e9edf2] bg-white p-1 text-sm">
          {presetPills.map((pill) => (
            <Link
              key={pill.preset}
              href={pill.preset === "this_month" ? "/reports" : `/reports?range=${pill.preset}`}
              className={
                preset === pill.preset
                  ? "rounded-full bg-[#2563eb] px-4 py-1.5 font-semibold text-white"
                  : "rounded-full px-4 py-1.5 text-[#64748b]"
              }
            >
              {pill.label}
            </Link>
          ))}
        </div>
        {preset === "custom" && (
          <form
            method="get"
            className="flex flex-wrap items-end gap-2 rounded-2xl border border-[#e9edf2] bg-white p-3"
          >
            <input type="hidden" name="range" value="custom" />
            <label className="flex flex-col gap-1 text-xs text-[#64748b]">
              {t.rangeCustomFrom}
              <input
                type="date"
                name="from"
                defaultValue={dateRange.customFrom ?? ""}
                className="rounded-lg border border-[#e9edf2] px-2 py-1.5 text-sm text-[#0f172a]"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[#64748b]">
              {t.rangeCustomTo}
              <input
                type="date"
                name="to"
                defaultValue={dateRange.customTo ?? ""}
                className="rounded-lg border border-[#e9edf2] px-2 py-1.5 text-sm text-[#0f172a]"
              />
            </label>
            <button
              type="submit"
              className="rounded-full bg-[#2563eb] px-4 py-1.5 text-sm font-semibold text-white"
            >
              {t.rangeCustomApply}
            </button>
          </form>
        )}
      </div>

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
        <h2 className="text-lg font-medium text-[#0f172a]">{t.profitabilityTitle}</h2>
        {profitability.itemsWithCostCount === 0 ? (
          <div className="rounded-2xl border border-[#e9edf2] bg-white p-4 text-sm text-[#64748b]">
            {t.profitabilityEmpty}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <div className="flex flex-col gap-1 rounded-2xl border border-[#e9edf2] bg-white p-4">
                <span className="font-mono text-2xl font-bold text-[#0f172a]">
                  {formatEuros(profitability.revenueCents)}
                </span>
                <span className="text-sm text-[#64748b]">{t.profitabilityRevenue}</span>
              </div>
              <div className="flex flex-col gap-1 rounded-2xl border border-[#e9edf2] bg-white p-4">
                <span className="font-mono text-2xl font-bold text-[#0f172a]">
                  {formatEuros(profitability.costCents)}
                </span>
                <span className="text-sm text-[#64748b]">{t.profitabilityCost}</span>
              </div>
              <div className="flex flex-col gap-1 rounded-2xl border border-[#e9edf2] bg-white p-4">
                <span className="font-mono text-2xl font-bold text-[#0f172a]">
                  {formatEuros(profitability.marginCents)}
                </span>
                <span className="text-sm text-[#64748b]">
                  {t.profitabilityMargin}{" "}
                  {profitability.marginPercent !== null &&
                    `(${formatPercent(profitability.marginPercent)})`}
                </span>
              </div>
            </div>
            {profitability.hasIncompleteData && (
              <p className="text-sm text-[#94a3b8]">
                {t.profitabilityIncomplete(
                  profitability.itemsWithCostCount,
                  profitability.itemCount,
                )}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
