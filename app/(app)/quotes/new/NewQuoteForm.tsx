"use client";

import { useActionState, useRef } from "react";
import { generateQuoteDraft, type GenerateQuoteState } from "./actions";
import { VoiceRecorder } from "./VoiceRecorder";

const initialState: GenerateQuoteState = { error: null };

type Customer = {
  id: string;
  name: string;
};

export default function NewQuoteForm({ customers }: { customers: Customer[] }) {
  const [state, formAction, isPending] = useActionState(generateQuoteDraft, initialState);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleTranscript(text: string) {
    if (textareaRef.current) {
      textareaRef.current.value = text;
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col gap-6 px-4 py-10 sm:px-8">
      <h1 className="text-center text-2xl font-semibold text-[#0f172a]">Neues Angebot</h1>
      <form
        action={formAction}
        className="flex flex-col gap-5 rounded-2xl border border-[#e9edf2] bg-white p-6 shadow-sm sm:p-8"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="customerId" className="text-sm font-medium text-[#0f172a]">
            Kunde
          </label>
          <select
            id="customerId"
            name="customerId"
            defaultValue=""
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
          {isPending ? "Angebot wird erstellt…" : "Angebot erstellen"}
        </button>
      </form>
    </div>
  );
}
