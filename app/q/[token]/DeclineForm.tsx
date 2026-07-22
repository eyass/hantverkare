"use client";

import { useState, useTransition } from "react";
import { declineQuote } from "./actions";

export function DeclineForm({ token }: { token: string }) {
  const [expanded, setExpanded] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await declineQuote(token, reason);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setDeclined(true);
    });
  }

  if (declined) {
    return (
      <div className="rounded-2xl bg-[#fee2e2] p-6 text-center">
        <p className="text-sm font-medium text-[#b91c1c]">Sie haben dieses Angebot abgelehnt.</p>
      </div>
    );
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="self-start rounded-full border border-[#e9edf2] bg-white px-5 py-3 text-sm font-medium text-[#64748b] transition-colors hover:bg-[#f4f6f8]"
      >
        Angebot ablehnen
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-2xl border border-[#e9edf2] bg-white p-6"
    >
      <h2 className="text-lg font-semibold text-[#0f172a]">Angebot ablehnen</h2>
      {error && <p className="text-sm text-[#dc2626]">{error}</p>}
      <label className="flex flex-col gap-1 text-sm text-[#0f172a]">
        Grund (optional)
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={isPending}
          rows={3}
          maxLength={500}
          className="rounded-xl border border-[#e9edf2] bg-white px-3 py-2 text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#dc2626] focus:outline-none focus:ring-1 focus:ring-[#dc2626] disabled:opacity-50"
          placeholder="z. B. Preis zu hoch, anderen Anbieter gewählt ..."
        />
      </label>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setExpanded(false)}
          disabled={isPending}
          className="rounded-full border border-[#e9edf2] bg-white px-5 py-3 text-sm font-medium text-[#64748b] transition-colors hover:bg-[#f4f6f8] disabled:opacity-50"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-[#dc2626] px-5 py-3 text-sm font-medium text-white shadow-[0_6px_16px_rgba(220,38,38,0.3)] transition-colors hover:bg-[#b91c1c] disabled:opacity-50"
        >
          Ablehnung bestätigen
        </button>
      </div>
    </form>
  );
}
