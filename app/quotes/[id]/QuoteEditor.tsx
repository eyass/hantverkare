"use client";

import { useState, useTransition } from "react";
import { updateLineItem, finalizeQuote } from "./actions";

type LineItem = {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price_cents: number;
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
};

function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

export function QuoteEditor({ quote, lineItems }: { quote: Quote; lineItems: LineItem[] }) {
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

  function handleFieldChange(
    itemId: string,
    field: "description" | "quantity" | "unit_price_cents",
    value: string,
  ) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [field]: field === "quantity" || field === "unit_price_cents" ? Number(value) : value,
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
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Angebot {status === "final" ? "(final)" : "(Entwurf)"}</h1>
      <p className="text-zinc-600 dark:text-zinc-400">{quote.customer_description}</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-300 dark:border-zinc-700">
            <th className="py-2">Beschreibung</th>
            <th className="py-2">Menge</th>
            <th className="py-2">Einheit</th>
            <th className="py-2">Einzelpreis</th>
            <th className="py-2">Gesamt</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-zinc-200 dark:border-zinc-800">
              <td className="py-2">
                <input
                  value={item.description}
                  disabled={!isDraft}
                  onChange={(e) => handleFieldChange(item.id, "description", e.target.value)}
                  onBlur={() => handleBlurSave(item)}
                  className="w-full bg-transparent disabled:opacity-70"
                />
              </td>
              <td className="py-2">
                <input
                  type="number"
                  value={item.quantity}
                  disabled={!isDraft}
                  onChange={(e) => handleFieldChange(item.id, "quantity", e.target.value)}
                  onBlur={() => handleBlurSave(item)}
                  className="w-20 bg-transparent disabled:opacity-70"
                />
              </td>
              <td className="py-2">{item.unit}</td>
              <td className="py-2">
                <input
                  type="number"
                  value={item.unit_price_cents / 100}
                  disabled={!isDraft}
                  onChange={(e) =>
                    handleFieldChange(item.id, "unit_price_cents", String(Math.round(Number(e.target.value) * 100)))
                  }
                  onBlur={() => handleBlurSave(item)}
                  className="w-24 bg-transparent disabled:opacity-70"
                />
              </td>
              <td className="py-2">{formatEuros(item.line_total_cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-col items-end gap-1 text-sm">
        <p>Zwischensumme: {formatEuros(totals.subtotalCents)}</p>
        <p>MwSt. (19%): {formatEuros(totals.vatCents)}</p>
        <p className="text-base font-semibold">Gesamt: {formatEuros(totals.totalCents)}</p>
      </div>
      {isDraft && (
        <button
          onClick={handleFinalize}
          disabled={isPending}
          className="self-end rounded-full bg-foreground px-5 py-3 text-background disabled:opacity-50"
        >
          Angebot finalisieren
        </button>
      )}
    </div>
  );
}
