"use client";

import { useState, useTransition } from "react";
import { createQuoteFromTemplate } from "./actions";

type Customer = {
  id: string;
  name: string;
};

type Template = {
  id: string;
  name: string;
  itemCount: number;
};

export function FromTemplateForm({ customers, templates }: { customers: Customer[]; templates: Template[] }) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [customerId, setCustomerId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!templateId) return;
    startTransition(async () => {
      const result = await createQuoteFromTemplate(templateId, customerId || null);
      if (result.error !== null) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 pb-10 sm:px-8">
      <div className="flex flex-col gap-4 rounded-2xl border border-[#e9edf2] bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-medium text-[#0f172a]">Oder aus Vorlage erstellen</h2>
        <p className="text-sm text-[#64748b]">
          Für wiederkehrende Aufträge: übernimm die Positionen einer gespeicherten Vorlage direkt, ohne
          Auftragsbeschreibung.
        </p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="templateId" className="text-sm font-medium text-[#0f172a]">
            Vorlage
          </label>
          <select
            id="templateId"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="w-full rounded-xl border border-[#e9edf2] bg-white p-2.5 text-sm text-[#0f172a] focus:border-[#2563eb] focus:outline-none"
          >
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} ({template.itemCount} {template.itemCount === 1 ? "Position" : "Positionen"})
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="templateCustomerId" className="text-sm font-medium text-[#0f172a]">
            Kunde
          </label>
          <select
            id="templateCustomerId"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="w-full rounded-xl border border-[#e9edf2] bg-white p-2.5 text-sm text-[#0f172a] focus:border-[#2563eb] focus:outline-none"
          >
            <option value="">— kein Kunde ausgewählt —</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-[#dc2626]">{error}</p>}
        <button
          onClick={handleSubmit}
          disabled={isPending || !templateId}
          className="self-start rounded-full border border-[#2563eb] px-6 py-2.5 text-sm font-medium text-[#2563eb] transition-colors hover:bg-[#eff6ff] disabled:opacity-50"
        >
          {isPending ? "Angebot wird erstellt…" : "Aus Vorlage erstellen"}
        </button>
      </div>
    </div>
  );
}
