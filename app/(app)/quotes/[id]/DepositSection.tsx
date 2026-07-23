"use client";

import { useState, useTransition } from "react";
import { setDepositPercent } from "./actions";

function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", { year: "numeric", month: "long", day: "numeric" });
}

/**
 * Deposit (Anzahlung) configuration + status, issue #162.
 *
 * Before signing (draft/final): the tradesperson can set or clear a deposit
 * percentage. After signing: read-only status (pending/paid), since the
 * amount is locked in at that point (see setDepositPercent's guard).
 */
export function DepositSection({
  quoteId,
  status,
  totalCents,
  depositPercent,
  depositAmountCents,
  depositPaidAt,
}: {
  quoteId: string;
  status: string;
  totalCents: number;
  depositPercent: number | null;
  depositAmountCents: number | null;
  depositPaidAt: string | null;
}) {
  const [percent, setPercent] = useState<number | null>(depositPercent);
  const [draftValue, setDraftValue] = useState(depositPercent !== null ? String(depositPercent) : "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canConfigure = status === "draft" || status === "final";
  const previewAmountCents = percent !== null ? Math.round((totalCents * percent) / 100) : null;

  function save(nextPercent: number | null) {
    setError(null);
    startTransition(async () => {
      const result = await setDepositPercent(quoteId, nextPercent);
      if (result.error) {
        setError(result.error);
        return;
      }
      setPercent(nextPercent);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (draftValue.trim() === "") {
      save(null);
      return;
    }
    const parsed = Number(draftValue);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
      setError("Anzahlung muss zwischen 1 und 100 Prozent liegen.");
      return;
    }
    save(parsed);
  }

  if (!canConfigure) {
    if (!percent) {
      return null;
    }
    return (
      <div className="flex flex-col gap-1.5 rounded-xl border border-[#e9edf2] bg-[#f8fafc] p-4 text-sm">
        <span className="font-medium text-[#0f172a]">Anzahlung</span>
        <span className="text-[#64748b]">
          {percent}% {depositAmountCents !== null ? `(${formatEuros(depositAmountCents)})` : ""}
        </span>
        {depositPaidAt ? (
          <span className="inline-flex w-fit rounded-full bg-[#dcfce7] px-2.5 py-1 text-xs font-medium text-[#16a34a]">
            Bezahlt am {formatDateTime(depositPaidAt)}
          </span>
        ) : (
          <span className="inline-flex w-fit rounded-full bg-[#fef9c3] px-2.5 py-1 text-xs font-medium text-[#a16207]">
            Ausstehend
          </span>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-xl border border-[#e9edf2] bg-white p-4 text-sm"
    >
      <span className="font-medium text-[#0f172a]">Anzahlung anfordern (optional)</span>
      {error && <p className="text-xs text-[#dc2626]">{error}</p>}
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          max={100}
          step={1}
          value={draftValue}
          onChange={(e) => setDraftValue(e.target.value)}
          disabled={isPending}
          placeholder="z. B. 30"
          className="w-24 rounded-xl border border-[#e9edf2] bg-white px-3 py-2 text-[#0f172a] focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb] disabled:opacity-50"
        />
        <span className="text-[#64748b]">%</span>
        <button
          type="submit"
          disabled={isPending}
          className="ml-auto rounded-full bg-[#2563eb] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#1d4ed8] disabled:opacity-50"
        >
          Speichern
        </button>
      </div>
      {previewAmountCents !== null && (
        <span className="text-xs text-[#64748b]">≈ {formatEuros(previewAmountCents)} beim aktuellen Gesamtbetrag</span>
      )}
      {percent !== null && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setDraftValue("");
            save(null);
          }}
          className="self-start text-xs text-[#64748b] underline disabled:opacity-50"
        >
          Anzahlung entfernen
        </button>
      )}
    </form>
  );
}
