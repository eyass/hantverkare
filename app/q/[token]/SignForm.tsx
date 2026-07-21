"use client";

import { useState, useTransition } from "react";
import { signQuote } from "./actions";

export function SignForm({ token }: { token: string }) {
  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signed, setSigned] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length === 0) {
      setError("Bitte geben Sie Ihren vollständigen Namen ein.");
      return;
    }
    if (!agreed) {
      setError("Bitte bestätigen Sie die Angebotsbedingungen.");
      return;
    }
    startTransition(async () => {
      const result = await signQuote(token, name);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setSigned(true);
    });
  }

  if (signed) {
    return (
      <div className="rounded-2xl bg-[#dcfce7] p-6 text-center">
        <p className="text-sm font-medium text-[#16a34a]">
          Vielen Dank! Ihre Bestätigung wurde gespeichert.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-2xl border border-[#e9edf2] bg-white p-6"
    >
      <h2 className="text-lg font-semibold text-[#0f172a]">Angebot bestätigen</h2>
      {error && <p className="text-sm text-[#dc2626]">{error}</p>}
      <label className="flex flex-col gap-1 text-sm text-[#0f172a]">
        Vollständiger Name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isPending}
          className="rounded-xl border border-[#e9edf2] bg-white px-3 py-2 text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb] disabled:opacity-50"
          placeholder="Max Mustermann"
        />
      </label>
      <label className="flex items-start gap-2 text-sm text-[#0f172a]">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          disabled={isPending}
          className="mt-1"
        />
        Ich stimme den Angebotsbedingungen zu.
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="self-end rounded-full bg-[#2563eb] px-5 py-3 text-sm font-medium text-white shadow-[0_6px_16px_rgba(37,99,235,0.3)] transition-colors hover:bg-[#1d4ed8] disabled:opacity-50"
      >
        Verbindlich bestätigen
      </button>
      <p className="text-xs font-medium text-[#64748b]">
        Dies ist eine einfache Zustimmungsbestätigung, keine qualifizierte elektronische
        Signatur im Sinne der eIDAS-Verordnung.
      </p>
    </form>
  );
}
