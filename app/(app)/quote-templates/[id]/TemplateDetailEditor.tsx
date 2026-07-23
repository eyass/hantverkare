"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { updateQuoteTemplate, restoreQuoteTemplateVersion } from "../actions";
import { useAppLanguage } from "@/lib/i18n/AppLanguageProvider";
import { QUOTE_TEMPLATE_DETAIL_DICTIONARY } from "./quote-template-detail.dictionary";

type Item = {
  id?: string;
  label: string;
  unit: string;
  quantity: number;
  unitPriceCents: number;
};

type Version = {
  id: string;
  versionNumber: number;
  name: string;
  items: { label: string; unit: string; quantity: number; unitPriceCents: number }[];
  createdAt: string;
};

type Template = { id: string; name: string; createdAt: string };

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("de-DE");
}

function centsToEuroString(cents: number): string {
  return (cents / 100).toFixed(2);
}

function euroStringToCents(value: string): number {
  return Math.round(parseFloat(value || "0") * 100);
}

export function TemplateDetailEditor({
  template,
  items: initialItems,
  versions,
}: {
  template: Template;
  items: Item[];
  versions: Version[];
}) {
  const { language } = useAppLanguage();
  const t = QUOTE_TEMPLATE_DETAIL_DICTIONARY[language];

  const [name, setName] = useState(template.name);
  const [items, setItems] = useState<Item[]>(initialItems);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateItem(index: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addItem() {
    setItems((prev) => [...prev, { label: "", unit: "Stück", quantity: 1, unitPriceCents: 0 }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSave() {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await updateQuoteTemplate(template.id, {
        name,
        items: items.map((item) => ({
          label: item.label,
          unit: item.unit,
          quantity: item.quantity,
          unit_price_cents: item.unitPriceCents,
        })),
      });
      if (result.error !== null) {
        setError(result.error);
        return;
      }
      setSuccess(true);
    });
  }

  function handleRestore(versionId: string) {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await restoreQuoteTemplateVersion(template.id, versionId);
      if (result.error !== null) {
        setError(result.error);
        return;
      }
      window.location.reload();
    });
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <Link href="/quote-templates" className="text-sm font-medium text-[#2563eb] hover:underline">
            {t.back}
          </Link>
          <h1 className="text-2xl font-semibold text-[#0f172a]">{t.title}</h1>
        </div>
      </div>

      {error && <p className="text-sm text-[#dc2626]">{error}</p>}
      {success && <p className="text-sm text-[#16a34a]">{t.saved}</p>}

      <section className="flex flex-col gap-4 rounded-2xl border border-[#e9edf2] bg-white p-6">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-[#94a3b8]">{t.nameLabel}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm text-[#0f172a]"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium uppercase tracking-wide text-[#94a3b8]">{t.itemsLabel}</label>
          <div className="overflow-hidden rounded-xl border border-[#e9edf2]">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#e9edf2] text-xs font-medium uppercase tracking-wide text-[#94a3b8]">
                  <th className="px-3 py-2">{t.colLabel}</th>
                  <th className="px-3 py-2">{t.colUnit}</th>
                  <th className="px-3 py-2">{t.colQuantity}</th>
                  <th className="px-3 py-2">{t.colPrice}</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id ?? `new-${index}`} className="border-b border-[#e9edf2] last:border-b-0">
                    <td className="px-3 py-2">
                      <input
                        value={item.label}
                        onChange={(e) => updateItem(index, { label: e.target.value })}
                        className="w-full rounded border border-[#e2e8f0] px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={item.unit}
                        onChange={(e) => updateItem(index, { unit: e.target.value })}
                        className="w-20 rounded border border-[#e2e8f0] px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, { quantity: parseFloat(e.target.value || "0") })}
                        className="w-20 rounded border border-[#e2e8f0] px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        value={centsToEuroString(item.unitPriceCents)}
                        onChange={(e) => updateItem(index, { unitPriceCents: euroStringToCents(e.target.value) })}
                        className="w-24 rounded border border-[#e2e8f0] px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => removeItem(index)}
                        className="text-xs font-medium text-[#dc2626] hover:text-[#b91c1c]"
                      >
                        {t.removeItem}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={addItem}
            className="self-start text-sm font-medium text-[#2563eb] hover:text-[#1d4ed8]"
          >
            {t.addItem}
          </button>
        </div>

        <button
          onClick={handleSave}
          disabled={isPending}
          className="self-start rounded-full bg-[#2563eb] px-5 py-2.5 text-sm font-medium text-white shadow-[0_6px_16px_rgba(37,99,235,0.3)] transition-colors hover:bg-[#1d4ed8] disabled:opacity-50"
        >
          {t.save}
        </button>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-[#0f172a]">{t.historyTitle}</h2>
        {versions.length === 0 ? (
          <p className="rounded-2xl border border-[#e9edf2] bg-white p-6 text-sm text-[#64748b]">
            {t.historyEmpty}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {versions.map((version) => (
              <li key={version.id} className="rounded-2xl border border-[#e9edf2] bg-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#0f172a]">
                      {t.versionLabel} {version.versionNumber} — {version.name}
                    </p>
                    <p className="text-xs text-[#94a3b8]">{formatDateTime(version.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() =>
                        setExpandedVersionId((prev) => (prev === version.id ? null : version.id))
                      }
                      className="text-sm font-medium text-[#2563eb] hover:text-[#1d4ed8]"
                    >
                      {expandedVersionId === version.id ? t.hide : t.view}
                    </button>
                    <button
                      onClick={() => handleRestore(version.id)}
                      disabled={isPending}
                      className="text-sm font-medium text-[#0f172a] hover:text-[#2563eb] disabled:opacity-50"
                    >
                      {t.restore}
                    </button>
                  </div>
                </div>
                {expandedVersionId === version.id && (
                  <table className="mt-3 w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#e9edf2] uppercase tracking-wide text-[#94a3b8]">
                        <th className="py-1.5 pr-2">{t.colLabel}</th>
                        <th className="py-1.5 pr-2">{t.colUnit}</th>
                        <th className="py-1.5 pr-2">{t.colQuantity}</th>
                        <th className="py-1.5 pr-2">{t.colPrice}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {version.items.map((item, index) => (
                        <tr key={index} className="border-b border-[#e9edf2] text-[#334155] last:border-b-0">
                          <td className="py-1.5 pr-2">{item.label}</td>
                          <td className="py-1.5 pr-2">{item.unit}</td>
                          <td className="py-1.5 pr-2">{item.quantity}</td>
                          <td className="py-1.5 pr-2">{centsToEuroString(item.unitPriceCents)} €</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
