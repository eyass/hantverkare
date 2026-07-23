"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PriceListEditor } from "./PriceListEditor";
import { createPriceListItemsFromTemplate } from "./actions";
import { useAppLanguage } from "@/lib/i18n/AppLanguageProvider";
import { PRICE_LIST_DICTIONARY } from "./price-list.dictionary";

export type TemplateItem = {
  id: string;
  label: string;
  unit: string;
  defaultUnitPriceCents: number;
  category: string;
};

export type TemplateWithItems = {
  id: string;
  tradeKey: string;
  tradeLabel: string;
  items: TemplateItem[];
};

function centsToEuroString(cents: number): string {
  return (cents / 100).toFixed(2);
}

const inputClass =
  "w-24 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm text-[#0f172a] outline-none transition-colors focus:border-[#e9edf2] focus:bg-[#f4f6f8]";

export function PriceListWizard({ templates }: { templates: TemplateWithItems[] }) {
  const { language } = useAppLanguage();
  const t = PRICE_LIST_DICTIONARY[language];
  const [step, setStep] = useState<"pick" | "review" | "blank">("pick");
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateWithItems | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function pickTemplate(template: TemplateWithItems) {
    setSelectedTemplate(template);
    setChecked(Object.fromEntries(template.items.map((item) => [item.id, true])));
    setPrices(Object.fromEntries(template.items.map((item) => [item.id, item.defaultUnitPriceCents])));
    setStep("review");
  }

  function handleApply() {
    if (!selectedTemplate) return;
    const selections = selectedTemplate.items
      .filter((item) => checked[item.id])
      .map((item) => ({ templateItemId: item.id, unitPriceCents: prices[item.id] }));

    startTransition(async () => {
      const result = await createPriceListItemsFromTemplate(selectedTemplate.id, selections);
      if (result.error !== null) {
        setError(result.error);
        return;
      }
      setError(null);
      router.refresh();
    });
  }

  if (step === "blank") {
    return <PriceListEditor items={[]} />;
  }

  if (step === "review" && selectedTemplate) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6 sm:p-8">
        <h1 className="text-2xl font-semibold text-[#0f172a]">{selectedTemplate.tradeLabel}</h1>
        {error && <p className="text-sm text-[#dc2626]">{error}</p>}
        <div className="overflow-hidden rounded-2xl border border-[#e9edf2] bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#e9edf2] text-xs font-medium uppercase tracking-wide text-[#94a3b8]">
                <th className="px-4 py-3"></th>
                <th className="px-4 py-3">{t.colLabel}</th>
                <th className="px-4 py-3">{t.colUnit}</th>
                <th className="px-4 py-3">{t.colPrice}</th>
              </tr>
            </thead>
            <tbody>
              {selectedTemplate.items.map((item) => (
                <tr key={item.id} className="border-b border-[#e9edf2] last:border-b-0">
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={checked[item.id] ?? false}
                      onChange={(e) =>
                        setChecked((prev) => ({ ...prev, [item.id]: e.target.checked }))
                      }
                    />
                  </td>
                  <td className="px-4 py-2">{item.label}</td>
                  <td className="px-4 py-2">{item.unit}</td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={centsToEuroString(prices[item.id] ?? item.defaultUnitPriceCents)}
                      onChange={(e) =>
                        setPrices((prev) => ({
                          ...prev,
                          [item.id]: Math.round(Number(e.target.value) * 100),
                        }))
                      }
                      className={`font-mono ${inputClass}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setStep("pick")}
            className="rounded-full border border-[#e9edf2] px-5 py-2.5 text-sm font-medium text-[#0f172a]"
          >
            {t.back}
          </button>
          <button
            onClick={handleApply}
            disabled={isPending}
            className="rounded-full bg-[#2563eb] px-5 py-2.5 text-sm font-medium text-white shadow-[0_6px_16px_rgba(37,99,235,0.3)] transition-colors hover:bg-[#1d4ed8] disabled:opacity-50"
          >
            {t.apply}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6 sm:p-8">
      <h1 className="text-2xl font-semibold text-[#0f172a]">{t.wizardTitle}</h1>
      <p className="text-sm text-[#64748b]">
        {t.wizardDescription}
      </p>
      <div className="grid grid-cols-2 gap-3">
        {templates.map((template) => (
          <button
            key={template.id}
            onClick={() => pickTemplate(template)}
            className="rounded-2xl border border-[#e9edf2] bg-white p-6 text-left text-sm font-medium text-[#0f172a] transition-colors hover:border-[#2563eb]"
          >
            {template.tradeLabel}
          </button>
        ))}
        <button
          onClick={() => setStep("blank")}
          className="rounded-2xl border border-dashed border-[#e9edf2] bg-white p-6 text-left text-sm font-medium text-[#64748b] transition-colors hover:border-[#2563eb]"
        >
          {t.startBlank}
        </button>
      </div>
    </div>
  );
}
