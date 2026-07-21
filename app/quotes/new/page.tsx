"use client";

import { useActionState, useRef } from "react";
import { generateQuoteDraft, type GenerateQuoteState } from "./actions";
import { VoiceRecorder } from "./VoiceRecorder";

const initialState: GenerateQuoteState = { error: null };

export default function NewQuotePage() {
  const [state, formAction, isPending] = useActionState(generateQuoteDraft, initialState);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleTranscript(text: string) {
    if (textareaRef.current) {
      textareaRef.current.value = text;
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">Neues Angebot</h1>
      <form action={formAction} className="flex flex-col gap-4">
        <label htmlFor="description" className="text-sm font-medium">
          Auftragsbeschreibung
        </label>
        <textarea
          ref={textareaRef}
          id="description"
          name="description"
          required
          rows={6}
          maxLength={2000}
          placeholder="Beschreibe den Auftrag, z. B. Küchenspüle austauschen, neuen Wasserhahn montieren, 2 Stunden Arbeit"
          className="w-full rounded-md border border-zinc-300 p-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
        <VoiceRecorder onTranscript={handleTranscript} />
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={isPending}
          className="self-start rounded-full bg-foreground px-5 py-3 text-background disabled:opacity-50"
        >
          {isPending ? "Angebot wird erstellt…" : "Angebot erstellen"}
        </button>
      </form>
    </div>
  );
}
