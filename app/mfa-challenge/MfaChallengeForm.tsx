"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { normalizeTotpCode } from "@/lib/mfa/totpCode";

export function MfaChallengeForm({ next }: { next: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const normalized = normalizeTotpCode(code);
    if (!normalized) {
      setError("Bitte gib den 6-stelligen Code aus deiner Authenticator-App ein.");
      return;
    }
    startTransition(async () => {
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      const factorId = factors?.totp?.find((f) => f.status === "verified")?.id;
      if (listError || !factorId) {
        console.error("Failed to resolve MFA factor:", listError);
        setError("2FA-Faktor konnte nicht gefunden werden. Bitte melde dich erneut an.");
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: normalized,
      });
      if (verifyError) {
        console.error("MFA challenge failed:", verifyError);
        setError("Code ungültig oder abgelaufen. Bitte erneut versuchen.");
        return;
      }

      // The server-side layout gate reads the session's AAL on the next
      // request, so a hard navigation (rather than a client-side route
      // change) is important here to make sure it re-evaluates with the
      // now-elevated session.
      router.refresh();
      router.push(next);
    });
  }

  function handleSignOut() {
    startTransition(async () => {
      await supabase.auth.signOut();
      router.push("/login");
    });
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">Zwei-Faktor-Authentifizierung</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Gib den 6-stelligen Code aus deiner Authenticator-App ein, um dich anzumelden.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label htmlFor="code" className="text-sm font-medium">
          Bestätigungscode
        </label>
        <input
          id="code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          disabled={isPending}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="123456"
          maxLength={7}
          className="w-full rounded-md border border-zinc-300 p-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
        {error && (
          <p role="alert" aria-live="polite" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="self-start rounded-full bg-foreground px-5 py-3 text-background disabled:opacity-50"
        >
          {isPending ? "Wird geprüft…" : "Bestätigen"}
        </button>
      </form>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={isPending}
        className="self-start text-sm text-zinc-500 underline"
      >
        Abmelden
      </button>
    </div>
  );
}
