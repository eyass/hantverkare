"use client";

import { useActionState, useEffect, useRef } from "react";
import { generateQuoteDraft, type GenerateQuoteState } from "./actions";
import { VoiceRecorder } from "./VoiceRecorder";
import { useOnlineStatus } from "@/lib/hooks/useOnlineStatus";
import { clearDraft, loadDraft, saveDraft, type QuoteDraft } from "@/lib/quotes/draftStorage";
import { MAX_AUTO_RETRY_ATTEMPTS, shouldAutoRetry } from "@/lib/quotes/generationQueue";
import { isOfflineNetworkError } from "@/lib/quotes/offlineNetworkError";
import {
  clearQueuedGenerationStore,
  enqueueGeneration,
  useQueuedGeneration,
} from "@/lib/hooks/useQueuedGeneration";

const initialState: GenerateQuoteState = { error: null, queuedOffline: false };

/**
 * Wraps the real generateQuoteDraft server action so a failure caused by
 * the device being offline (or losing connectivity mid-request) is
 * distinguished from a genuine server/AI error. Offline failures are
 * reported back as `queuedOffline: true` instead of `error`, so the caller
 * can queue the request and retry automatically once back online. Genuine
 * errors (bad price list, AI generation failure, auth, etc.) pass through
 * untouched and surface immediately, same as before this change.
 */
async function submitOrQueue(
  prevState: GenerateQuoteState,
  formData: FormData,
): Promise<GenerateQuoteState> {
  const isOnline = typeof navigator === "undefined" ? true : navigator.onLine;
  if (!isOnline) {
    return { error: null, queuedOffline: true };
  }
  try {
    const result = await generateQuoteDraft(prevState, formData);
    return { ...result, queuedOffline: false };
  } catch (err) {
    if (isOfflineNetworkError(err, isOnline)) {
      return { error: null, queuedOffline: true };
    }
    throw err;
  }
}

type Customer = {
  id: string;
  name: string;
};

export default function NewQuoteForm({ customers }: { customers: Customer[] }) {
  const [state, formAction, isPending] = useActionState(submitOrQueue, initialState);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const customerSelectRef = useRef<HTMLSelectElement>(null);
  const isOnline = useOnlineStatus();
  const queued = useQueuedGeneration();
  const autoRetryExhausted =
    queued !== null && !isPending && isOnline && queued.attempts >= MAX_AUTO_RETRY_ATTEMPTS;

  // These fields are intentionally uncontrolled (like the original form) --
  // this ref just mirrors the current values so we know what to persist to
  // localStorage, without routing every keystroke through React state.
  const draftRef = useRef<QuoteDraft>({ customerId: "", description: "" });
  const hasSubmittedRef = useRef(false);
  const wasPendingRef = useRef(false);
  const retryInFlightRef = useRef(false);

  // Restore any in-progress draft, and any queued-but-not-yet-generated
  // submission, on mount (e.g. after a reload or a dropped-connection tab
  // close).
  useEffect(() => {
    const draft = loadDraft(window.localStorage);
    if (draft) {
      draftRef.current = draft;
      if (draft.description && textareaRef.current) {
        textareaRef.current.value = draft.description;
      }
      if (draft.customerId && customerSelectRef.current) {
        customerSelectRef.current.value = draft.customerId;
      }
    }
    // Note: the queued-generation entry itself is read via the
    // useQueuedGeneration external store, not loaded here.
  }, []);

  // Once a submission finishes: on success, both the draft and the queue
  // entry are no longer needed. On a genuine error, leave the draft in
  // place (the user is still on the page and may retry) but drop the queue
  // entry -- we do not silently retry a real failure forever. On
  // "queuedOffline", persist the current draft fields as the queued
  // generation request.
  useEffect(() => {
    if (isPending) {
      wasPendingRef.current = true;
      return;
    }
    if (!wasPendingRef.current) return;
    wasPendingRef.current = false;
    retryInFlightRef.current = false;

    if (!hasSubmittedRef.current) return;

    if (state.queuedOffline) {
      const next = {
        customerId: draftRef.current.customerId,
        description: draftRef.current.description,
        attempts: queued ? queued.attempts + 1 : 0,
      };
      enqueueGeneration(next);
      return;
    }

    if (state.error) {
      clearQueuedGenerationStore();
      return;
    }

    // Success: the server action redirects, but clear local state too in
    // case the redirect hasn't taken effect yet.
    clearDraft(window.localStorage);
    clearQueuedGenerationStore();
    draftRef.current = { customerId: "", description: "" };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, state.error, state.queuedOffline]);

  // Once back online, automatically retry a queued generation request --
  // capped at MAX_AUTO_RETRY_ATTEMPTS to avoid hammering the server during a
  // persistent connectivity flap.
  useEffect(() => {
    if (retryInFlightRef.current) return;
    if (!shouldAutoRetry({ isOnline, isPending, queued })) {
      return;
    }
    retryInFlightRef.current = true;
    hasSubmittedRef.current = true;
    const fd = new FormData();
    fd.set("customerId", queued!.customerId);
    fd.set("description", queued!.description);
    formAction(fd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, isPending, queued]);

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

  const isQueued = queued !== null && !isPending;

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col gap-6 px-4 py-10 sm:px-8">
      <h1 className="text-center text-2xl font-semibold text-[#0f172a]">Neues Angebot</h1>
      {!isOnline && !isQueued && (
        <div
          role="status"
          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800"
        >
          Du bist offline — Änderungen werden lokal gespeichert. Beim Erstellen wird das Angebot
          automatisch generiert, sobald du wieder online bist.
        </div>
      )}
      {isQueued && !autoRetryExhausted && (
        <div
          role="status"
          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800"
        >
          Wird gesendet, sobald du wieder online bist — das Angebot wird automatisch erstellt.
        </div>
      )}
      {isQueued && autoRetryExhausted && (
        <div
          role="status"
          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800"
        >
          Die automatische Übertragung hat mehrfach nicht geklappt. Bitte sende das Angebot manuell
          erneut ab.
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
          disabled={isPending}
          className="self-center rounded-full bg-[#2563eb] px-6 py-3 text-sm font-medium text-white shadow-[0_6px_16px_rgba(37,99,235,0.3)] transition hover:not-disabled:bg-[#1d4ed8] disabled:opacity-50"
        >
          {isPending
            ? "Angebot wird erstellt…"
            : !isOnline
              ? "Für später vormerken"
              : "Angebot erstellen"}
        </button>
      </form>
    </div>
  );
}
