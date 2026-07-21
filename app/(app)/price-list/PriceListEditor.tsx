"use client";

import { useState, useTransition } from "react";
import {
  createPriceListItem,
  updatePriceListItem,
  deletePriceListItem,
  type PriceListItemInput,
} from "./actions";

type PriceListItem = {
  id: string;
  label: string;
  unit: string;
  unit_price_cents: number;
  category: string;
};

function centsToEuroString(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function PriceListEditor({ items: initialItems }: { items: PriceListItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [lastSavedItems, setLastSavedItems] = useState(initialItems);
  const [error, setError] = useState<string | null>(null);
  const [newItem, setNewItem] = useState({ label: "", unit: "", unitPrice: "", category: "" });
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    const input: PriceListItemInput = {
      label: newItem.label,
      unit: newItem.unit,
      unitPriceCents: Math.round(Number(newItem.unitPrice) * 100),
      category: newItem.category,
    };
    startTransition(async () => {
      const result = await createPriceListItem(input);
      if (result.error !== null) {
        setError(result.error);
        return;
      }
      setError(null);
      setItems((prev) => [...prev, result.item]);
      setLastSavedItems((prev) => [...prev, result.item]);
      setNewItem({ label: "", unit: "", unitPrice: "", category: "" });
    });
  }

  function handleFieldChange(
    id: string,
    field: "label" | "unit" | "unit_price_cents" | "category",
    value: string,
  ) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, [field]: field === "unit_price_cents" ? Number(value) : value }
          : item,
      ),
    );
  }

  function handleBlurSave(item: PriceListItem) {
    startTransition(async () => {
      const result = await updatePriceListItem(item.id, {
        label: item.label,
        unit: item.unit,
        unitPriceCents: item.unit_price_cents,
        category: item.category,
      });
      if (result.error !== null) {
        setError(result.error);
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? (lastSavedItems.find((saved) => saved.id === item.id) ?? i) : i,
          ),
        );
        return;
      }
      setError(null);
      setLastSavedItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deletePriceListItem(id);
      if (result.error !== null) {
        setError(result.error);
        return;
      }
      setError(null);
      setItems((prev) => prev.filter((item) => item.id !== id));
      setLastSavedItems((prev) => prev.filter((item) => item.id !== id));
    });
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Preisliste</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-300 dark:border-zinc-700">
            <th className="py-2">Bezeichnung</th>
            <th className="py-2">Einheit</th>
            <th className="py-2">Preis (EUR)</th>
            <th className="py-2">Kategorie</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-zinc-200 dark:border-zinc-800">
              <td className="py-2">
                <input
                  value={item.label}
                  onChange={(e) => handleFieldChange(item.id, "label", e.target.value)}
                  onBlur={() => handleBlurSave(item)}
                  className="w-full bg-transparent"
                />
              </td>
              <td className="py-2">
                <input
                  value={item.unit}
                  onChange={(e) => handleFieldChange(item.id, "unit", e.target.value)}
                  onBlur={() => handleBlurSave(item)}
                  className="w-24 bg-transparent"
                />
              </td>
              <td className="py-2">
                <input
                  type="number"
                  value={centsToEuroString(item.unit_price_cents)}
                  onChange={(e) =>
                    handleFieldChange(
                      item.id,
                      "unit_price_cents",
                      String(Math.round(Number(e.target.value) * 100)),
                    )
                  }
                  onBlur={() => handleBlurSave(item)}
                  className="w-24 bg-transparent"
                />
              </td>
              <td className="py-2">
                <input
                  value={item.category}
                  onChange={(e) => handleFieldChange(item.id, "category", e.target.value)}
                  onBlur={() => handleBlurSave(item)}
                  className="w-32 bg-transparent"
                />
              </td>
              <td className="py-2">
                <button onClick={() => handleDelete(item.id)} className="text-red-600 underline">
                  Löschen
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-col gap-2 border-t border-zinc-300 pt-4 dark:border-zinc-700">
        <h2 className="text-lg font-medium">Neue Position</h2>
        <div className="flex flex-wrap gap-2">
          <input
            value={newItem.label}
            onChange={(e) => setNewItem((prev) => ({ ...prev, label: e.target.value }))}
            placeholder="Bezeichnung"
            className="flex-1 rounded-md border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <input
            value={newItem.unit}
            onChange={(e) => setNewItem((prev) => ({ ...prev, unit: e.target.value }))}
            placeholder="Einheit"
            className="w-24 rounded-md border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <input
            type="number"
            value={newItem.unitPrice}
            onChange={(e) => setNewItem((prev) => ({ ...prev, unitPrice: e.target.value }))}
            placeholder="Preis (EUR)"
            className="w-28 rounded-md border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <input
            value={newItem.category}
            onChange={(e) => setNewItem((prev) => ({ ...prev, category: e.target.value }))}
            placeholder="Kategorie"
            className="w-32 rounded-md border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={isPending}
          className="self-start rounded-full bg-foreground px-5 py-3 text-background disabled:opacity-50"
        >
          Position hinzufügen
        </button>
      </div>
    </div>
  );
}
