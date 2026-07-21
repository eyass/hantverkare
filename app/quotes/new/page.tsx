"use client";

import { useActionState } from "react";
import { generateQuoteDraft, type GenerateQuoteState } from "./actions";

const initialState: GenerateQuoteState = { error: null };

export default function NewQuotePage() {
  const [state, formAction, isPending] = useActionState(generateQuoteDraft, initialState);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">Neues Angebot</h1>
      <form action={formAction} className="flex flex-col gap-4">
        <textarea
          name="description"
          required
          rows={6}
          placeholder="Beschreibe den Auftrag, z. B. Küchenspüle austauschen, neuen Wasserhahn montieren, 2 Stunden Arbeit"
          className="w-full rounded-md border border-zinc-300 p-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
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
