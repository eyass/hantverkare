"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createPriceListItem,
  updatePriceListItem,
  deletePriceListItem,
  bulkAdjustPriceListPrices,
  restockPriceListItem,
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
  track_stock: boolean;
  stock_quantity: number | null;
  low_stock_threshold: number | null;
};

function isLowStock(item: PriceListItem): boolean {
  return (
    item.track_stock &&
    item.stock_quantity !== null &&
    item.low_stock_threshold !== null &&
    item.stock_quantity <= item.low_stock_threshold
  );
}

function centsToEuroString(cents: number): string {
  return (cents / 100).toFixed(2);
}

// Table-row inputs need to read as inputs at a glance (not just plain table
// text), so they always carry a visible border/background -- mirroring the
// standalone "new item" form inputs below, just slightly lighter so a dense
// table of them doesn't look heavier than the rest of the page.
const inputClass =
  "w-full min-w-0 rounded-lg border border-[#e9edf2] bg-[#f8fafc] px-2 py-1.5 text-sm text-[#0f172a] outline-none transition-colors focus:border-[#2563eb] focus:bg-white";

export function PriceListEditor({ items: initialItems }: { items: PriceListItem[] }) {
  const { language } = useAppLanguage();
  const t = PRICE_LIST_DICTIONARY[language];
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [lastSavedItems, setLastSavedItems] = useState(initialItems);
  const [error, setError] = useState<string | null>(null);
  const [newItem, setNewItem] = useState({ label: "", unit: "", unitPrice: "", category: "" });
  const [restockAmounts, setRestockAmounts] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [adjustPercent, setAdjustPercent] = useState("");
  const [adjustMessage, setAdjustMessage] = useState<string | null>(null);
  const [isAdjusting, startAdjustTransition] = useTransition();

  function handleBulkAdjust() {
    const percent = Number(adjustPercent);
    if (!Number.isFinite(percent) || percent === 0) {
      setError("Bitte einen gültigen Prozentsatz ungleich 0 eingeben.");
      return;
    }
    startAdjustTransition(async () => {
      const result = await bulkAdjustPriceListPrices(percent);
      if (result.error !== null) {
        setError(result.error);
        setAdjustMessage(null);
        return;
      }
      setError(null);
      setAdjustMessage(
        `${result.updated ?? 0} ${(result.updated ?? 0) === 1 ? "Preis wurde" : "Preise wurden"} angepasst.`,
      );
      setAdjustPercent("");
      // Mirror the server-side rounding (Math.round, floor of 1 cent) so the
      // list reflects the change immediately without a full page refetch --
      // router.refresh() alone wouldn't re-init this component's local
      // `items` state since it's seeded once from the initial server props.
      const factor = 1 + percent / 100;
      setItems((prev) =>
        prev.map((item) => ({
          ...item,
          unit_price_cents: Math.max(1, Math.round(item.unit_price_cents * factor)),
        })),
      );
      setLastSavedItems((prev) =>
        prev.map((item) => ({
          ...item,
          unit_price_cents: Math.max(1, Math.round(item.unit_price_cents * factor)),
        })),
      );
      router.refresh();
    });
  }

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
    field: "label" | "unit" | "unit_price_cents" | "category" | "low_stock_threshold",
    value: string,
  ) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]:
                field === "unit_price_cents"
                  ? Number(value)
                  : field === "low_stock_threshold"
                    ? value.trim().length === 0
                      ? null
                      : Number(value)
                    : value,
            }
          : item,
      ),
    );
  }

  function handleToggleTrackStock(id: string) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const nextTrackStock = !item.track_stock;
        // Turning tracking on for the first time seeds a starting count of 0
        // rather than leaving it null (null means "not tracked" -- once
        // tracking is on, "unknown" isn't a useful stock_quantity anymore).
        const nextStockQuantity =
          nextTrackStock && item.stock_quantity === null ? 0 : item.stock_quantity;
        const next = { ...item, track_stock: nextTrackStock, stock_quantity: nextStockQuantity };
        handleBlurSave(next);
        return next;
      }),
    );
  }

  function handleBlurSave(item: PriceListItem) {
    startTransition(async () => {
      const result = await updatePriceListItem(item.id, {
        label: item.label,
        unit: item.unit,
        unitPriceCents: item.unit_price_cents,
        category: item.category,
        trackStock: item.track_stock,
        stockQuantity: item.stock_quantity,
        lowStockThreshold: item.low_stock_threshold,
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

  function handleRestock(id: string) {
    const raw = restockAmounts[id] ?? "";
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Menge muss größer als 0 sein.");
      return;
    }
    startTransition(async () => {
      const result = await restockPriceListItem(id, amount);
      if (result.error !== null) {
        setError(result.error);
        return;
      }
      setError(null);
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, stock_quantity: result.stockQuantity } : item,
        ),
      );
      setLastSavedItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, stock_quantity: result.stockQuantity } : item,
        ),
      );
      setRestockAmounts((prev) => ({ ...prev, [id]: "" }));
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
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[#0f172a]">{t.title}</h1>
        <div className="flex items-center gap-4">
          <Link
            href="/price-list/import/supplier"
            className="text-sm font-medium text-[#2563eb] hover:text-[#1d4ed8]"
          >
            {t.supplierPriceUpdate}
          </Link>
          <Link
            href="/price-list/import"
            className="text-sm font-medium text-[#2563eb] hover:text-[#1d4ed8]"
          >
            {t.importCsv}
          </Link>
        </div>
      </div>
      {error && <p className="text-sm text-[#dc2626]">{error}</p>}
      <div className="flex flex-col gap-3 rounded-2xl border border-[#e9edf2] bg-white p-6">
        <h2 className="text-lg font-medium text-[#0f172a]">{t.bulkAdjustTitle}</h2>
        <p className="text-sm text-[#64748b]">{t.bulkAdjustDescription}</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            value={adjustPercent}
            onChange={(e) => setAdjustPercent(e.target.value)}
            placeholder={t.bulkAdjustPlaceholder}
            className="w-40 rounded-xl border border-[#e9edf2] p-2.5 font-mono text-sm text-[#0f172a] outline-none focus:border-[#2563eb]"
          />
          <span className="text-sm text-[#64748b]">%</span>
          <button
            onClick={handleBulkAdjust}
            disabled={isAdjusting || items.length === 0}
            className="rounded-full bg-[#2563eb] px-5 py-2.5 text-sm font-medium text-white shadow-[0_6px_16px_rgba(37,99,235,0.3)] transition-colors hover:bg-[#1d4ed8] disabled:opacity-50"
          >
            {t.bulkAdjustApply}
          </button>
        </div>
        {adjustMessage && <p className="text-sm text-[#16a34a]">{adjustMessage}</p>}
      </div>
      {/* overflow-x-auto (not overflow-hidden) so on narrow viewports the
          table scrolls horizontally instead of squeezing/clipping columns;
          min-w-[720px] keeps every column at a readable width even when the
          viewport is narrower than that. */}
      <div className="overflow-x-auto rounded-2xl border border-[#e9edf2] bg-white">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[#e9edf2] text-xs font-medium uppercase tracking-wide text-[#94a3b8]">
              <th className="px-4 py-3 w-[28%]">{t.colLabel}</th>
              <th className="px-4 py-3 w-[10%]">{t.colUnit}</th>
              <th className="px-4 py-3 w-[12%]">{t.colPrice}</th>
              <th className="px-4 py-3 w-[16%]">{t.colCategory}</th>
              <th className="px-4 py-3 w-[26%]">{t.colStock}</th>
              <th className="px-4 py-3 w-[8%]"></th>
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
                    className={inputClass}
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
                    className={`font-mono ${inputClass}`}
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    value={item.category}
                    onChange={(e) => handleFieldChange(item.id, "category", e.target.value)}
                    onBlur={() => handleBlurSave(item)}
                    className={inputClass}
                  />
                </td>
                <td className="px-4 py-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="flex items-center gap-2 text-xs text-[#64748b]">
                      <input
                        type="checkbox"
                        checked={item.track_stock}
                        onChange={() => handleToggleTrackStock(item.id)}
                        className="h-4 w-4"
                      />
                      Bestand verfolgen
                    </label>
                    {item.track_stock && (
                      <>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            value={item.stock_quantity ?? ""}
                            onChange={(e) =>
                              setItems((prev) =>
                                prev.map((i) =>
                                  i.id === item.id
                                    ? {
                                        ...i,
                                        stock_quantity:
                                          e.target.value.trim().length === 0
                                            ? null
                                            : Number(e.target.value),
                                      }
                                    : i,
                                ),
                              )
                            }
                            onBlur={() => handleBlurSave(item)}
                            placeholder="Bestand"
                            className={`w-20 font-mono ${inputClass}`}
                          />
                          {isLowStock(item) && (
                            <span className="rounded-full bg-[#fef2f2] px-2 py-0.5 text-xs font-medium text-[#dc2626]">
                              Niedrig
                            </span>
                          )}
                        </div>
                        <input
                          type="number"
                          value={item.low_stock_threshold ?? ""}
                          onChange={(e) =>
                            handleFieldChange(item.id, "low_stock_threshold", e.target.value)
                          }
                          onBlur={() => handleBlurSave(item)}
                          placeholder="Meldebestand"
                          className={`w-20 font-mono ${inputClass}`}
                        />
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            value={restockAmounts[item.id] ?? ""}
                            onChange={(e) =>
                              setRestockAmounts((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                            placeholder="Menge"
                            className="w-16 rounded-lg border border-[#e9edf2] px-2 py-1 text-xs font-mono outline-none focus:border-[#2563eb]"
                          />
                          <button
                            onClick={() => handleRestock(item.id)}
                            disabled={isPending}
                            className="rounded-full border border-[#e9edf2] px-2.5 py-1 text-xs font-medium text-[#2563eb] hover:bg-[#eff6ff] disabled:opacity-50"
                          >
                            Auffüllen
                          </button>
                        </div>
                      </>
                    )}
                  </div>
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
