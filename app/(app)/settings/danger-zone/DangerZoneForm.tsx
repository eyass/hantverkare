"use client";

import { useState, useTransition } from "react";
import { confirmationMatches } from "@/lib/gdpr/confirmDeletion";
import { deleteOrganization } from "./actions";

export function DangerZoneForm({ organizationName }: { organizationName: string }) {
  const [confirmationText, setConfirmationText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canSubmit =
    organizationName.length > 0 && confirmationMatches(organizationName, confirmationText);

  function handleDelete() {
    if (!canSubmit || isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteOrganization(confirmationText);
      // A successful delete redirects server-side (throws NEXT_REDIRECT), so
      // reaching this line means it failed.
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 p-6 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold text-[#0f172a]">Danger Zone</h1>
        <p className="mt-1 text-sm text-[#64748b]">
          Konto- und Datenverwaltung gemäß DSGVO (Art. 15 &amp; 17).
        </p>
      </div>

      <div className="rounded-2xl border border-[#e9edf2] bg-white p-6">
        <h2 className="text-base font-semibold text-[#0f172a]">Alle Daten exportieren</h2>
        <p className="mt-1.5 text-sm text-[#64748b]">
          Lade eine vollständige Kopie aller Angebote, Kunden, Rechnungen und
          Preislisten deiner Organisation als JSON-Datei herunter (Art. 15 DSGVO).
        </p>
        <a
          href="/settings/export"
          className="mt-4 inline-block rounded-xl bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1d4ed8]"
        >
          Daten exportieren
        </a>
      </div>

      <div className="rounded-2xl border border-[#fecaca] bg-[#fef2f2] p-6">
        <h2 className="text-base font-semibold text-[#991b1b]">Organisation löschen</h2>
        <p className="mt-1.5 text-sm text-[#991b1b]">
          Diese Aktion löscht die Organisation <strong>„{organizationName}“</strong>{" "}
          und ALLE zugehörigen Daten unwiderruflich: Angebote, Kunden, Rechnungen,
          Preislisten, Unternehmensdaten und alle Team-Mitgliedschaften. Falls du
          keiner weiteren Organisation angehörst, wird auch dein Benutzerkonto
          gelöscht.
        </p>
        <p className="mt-2 text-sm font-semibold text-[#991b1b]">
          Diese Aktion kann nicht rückgängig gemacht werden.
        </p>

        <label className="mt-4 flex flex-col gap-1.5 text-sm font-medium text-[#991b1b]">
          Gib zur Bestätigung „{organizationName}“ ein
          <input
            value={confirmationText}
            onChange={(e) => setConfirmationText(e.target.value)}
            placeholder={organizationName}
            className="rounded-xl border border-[#fca5a5] bg-white p-2.5 text-sm font-normal text-[#0f172a] outline-none focus:border-[#dc2626]"
          />
        </label>

        {error && <p className="mt-3 text-sm text-[#dc2626]">{error}</p>}

        <button
          type="button"
          onClick={handleDelete}
          disabled={!canSubmit || isPending}
          className="mt-4 rounded-xl bg-[#dc2626] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#b91c1c] disabled:cursor-not-allowed disabled:bg-[#fca5a5]"
        >
          {isPending ? "Wird gelöscht…" : "Organisation endgültig löschen"}
        </button>
      </div>
    </div>
  );
}
