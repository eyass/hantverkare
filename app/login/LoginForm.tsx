"use client";

import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";

export function LoginForm({
  initialError,
  next,
}: {
  initialError: string | null;
  next: string | null;
}) {
  const initialState: LoginState = { error: initialError, sent: false };
  const [state, formAction, isPending] = useActionState(sendMagicLink, initialState);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">Anmelden</h1>
      {state.sent ? (
        <p role="status" aria-live="polite" className="text-sm text-zinc-600 dark:text-zinc-400">
          Wir haben dir einen Anmeldelink per E-Mail geschickt. Bitte prüfe dein Postfach.
        </p>
      ) : (
        <form action={formAction} className="flex flex-col gap-4">
          {next && <input type="hidden" name="next" value={next} />}
          <label htmlFor="email" className="text-sm font-medium">
            E-Mail-Adresse
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            disabled={isPending}
            placeholder="du@beispiel.de"
            className="w-full rounded-md border border-zinc-300 p-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
          />
          {state.error && (
            <p role="alert" aria-live="polite" className="text-sm text-red-600">
              {state.error}
            </p>
          )}
          <button
            type="submit"
            disabled={isPending}
            className="self-start rounded-full bg-foreground px-5 py-3 text-background disabled:opacity-50"
          >
            {isPending ? "Wird gesendet…" : "Anmeldelink senden"}
          </button>
        </form>
      )}
    </div>
  );
}
