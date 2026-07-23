"use client";

// Google Calendar integration section (issue #166): connect/disconnect via
// OAuth and pick which calendar scheduled jobs sync to. The OAuth flow itself
// runs through plain <a> navigation to the Route Handlers (not a Server
// Action) since it needs to redirect the whole browser to Google's consent
// screen, not just make a fetch call.

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { disconnectGoogleCalendar, updateGoogleCalendarId } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  not_configured:
    "Die Google-Kalender-Integration ist noch nicht eingerichtet (fehlende Umgebungsvariablen).",
  google_declined: "Die Verbindung wurde abgebrochen.",
  invalid_callback: "Ungültige Antwort von Google.",
  invalid_state: "Sicherheitsprüfung fehlgeschlagen. Bitte erneut versuchen.",
  org_mismatch: "Die Organisation stimmt nicht überein. Bitte erneut versuchen.",
  token_exchange_failed: "Verbindung mit Google fehlgeschlagen. Bitte erneut versuchen.",
  save_failed: "Verbindung konnte nicht gespeichert werden.",
  not_signed_in: "Bitte melde dich an.",
};

export function GoogleCalendarSection({
  isConfigured,
  isConnected,
  calendarId,
}: {
  isConfigured: boolean;
  isConnected: boolean;
  calendarId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Derived directly from the URL on render (not via a setState-in-effect,
  // which would cause an extra cascading render) -- the query param IS the
  // source of truth for this one-time callback notice/error.
  const queryNotice = searchParams.get("connected") ? "Google Kalender verbunden." : null;
  const queryErrorCode = searchParams.get("error");
  const queryError = queryErrorCode
    ? (ERROR_MESSAGES[queryErrorCode] ?? "Verbindung fehlgeschlagen.")
    : null;

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [calId, setCalId] = useState(calendarId);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    // Strip the one-time query params from the URL so a page refresh doesn't
    // re-show the same notice/error. Navigation is exactly the kind of
    // "external system" side effect useEffect is for.
    if (queryNotice || queryError) {
      router.replace("/settings/integrations");
    }
    // Only re-run when the query string actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function handleDisconnect() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await disconnectGoogleCalendar();
      if (result.error) {
        setError(result.error);
        return;
      }
      setNotice("Verbindung getrennt.");
      router.refresh();
    });
  }

  function handleSaveCalendarId() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await updateGoogleCalendarId(calId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setNotice("Gespeichert.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {(notice || queryNotice) && (
        <p className="text-sm text-[#16a34a]">{notice ?? queryNotice}</p>
      )}
      {(error || queryError) && <p className="text-sm text-[#dc2626]">{error ?? queryError}</p>}

      <div className="flex flex-col gap-3 rounded-2xl border border-[#e9edf2] bg-white p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#0f172a]">Google Kalender</h2>
            <p className="mt-1.5 text-sm text-[#64748b]">
              {isConnected
                ? "Verbunden. Geplante Aufträge werden automatisch synchronisiert (Termin planen, ändern, stornieren)."
                : "Noch nicht verbunden. Ein-Weg-Sync: Änderungen in der App werden nach Google übertragen, nicht umgekehrt."}
            </p>
          </div>
          {isConnected ? (
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={isPending}
              className="shrink-0 rounded-xl border border-[#e2e8f0] px-4 py-2.5 text-sm font-semibold text-[#0f172a] hover:bg-[#f8fafc] disabled:cursor-not-allowed"
            >
              Trennen
            </button>
          ) : (
            <a
              href="/api/integrations/google-calendar/connect"
              aria-disabled={!isConfigured}
              className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold text-white ${
                isConfigured
                  ? "bg-[#2563eb] hover:bg-[#1d4ed8]"
                  : "pointer-events-none bg-[#93c5fd]"
              }`}
            >
              Mit Google verbinden
            </a>
          )}
        </div>

        {!isConfigured && (
          <p className="text-xs text-[#dc2626]">
            GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET sind noch nicht gesetzt (siehe
            .env.example) -- ein Administrator muss die Integration zuerst in der
            Google Cloud Console einrichten.
          </p>
        )}

        {isConnected && (
          <div className="flex flex-col gap-2 border-t border-[#e2e8f0] pt-3">
            <label className="text-xs font-medium text-[#0f172a]" htmlFor="google-calendar-id">
              Kalender-ID
            </label>
            <div className="flex gap-2">
              <input
                id="google-calendar-id"
                type="text"
                value={calId}
                onChange={(e) => setCalId(e.target.value)}
                placeholder="primary"
                className="w-full rounded-xl border border-[#e2e8f0] px-3 py-2.5 text-sm outline-none focus:border-[#2563eb]"
              />
              <button
                type="button"
                onClick={handleSaveCalendarId}
                disabled={isPending}
                className="shrink-0 rounded-xl border border-[#e2e8f0] bg-white px-4 py-2.5 text-sm font-semibold text-[#0f172a] hover:bg-[#f8fafc] disabled:cursor-not-allowed"
              >
                Speichern
              </button>
            </div>
            <p className="text-xs text-[#64748b]">
              Standardmäßig &quot;primary&quot; (dein Hauptkalender). Nur ändern, wenn Aufträge
              in einem anderen Google-Kalender erscheinen sollen.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
