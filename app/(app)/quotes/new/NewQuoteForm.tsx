"use client";

import { useActionState, useEffect, useRef } from "react";
import { generateQuoteDraft, type GenerateQuoteState } from "./actions";
import { VoiceRecorder } from "./VoiceRecorder";
import { useOnlineStatus } from "@/lib/hooks/useOnlineStatus";
import { clearDraft, loadDraft, saveDraft, type QuoteDraft } from "@/lib/quotes/draftStorage";

const initialState: GenerateQuoteState = { error: null };

type Customer = {
  id: string;
  name: string;
};

export default function NewQuoteForm({ customers }: { customers: Customer[] }) {
  const [state, formAction, isPending] = useActionState(generateQuoteDraft, initialState);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const customerSelectRef = useRef<HTMLSelectElement>(null);
  const isOnline = useOnlineStatus();

  // These fields are intentionally uncontrolled (like the original form) --
  // this ref just mirrors the current values so we know what to persist to
  // localStorage, without routing every keystroke through React state.
  const draftRef = useRef<QuoteDraft>({ customerId: "", description: "" });
  const hasSubmittedRef = useRef(false);
  const wasPendingRef = useRef(false);

  // Restore any in-progress draft on mount (e.g. after a reload or a
  // dropped-connection tab close). Purely imperative DOM + ref updates, no
  // React state -- this is plain localStorage persistence of form text only,
  // it does not queue or replay the AI-generation request itself.
  useEffect(() => {
    const draft = loadDraft(window.localStorage);
    if (!draft) return;
    draftRef.current = draft;
    if (draft.description && textareaRef.current) {
      textareaRef.current.value = draft.description;
    }
    if (draft.customerId && customerSelectRef.current) {
      customerSelectRef.current.value = draft.customerId;
    }
  }, []);

  // Once a submission finishes without an error, the server action has
  // either redirected (success) or is about to -- either way the draft is no
  // longer needed. If it finished WITH an error, we deliberately leave the
  // draft in place (the user is still on the page and may retry).
  useEffect(() => {
    if (isPending) {
      wasPendingRef.current = true;
      return;
    }
    if (wasPendingRef.current && hasSubmittedRef.current && !state.error) {
      clearDraft(window.localStorage);
      draftRef.current = { customerId: "", description: "" };
    }
    wasPendingRef.current = false;
  }, [isPending, state.error]);

  function persistDraft(patch: Partial<QuoteDraft>) {
    draftRef.current = { ...draftRef.current, ...patch };
    saveDraft(window.localStorage, draftRef.current);
  }

  function handleTranscript(text: string) {
    if (textareaRef.current) {
      textareaRef.current.value = text;
    }
    persistDraft({ description: text });
  }

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col gap-6 px-4 py-10 sm:px-8">
      <h1 className="text-center text-2xl font-semibold text-[#0f172a]">Neues Angebot</h1>
      {!isOnline && (
        <div
          role="status"
          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800"
        >
          Du bist offline — Änderungen werden lokal gespeichert. Zum Erstellen des Angebots wird
          eine Internetverbindung benötigt.
        </div>
      )}
      <form
        action={formAction}
        onSubmit={() => {
          hasSubmittedRef.current = true;
        }}
        className="flex flex-col gap-5 rounded-2xl border border-[#e9edf2] bg-white p-6 shadow-sm sm:p-8"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="customerId" className="text-sm font-medium text-[#0f172a]">
            Kunde
          </label>
          <select
            ref={customerSelectRef}
            id="customerId"
            name="customerId"
            defaultValue=""
            onChange={(e) => persistDraft({ customerId: e.target.value })}
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
        <div className="flex flex-col gap-1.5">
          <label htmlFor="description" className="text-sm font-medium text-[#0f172a]">
            Auftragsbeschreibung
          </label>
          <textarea
            ref={textareaRef}
            id="description"
            name="description"
            required
            rows={6}
            maxLength={2000}
            onChange={(e) => persistDraft({ description: e.target.value })}
            placeholder="Beschreibe den Auftrag, z. B. Küchenspüle austauschen, neuen Wasserhahn montieren, 2 Stunden Arbeit"
            className="w-full rounded-xl border border-[#e9edf2] p-3 text-base text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#2563eb] focus:outline-none"
          />
        </div>
        <VoiceRecorder onTranscript={handleTranscript} />
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={isPending || !isOnline}
          className="self-center rounded-full bg-[#2563eb] px-6 py-3 text-sm font-medium text-white shadow-[0_6px_16px_rgba(37,99,235,0.3)] transition hover:not-disabled:bg-[#1d4ed8] disabled:opacity-50"
        >
          {isPending
            ? "Angebot wird erstellt…"
            : !isOnline
              ? "Keine Verbindung"
              : "Angebot erstellen"}
        </button>
      </form>
    </div>
  );
}
