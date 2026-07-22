"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { deleteQuoteTemplate } from "./actions";

type Template = {
  id: string;
  name: string;
  createdAt: string;
  itemCount: number;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE");
}

export function QuoteTemplatesEditor({ templates: initialTemplates }: { templates: Template[] }) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteQuoteTemplate(id);
      if (result.error !== null) {
        setError(result.error);
        return;
      }
      setError(null);
      setTemplates((prev) => prev.filter((template) => template.id !== id));
    });
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[#0f172a]">Angebotsvorlagen</h1>
        <Link
          href="/quotes/new"
          className="rounded-full bg-[#2563eb] px-5 py-2.5 text-sm font-medium text-white shadow-[0_6px_16px_rgba(37,99,235,0.3)] transition-colors hover:bg-[#1d4ed8]"
        >
          Neues Angebot
        </Link>
      </div>
      <p className="text-sm text-[#64748b]">
        Speichere wiederkehrende Positionen (z. B. &bdquo;Badezimmer Renovierung Standard&ldquo;) als Vorlage bei
        einem Angebot und füge sie hier verwaltet oder beim Erstellen eines neuen Angebots wieder ein.
      </p>
      {error && <p className="text-sm text-[#dc2626]">{error}</p>}
      {templates.length === 0 ? (
        <p className="rounded-2xl border border-[#e9edf2] bg-white p-6 text-sm text-[#64748b]">
          Noch keine Vorlagen gespeichert. Öffne ein Angebot und speichere seine Positionen als Vorlage.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#e9edf2] bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#e9edf2] text-xs font-medium uppercase tracking-wide text-[#94a3b8]">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Positionen</th>
                <th className="px-4 py-3">Erstellt</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id} className="border-b border-[#e9edf2] last:border-b-0">
                  <td className="px-4 py-3 font-medium text-[#0f172a]">{template.name}</td>
                  <td className="px-4 py-3 text-[#64748b]">{template.itemCount}</td>
                  <td className="px-4 py-3 text-[#64748b]">{formatDate(template.createdAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(template.id)}
                      disabled={isPending}
                      className="text-sm font-medium text-[#dc2626] hover:text-[#b91c1c] disabled:opacity-50"
                    >
                      Löschen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
