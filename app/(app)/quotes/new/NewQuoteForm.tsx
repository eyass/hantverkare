"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { generateQuoteDraft, type GenerateQuoteState } from "./actions";
import { VoiceRecorder, type RecordedNote } from "./VoiceRecorder";
import { useOnlineStatus } from "@/lib/hooks/useOnlineStatus";
import { clearDraft, loadDraft, saveDraft, type QuoteDraft } from "@/lib/quotes/draftStorage";
import { MAX_AUTO_RETRY_ATTEMPTS, shouldAutoRetry } from "@/lib/quotes/generationQueue";
import { isNextRedirectError } from "@/lib/quotes/offlineNetworkError";
import {
  clearQueuedGenerationStore,
  enqueueGeneration,
  useQueuedGeneration,
} from "@/lib/hooks/useQueuedGeneration";

const initialState: GenerateQuoteState = { error: null, queuedOffline: false };

/**
 * Wraps the real generateQuoteDraft server action so a submission made
 * while the device is already offline (detected *before* the action is
 * ever invoked) is queued for automatic retry instead of failing. This is
 * the only case that's safe to auto-queue: the request never reached the
 * server, so there is no risk of a duplicate quote.
 *
 * Deliberately NOT auto-queued: a network error thrown *during* or *after*
 * an actual invocation of `generateQuoteDraft`. That action performs its DB
 * inserts and only then calls `redirect()` -- if the connection drops after
 * the insert has committed but before the client receives the response,
 * the client sees what looks like a network error, but the server may well
 * have already created the quote. Silently queuing that for auto-retry
 * risks creating a second, duplicate quote with no user awareness. So once
 * the action has actually been called, any failure (network-shaped or not)
 * surfaces as a normal, visible error via `state.error` -- the user decides
 * consciously whether to retry, same as any other failed submission.
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
    if (isNextRedirectError(err)) {
      throw err;
    }
    return {
      error:
        "Das Angebot konnte nicht gesendet werden -- möglicherweise wurde es bereits erstellt, möglicherweise nicht. Bitte prüfe deine Angebotsliste und sende es bei Bedarf manuell erneut ab.",
      queuedOffline: false,
    };
  }
}

type Customer = {
  id: string;
  name: string;
};

type VoiceNote = {
  id: string;
  text: string;
  audioUrl: string;
};

let noteIdCounter = 0;
function nextNoteId(): string {
  noteIdCounter += 1;
  return `note-${noteIdCounter}`;
}

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
  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const notesRef = useRef<VoiceNote[]>([]);
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
    notesRef.current.forEach((note) => URL.revokeObjectURL(note.audioUrl));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNotes([]);
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

  // Keep a ref mirror of notes (for unmount cleanup) and revoke every note's
  // object URL on unmount to avoid leaking blob memory.
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);
  useEffect(() => {
    return () => {
      notesRef.current.forEach((note) => URL.revokeObjectURL(note.audioUrl));
    };
  }, []);

  function applyDescription(nextNotes: VoiceNote[]) {
    const combined = nextNotes.map((note) => note.text).join("\n\n");
    if (textareaRef.current) {
      textareaRef.current.value = combined;
    }
    persistDraft({ description: combined });
  }

  function handleNoteRecorded(note: RecordedNote) {
    setNotes((prev) => {
      const next = [...prev, { id: nextNoteId(), ...note }];
      applyDescription(next);
      return next;
    });
  }

  function handleDeleteNote(id: string) {
    setNotes((prev) => {
      const removed = prev.find((note) => note.id === id);
      if (removed) URL.revokeObjectURL(removed.audioUrl);
      const next = prev.filter((note) => note.id !== id);
      applyDescription(next);
      return next;
    });
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
        <VoiceRecorder onNoteRecorded={handleNoteRecorded} hasNotes={notes.length > 0} />
        {notes.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-[#0f172a]">
              Sprachnotizen ({notes.length})
            </span>
            <ul className="flex flex-col gap-2">
              {notes.map((note, i) => (
                <li
                  key={note.id}
                  className="flex items-center gap-3 rounded-xl border border-[#e9edf2] bg-[#f8fafc] p-3"
                >
                  <span className="text-sm font-semibold text-[#64748b]">{i + 1}</span>
                  <audio controls src={note.audioUrl} className="h-9 flex-1" />
                  <button
                    type="button"
                    onClick={() => handleDeleteNote(note.id)}
                    aria-label={`Notiz ${i + 1} löschen`}
                    className="rounded-full p-1.5 text-[#94a3b8] transition hover:bg-red-50 hover:text-red-600"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      className="h-4 w-4"
                      aria-hidden="true"
                    >
                      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
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
