"use client";

// Proactive AI risk-flag notice (issue #193). Renders above the line items
// on the quote draft/review screen whenever generateQuoteDraft's AI call
// (lib/quotes/generateLineItems.ts) surfaced known German-market risk flags
// (Asbest, WEG-Beschluss, Denkmalschutz) from the job description.
//
// Styling deliberately reuses the amber "non-verifying disclaimer" visual
// pattern already established by GobdComplianceNotice
// (app/(app)/invoices/GobdComplianceNotice.tsx), since the legal posture is
// the same: helpful-but-not-authoritative, always says so explicitly. Unlike
// that notice, this one IS dismissible -- these are advisory flags for the
// tradesperson to review before sending the quote, not a standing compliance
// caveat that must always be visible.
import { useState, useTransition } from "react";
import { acknowledgeRiskFlags } from "./actions";

export type RiskFlag = {
  type: "asbestos" | "weg_approval" | "denkmalschutz";
  message: string;
};

const RISK_FLAG_LABELS: Record<RiskFlag["type"], string> = {
  asbestos: "Asbest",
  weg_approval: "WEG-Zustimmung erforderlich",
  denkmalschutz: "Denkmalschutz",
};

export function RiskFlagsNotice({
  quoteId,
  riskFlags,
  acknowledgedAt,
}: {
  quoteId: string;
  riskFlags: RiskFlag[];
  acknowledgedAt: string | null;
}) {
  // Per-flag dismiss (spec: "dismissible-per-item, not per-banner"). All
  // flags start dismissed if the quote was already fully acknowledged in a
  // previous visit; the whole notice unmounts once every flag is dismissed.
  const [dismissedIndexes, setDismissedIndexes] = useState<Set<number>>(
    () => new Set(acknowledgedAt !== null ? riskFlags.map((_, i) => i) : []),
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const visibleFlags = riskFlags
    .map((flag, index) => ({ flag, index }))
    .filter(({ index }) => !dismissedIndexes.has(index));

  if (riskFlags.length === 0 || visibleFlags.length === 0) {
    return null;
  }

  function dismiss(index: number) {
    setError(null);
    const next = new Set(dismissedIndexes);
    next.add(index);
    setDismissedIndexes(next);

    // Once every flag has been dismissed, persist the acknowledgement
    // timestamp server-side (issue #193) -- this never clears ai_risk_flags,
    // just stamps ai_risk_flags_acknowledged_at.
    if (next.size >= riskFlags.length) {
      startTransition(async () => {
        const result = await acknowledgeRiskFlags(quoteId);
        if (result.error) {
          setError(result.error);
        }
      });
    }
  }

  return (
    <div
      role="note"
      className="flex flex-col gap-3 rounded-2xl border-2 border-[#f59e0b] bg-[#fffbeb] p-4 text-sm text-[#92400e]"
    >
      <p className="font-semibold">KI-Hinweise zu möglichen Risiken</p>
      <p>
        Die KI hat anhand der Auftragsbeschreibung folgende mögliche Risiken erkannt.{" "}
        <strong>hantverkare prüft dies nicht verbindlich</strong> — bitte kläre die Punkte mit der
        zuständigen Behörde bzw. der Hausverwaltung, bevor du das Angebot verschickst.
      </p>
      <ul className="flex flex-col gap-2">
        {visibleFlags.map(({ flag, index }) => (
          <li
            key={`${flag.type}-${index}`}
            className="flex flex-col gap-2 rounded-xl border border-[#fbbf24] bg-white/60 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex flex-col gap-1">
              <span className="font-medium">{RISK_FLAG_LABELS[flag.type] ?? flag.type}</span>
              <span>{flag.message}</span>
            </div>
            <button
              type="button"
              onClick={() => dismiss(index)}
              disabled={isPending}
              className="shrink-0 rounded-lg border border-[#f59e0b] bg-white px-3 py-1.5 text-sm font-medium text-[#92400e] hover:bg-[#fef3c7] disabled:opacity-60"
            >
              Verstanden
            </button>
          </li>
        ))}
      </ul>
      {error ? <p className="text-red-700">{error}</p> : null}
    </div>
  );
}
