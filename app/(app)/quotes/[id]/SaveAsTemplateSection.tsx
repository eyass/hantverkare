"use client";

import { useState, useTransition } from "react";
import { createTemplateFromQuote } from "../../quote-templates/actions";

export function SaveAsTemplateSection({ quoteId }: { quoteId: string }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await createTemplateFromQuote(quoteId, name);
      if (result.error !== null) {
        setError(result.error);
        setSaved(false);
        return;
      }
      setError(null);
      setSaved(true);
      setName("");
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#e9edf2] bg-[#f8fafc] p-4">
      <h2 className="text-sm font-semibold text-[#0f172a]">Als Vorlage speichern</h2>
      <p className="text-xs text-[#64748b]">
        Speichere die aktuellen Positionen als wiederverwendbare Vorlage, z. B. für ähnliche Aufträge.
      </p>
      <input
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setSaved(false);
        }}
        placeholder="Name der Vorlage, z. B. Badezimmer Renovierung Standard"
        className="w-full rounded-xl border border-[#e9edf2] bg-white p-2.5 text-sm text-[#0f172a] outline-none focus:border-[#2563eb]"
      />
      {error && <p className="text-sm text-[#dc2626]">{error}</p>}
      {saved && <p className="text-sm text-[#16a34a]">Vorlage gespeichert.</p>}
      <button
        onClick={handleSave}
        disabled={isPending || name.trim().length === 0}
        className="w-full rounded-full border border-[#2563eb] px-5 py-2.5 text-sm font-medium text-[#2563eb] transition-colors hover:bg-[#eff6ff] disabled:opacity-50"
      >
        {isPending ? "Wird gespeichert…" : "Vorlage speichern"}
      </button>
    </div>
  );
}
