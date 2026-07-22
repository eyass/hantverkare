"use client";

// Client-side UI for the stalled-quotes follow-up nudge feature (issue #158):
// lists quotes that have been sent but not signed/declined for a while, and
// lets the tradesperson generate an AI-drafted follow-up message, review/edit
// it, and send it with one click via the existing email infra.

import { useState } from "react";
import Link from "next/link";
import { generateFollowupDraft, sendFollowupMessage } from "./followup-actions";

export type StalledQuote = {
  id: string;
  customerDescription: string;
  daysSinceSent: number;
};

type RowState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "draft"; message: string }
  | { phase: "sending"; message: string }
  | { phase: "sent" }
  | { phase: "error"; error: string; message?: string };

export type StalledQuotesCopy = {
  title: string;
  subtitle: (days: number) => string;
  draftCta: string;
  sendCta: string;
  sending: string;
  sent: string;
  regenerate: string;
};

const DEFAULT_COPY: StalledQuotesCopy = {
  title: "Überfällige Angebote",
  subtitle: (days) => `Vor ${days} Tagen gesendet, noch nicht signiert oder abgelehnt.`,
  draftCta: "KI-Entwurf vorschlagen",
  sendCta: "Senden",
  sending: "Wird gesendet...",
  sent: "Gesendet",
  regenerate: "Neu generieren",
};

export function StalledQuotesSection({
  quotes,
  copy = DEFAULT_COPY,
}: {
  quotes: StalledQuote[];
  copy?: StalledQuotesCopy;
}) {
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});

  if (quotes.length === 0) {
    return null;
  }

  const stateFor = (id: string): RowState => rowStates[id] ?? { phase: "idle" };

  function setRow(quoteId: string, next: RowState) {
    setRowStates((prev) => ({ ...prev, [quoteId]: next }));
  }

  async function handleDraft(quoteId: string) {
    setRow(quoteId, { phase: "loading" });
    const result = await generateFollowupDraft(quoteId);
    if (result.error !== null) {
      setRow(quoteId, { phase: "error", error: result.error });
      return;
    }
    setRow(quoteId, { phase: "draft", message: result.message });
  }

  function handleEdit(quoteId: string, message: string) {
    const current = stateFor(quoteId);
    if (current.phase !== "draft" && current.phase !== "error") return;
    setRow(quoteId, { phase: "draft", message });
  }

  async function handleSend(quoteId: string, message: string) {
    setRow(quoteId, { phase: "sending", message });
    const result = await sendFollowupMessage(quoteId, message);
    if (result.error) {
      setRow(quoteId, { phase: "error", error: result.error, message });
      return;
    }
    setRow(quoteId, { phase: "sent" });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#e9edf2] bg-white p-4">
      <h2 className="text-sm font-semibold text-[#0f172a]">{copy.title}</h2>
      <div className="flex flex-col gap-3">
        {quotes.map((quote) => {
          const state = stateFor(quote.id);
          const editableMessage: string | null =
            state.phase === "draft" || state.phase === "sending"
              ? state.message
              : state.phase === "error" && state.message !== undefined
                ? state.message
                : null;
          return (
            <div
              key={quote.id}
              className="flex flex-col gap-2 rounded-xl border border-[#e9edf2] bg-[#f8fafc] p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <Link
                  href={`/quotes/${quote.id}`}
                  className="truncate text-sm font-medium text-[#0f172a] hover:underline"
                >
                  {quote.customerDescription.length > 60
                    ? `${quote.customerDescription.slice(0, 60)}…`
                    : quote.customerDescription}
                </Link>
                <span className="shrink-0 rounded-full bg-[#fef3c7] px-2 py-0.5 text-xs font-semibold text-[#b45309]">
                  {copy.subtitle(quote.daysSinceSent)}
                </span>
              </div>

              {state.phase === "idle" && (
                <button
                  type="button"
                  onClick={() => handleDraft(quote.id)}
                  className="w-fit rounded-full border border-[#e9edf2] bg-white px-3 py-1.5 text-xs font-semibold text-[#2563eb] transition-colors hover:bg-[#eff6ff]"
                >
                  {copy.draftCta}
                </button>
              )}

              {state.phase === "loading" && (
                <span className="text-xs text-[#64748b]">...</span>
              )}

              {editableMessage !== null && (
                <div className="flex flex-col gap-2">
                  {state.phase === "error" && (
                    <span className="text-xs text-[#b91c1c]">{state.error}</span>
                  )}
                  <textarea
                    value={editableMessage}
                    onChange={(e) => handleEdit(quote.id, e.target.value)}
                    disabled={state.phase === "sending"}
                    rows={4}
                    className="w-full rounded-lg border border-[#e9edf2] bg-white p-2 text-sm text-[#0f172a]"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSend(quote.id, editableMessage)}
                      disabled={state.phase === "sending" || editableMessage.trim().length === 0}
                      className="rounded-full bg-[#2563eb] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {state.phase === "sending" ? copy.sending : copy.sendCta}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDraft(quote.id)}
                      disabled={state.phase === "sending"}
                      className="rounded-full border border-[#e9edf2] bg-white px-3 py-1.5 text-xs font-semibold text-[#0f172a] disabled:opacity-50"
                    >
                      {copy.regenerate}
                    </button>
                  </div>
                </div>
              )}

              {state.phase === "error" && state.message === undefined && (
                <span className="text-xs text-[#b91c1c]">{state.error}</span>
              )}
              {state.phase === "sent" && (
                <span className="text-xs font-semibold text-[#16a34a]">{copy.sent}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
