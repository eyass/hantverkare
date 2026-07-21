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
      <p className="rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
        Vielen Dank! Ihre Bestätigung wurde gespeichert.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
      <h2 className="text-lg font-semibold">Angebot bestätigen</h2>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <label className="flex flex-col gap-1 text-sm">
        Vollständiger Name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isPending}
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          placeholder="Max Mustermann"
        />
      </label>
      <label className="flex items-start gap-2 text-sm">
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
        className="self-end rounded-full bg-foreground px-5 py-3 text-background disabled:opacity-50"
      >
        Verbindlich bestätigen
      </button>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Dies ist eine einfache Zustimmungsbestätigung, keine qualifizierte elektronische
        Signatur im Sinne der eIDAS-Verordnung.
      </p>
    </form>
  );
}
