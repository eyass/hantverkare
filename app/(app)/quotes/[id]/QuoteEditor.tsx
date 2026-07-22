"use client";

import { useState, useTransition } from "react";
import { updateLineItem, finalizeQuote } from "./actions";
import { InvoiceSection } from "./InvoiceSection";
import { SaveAsTemplateSection } from "./SaveAsTemplateSection";
import { computeProfitability } from "@/lib/quotes/profitability";
import { PhotosSection } from "./PhotosSection";

type LineItem = {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price_cents: number;
  cost_cents: number | null;
  line_total_cents: number;
  position: number;
};

type Quote = {
  id: string;
  customer_description: string;
  status: string;
  subtotal_cents: number;
  vat_cents: number;
  total_cents: number;
  share_token: string;
};

type Invoice = {
  id: string;
  invoice_number: string;
  issued_at: string;
  subtotal_cents: number;
  vat_cents: number;
  total_cents: number;
};

type Photo = {
  id: string;
  url: string | null;
  caption: string | null;
  quote_line_item_id: string | null;
};

function statusLabel(status: string): string {
  if (status === "final") return "Final";
  if (status === "signed") return "Signiert";
  return "Entwurf";
}

function statusBadgeClasses(status: string): string {
  if (status === "final") return "bg-[#dbeafe] text-[#1d4ed8]";
  if (status === "signed") return "bg-[#dcfce7] text-[#16a34a]";
  return "bg-[#f1f5f9] text-[#64748b]";
}

function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function formatPercent(ratio: number): string {
  return ratio.toLocaleString("de-DE", { style: "percent", maximumFractionDigits: 1 });
}

function centsToEuroString(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function QuoteEditor({
  quote,
  lineItems,
  invoice,
  photos,
}: {
  quote: Quote;
  lineItems: LineItem[];
  invoice: Invoice | null;
  photos: Photo[];
}) {
  const [items, setItems] = useState(lineItems);
  const [lastSavedItems, setLastSavedItems] = useState(lineItems);
  const [totals, setTotals] = useState({
    subtotalCents: quote.subtotal_cents,
    vatCents: quote.vat_cents,
    totalCents: quote.total_cents,
  });
  const [status, setStatus] = useState(quote.status);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isDraft = status === "draft";
  const profitability = computeProfitability(
    items.map((item) => ({ lineTotalCents: item.line_total_cents, costCents: item.cost_cents })),
  );

  function handleFieldChange(
    itemId: string,
    field: "description" | "quantity" | "unit_price_cents" | "cost_cents",
    value: string,
  ) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [field]:
                field === "quantity" || field === "unit_price_cents" || field === "cost_cents"
                  ? field === "cost_cents" && value === ""
                    ? null
                    : Number(value)
                  : value,
            }
          : item,
      ),
    );
  }

  function handleBlurSave(item: LineItem) {
    startTransition(async () => {
      const result = await updateLineItem(quote.id, item.id, {
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPriceCents: item.unit_price_cents,
        costCents: item.cost_cents,
      });
      if (result.error !== null) {
        setError(result.error);
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? (lastSavedItems.find((saved) => saved.id === item.id) ?? i) : i)),
        );
        return;
      }
      setError(null);
      setItems(result.lineItems);
      setLastSavedItems(result.lineItems);
      setTotals(result.totals);
    });
  }

  function handleFinalize() {
    startTransition(async () => {
      const result = await finalizeQuote(quote.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setStatus("final");
    });
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6 sm:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-[#0f172a]">Angebot</h1>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClasses(status)}`}
        >
          {statusLabel(status)}
        </span>
      </div>
      <p className="text-[#64748b]">{quote.customer_description}</p>

      {error && (
        <p className="rounded-xl border border-[#fecaca] bg-red-50 px-4 py-2 text-sm text-[#dc2626]">{error}</p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        {/* Line items card */}
        <div className="rounded-2xl border border-[#e9edf2] bg-white overflow-hidden">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#e9edf2] bg-[#f8fafc] text-xs uppercase tracking-wide text-[#94a3b8]">
                <th className="px-4 py-3 font-medium">Beschreibung</th>
                <th className="px-4 py-3 font-medium">Menge</th>
                <th className="px-4 py-3 font-medium">Einheit</th>
                <th className="px-4 py-3 font-medium">Einzelpreis</th>
                <th className="px-4 py-3 font-medium">
                  Kosten (intern)
                </th>
                <th className="px-4 py-3 font-medium">Gesamt</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-[#e9edf2] last:border-b-0">
                  <td className="px-4 py-2">
                    <input
                      value={item.description}
                      disabled={!isDraft}
                      onChange={(e) => handleFieldChange(item.id, "description", e.target.value)}
                      onBlur={() => handleBlurSave(item)}
                      className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 transition-colors focus:border-[#e9edf2] focus:bg-[#f8fafc] focus:outline-none disabled:opacity-60"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={item.quantity}
                      disabled={!isDraft}
                      onChange={(e) => handleFieldChange(item.id, "quantity", e.target.value)}
                      onBlur={() => handleBlurSave(item)}
                      className="w-20 rounded-lg border border-transparent bg-transparent px-2 py-1.5 transition-colors focus:border-[#e9edf2] focus:bg-[#f8fafc] focus:outline-none disabled:opacity-60"
                    />
                  </td>
                  <td className="px-4 py-2 text-[#64748b]">{item.unit}</td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={item.unit_price_cents / 100}
                      disabled={!isDraft}
                      onChange={(e) =>
                        handleFieldChange(
                          item.id,
                          "unit_price_cents",
                          String(Math.round(Number(e.target.value) * 100)),
                        )
                      }
                      onBlur={() => handleBlurSave(item)}
                      className="font-mono w-24 rounded-lg border border-transparent bg-transparent px-2 py-1.5 transition-colors focus:border-[#e9edf2] focus:bg-[#f8fafc] focus:outline-none disabled:opacity-60"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="optional"
                      value={item.cost_cents === null ? "" : centsToEuroString(item.cost_cents)}
                      disabled={!isDraft}
                      onChange={(e) =>
                        handleFieldChange(
                          item.id,
                          "cost_cents",
                          e.target.value === "" ? "" : String(Math.round(Number(e.target.value) * 100)),
                        )
                      }
                      onBlur={() => handleBlurSave(item)}
                      className="font-mono w-24 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-[#64748b] transition-colors placeholder:text-[#cbd5e1] focus:border-[#e9edf2] focus:bg-[#f8fafc] focus:outline-none disabled:opacity-60"
                    />
                  </td>
                  <td className="font-mono px-4 py-2 font-medium text-[#0f172a]">
                    {formatEuros(item.line_total_cents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary card */}
        <div className="flex h-fit flex-col gap-4 rounded-2xl border border-[#e9edf2] bg-white p-5 lg:sticky lg:top-6">
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between text-[#64748b]">
              <span>Zwischensumme</span>
              <span className="font-mono">{formatEuros(totals.subtotalCents)}</span>
            </div>
            <div className="flex justify-between text-[#64748b]">
              <span>MwSt. (19%)</span>
              <span className="font-mono">{formatEuros(totals.vatCents)}</span>
            </div>
            <div className="flex justify-between border-t border-[#e9edf2] pt-2 text-base font-semibold text-[#0f172a]">
              <span>Gesamt</span>
              <span className="font-mono">{formatEuros(totals.totalCents)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-[#e9edf2] bg-[#f8fafc] p-4 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-[#94a3b8]">
              Rohertrag (intern, nicht für Kunden sichtbar)
            </span>
            {profitability.itemsWithCostCount === 0 ? (
              <span className="text-[#64748b]">–</span>
            ) : (
              <>
                <div className="flex justify-between text-[#64748b]">
                  <span>Marge</span>
                  <span className="font-mono text-[#0f172a]">
                    {formatEuros(profitability.marginCents)}
                    {profitability.marginPercent !== null && (
                      <> ({formatPercent(profitability.marginPercent)})</>
                    )}
                  </span>
                </div>
                {profitability.hasIncompleteData && (
                  <span className="text-xs text-[#94a3b8]">
                    Unvollständig: nicht für alle Positionen sind Kosten hinterlegt.
                  </span>
                )}
              </>
            )}
          </div>

          {isDraft && (
            <button
              onClick={handleFinalize}
              disabled={isPending}
              className="w-full rounded-full bg-[#2563eb] px-5 py-3 text-sm font-medium text-white shadow-[0_6px_16px_rgba(37,99,235,0.3)] transition-colors hover:bg-[#1d4ed8] disabled:opacity-50"
            >
              Angebot finalisieren
            </button>
          )}

          {(status === "final" || status === "signed") && (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-[#64748b]">Link für den Kunden</span>
              <input
                readOnly
                value={`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/q/${quote.share_token}`}
                onFocus={(e) => e.target.select()}
                className="font-mono w-full rounded-xl border border-[#e9edf2] bg-[#f8fafc] px-3 py-2 text-xs text-[#0f172a]"
              />
            </label>
          )}

          <a
            href={`/quotes/${quote.id}/pdf`}
            download
            className="w-full rounded-xl border border-[#e9edf2] bg-white px-5 py-2.5 text-center text-sm font-medium text-[#0f172a] transition-colors hover:bg-[#f8fafc]"
          >
            Als PDF herunterladen
          </a>

          {status === "signed" && <InvoiceSection quoteId={quote.id} invoice={invoice} />}

          {isDraft && <SaveAsTemplateSection quoteId={quote.id} />}
        </div>
      </div>

      <PhotosSection
        quoteId={quote.id}
        lineItems={items.map((item) => ({ id: item.id, description: item.description }))}
        photos={photos}
      />
    </div>
  );
}
