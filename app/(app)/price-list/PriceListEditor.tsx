"use client";

import { useState, useTransition } from "react";
import {
  createPriceListItem,
  updatePriceListItem,
  deletePriceListItem,
  type PriceListItemInput,
} from "./actions";
import { useAppLanguage } from "@/lib/i18n/AppLanguageProvider";
import { PRICE_LIST_DICTIONARY } from "./price-list.dictionary";

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

const inputClass =
  "w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm text-[#0f172a] outline-none transition-colors focus:border-[#e9edf2] focus:bg-[#f4f6f8]";

export function PriceListEditor({ items: initialItems }: { items: PriceListItem[] }) {
  const { language } = useAppLanguage();
  const t = PRICE_LIST_DICTIONARY[language];
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
      <h1 className="text-2xl font-semibold text-[#0f172a]">{t.title}</h1>
      {error && <p className="text-sm text-[#dc2626]">{error}</p>}
      <div className="overflow-hidden rounded-2xl border border-[#e9edf2] bg-white">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[#e9edf2] text-xs font-medium uppercase tracking-wide text-[#94a3b8]">
              <th className="px-4 py-3">{t.colLabel}</th>
              <th className="px-4 py-3">{t.colUnit}</th>
              <th className="px-4 py-3">{t.colPrice}</th>
              <th className="px-4 py-3">{t.colCategory}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-[#e9edf2] last:border-b-0">
                <td className="px-4 py-2">
                  <input
                    value={item.label}
                    onChange={(e) => handleFieldChange(item.id, "label", e.target.value)}
                    onBlur={() => handleBlurSave(item)}
                    className={inputClass}
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    value={item.unit}
                    onChange={(e) => handleFieldChange(item.id, "unit", e.target.value)}
                    onBlur={() => handleBlurSave(item)}
                    className={`w-24 ${inputClass}`}
                  />
                </td>
                <td className="px-4 py-2">
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
                    className={`w-24 font-mono ${inputClass}`}
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    value={item.category}
                    onChange={(e) => handleFieldChange(item.id, "category", e.target.value)}
                    onBlur={() => handleBlurSave(item)}
                    className={`w-32 ${inputClass}`}
                  />
                </td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-sm font-medium text-[#dc2626] hover:text-[#b91c1c]"
                  >
                    {t.delete}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 rounded-2xl border border-[#e9edf2] bg-white p-6">
        <h2 className="text-lg font-medium text-[#0f172a]">{t.newItemTitle}</h2>
        <div className="flex flex-wrap gap-2">
          <input
            value={newItem.label}
            onChange={(e) => setNewItem((prev) => ({ ...prev, label: e.target.value }))}
            placeholder={t.labelPlaceholder}
            className="flex-1 rounded-xl border border-[#e9edf2] p-2.5 text-sm text-[#0f172a] outline-none focus:border-[#2563eb]"
          />
          <input
            value={newItem.unit}
            onChange={(e) => setNewItem((prev) => ({ ...prev, unit: e.target.value }))}
            placeholder={t.unitPlaceholder}
            className="w-24 rounded-xl border border-[#e9edf2] p-2.5 text-sm text-[#0f172a] outline-none focus:border-[#2563eb]"
          />
          <input
            type="number"
            value={newItem.unitPrice}
            onChange={(e) => setNewItem((prev) => ({ ...prev, unitPrice: e.target.value }))}
            placeholder={t.pricePlaceholder}
            className="w-28 rounded-xl border border-[#e9edf2] p-2.5 font-mono text-sm text-[#0f172a] outline-none focus:border-[#2563eb]"
          />
          <input
            value={newItem.category}
            onChange={(e) => setNewItem((prev) => ({ ...prev, category: e.target.value }))}
            placeholder={t.categoryPlaceholder}
            className="w-32 rounded-xl border border-[#e9edf2] p-2.5 text-sm text-[#0f172a] outline-none focus:border-[#2563eb]"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={isPending}
          className="self-start rounded-full bg-[#2563eb] px-5 py-2.5 text-sm font-medium text-white shadow-[0_6px_16px_rgba(37,99,235,0.3)] transition-colors hover:bg-[#1d4ed8] disabled:opacity-50"
        >
          {t.addItem}
        </button>
      </div>
    </div>
  );
}
