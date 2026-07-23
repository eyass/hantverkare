"use client";

import { useState, useTransition } from "react";
import { requestDepositCheckout } from "./actions";

function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

/**
 * Customer-facing "pay deposit" prompt (issue #162), shown on the signed-
 * quote page when a deposit was configured and isn't paid yet.
 *
 * The Checkout Session URL from signing (if any) isn't persisted anywhere
 * server-side and expires after 24h, so this always asks the server for a
 * fresh one on click rather than relying on a stale link -- see
 * requestDepositCheckout in ./actions.ts.
 */
export function DepositPayPrompt({
  token,
  depositPercent,
  depositAmountCents,
}: {
  token: string;
  depositPercent: number;
  depositAmountCents: number | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await requestDepositCheckout(token);
      if (result.error || !result.url) {
        setError(result.error ?? "Zahlungslink konnte nicht erstellt werden.");
        return;
      }
      window.location.href = result.url;
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#fef08a] bg-[#fefce8] p-6 text-center">
      <p className="text-sm font-medium text-[#854d0e]">
        Für dieses Angebot ist eine Anzahlung von {depositPercent}%
        {depositAmountCents !== null ? ` (${formatEuros(depositAmountCents)})` : ""} vorgesehen.
      </p>
      {error && <p className="text-xs text-[#dc2626]">{error}</p>}
      <button
        onClick={handleClick}
        disabled={isPending}
        className="self-center rounded-full bg-[#ca8a04] px-5 py-3 text-sm font-medium text-white shadow-[0_6px_16px_rgba(202,138,4,0.3)] transition-colors hover:bg-[#a16207] disabled:opacity-50"
      >
        {isPending ? "Wird vorbereitet…" : "Anzahlung jetzt bezahlen"}
      </button>
    </div>
  );
}
