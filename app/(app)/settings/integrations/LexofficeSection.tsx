"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { connectLexoffice, disconnectLexoffice, setLexofficeSyncEnabled } from "./actions";

export function LexofficeSection({
  isConnected,
  syncEnabled,
}: {
  isConnected: boolean;
  syncEnabled: boolean;
}) {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [connected, setConnected] = useState(isConnected);
  const [syncOn, setSyncOn] = useState(syncEnabled);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConnect() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await connectLexoffice(apiKey);
      if (result.error) {
        setError(result.error);
        return;
      }
      setApiKey("");
      setConnected(true);
      setNotice("Verbunden.");
      router.refresh();
    });
  }

  function handleDisconnect() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await disconnectLexoffice();
      if (result.error) {
        setError(result.error);
        return;
      }
      setConnected(false);
      setSyncOn(false);
      setNotice("Verbindung getrennt.");
      router.refresh();
    });
  }

  function handleToggleSync() {
    const next = !syncOn;
    setSyncOn(next);
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await setLexofficeSyncEnabled(next);
      if (result.error) {
        setSyncOn(!next);
        setError(result.error);
        return;
      }
      setNotice("Gespeichert.");
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-[#e9edf2] bg-white p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#0f172a]">lexoffice</h2>
        <span
          className={
            connected
              ? "rounded-full bg-[#dcfce7] px-3 py-1 text-xs font-semibold text-[#166534]"
              : "rounded-full bg-[#f1f5f9] px-3 py-1 text-xs font-semibold text-[#64748b]"
          }
        >
          {connected ? "Verbunden" : "Nicht verbunden"}
        </span>
      </div>

      <p className="mt-1.5 text-sm text-[#64748b]">
        Erzeuge einen öffentlichen API-Schlüssel in deinem lexoffice-Konto unter
        Einstellungen → Schnittstellen (API) und füge ihn hier ein. Der
        Schlüssel wird ausschließlich serverseitig gespeichert und niemals im
        Browser angezeigt.
      </p>

      {!connected && (
        <div className="mt-4 flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[#0f172a]" htmlFor="lexoffice-api-key">
            API-Schlüssel
          </label>
          <input
            id="lexoffice-api-key"
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="z. B. 4d1b2c3a-..."
            className="rounded-xl border border-[#e2e8f0] p-2.5 text-sm outline-none focus:border-[#2563eb]"
          />
          <button
            type="button"
            onClick={handleConnect}
            disabled={isPending || apiKey.trim().length === 0}
            className="mt-2 self-start rounded-xl bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:bg-[#93c5fd]"
          >
            {isPending ? "Wird geprüft…" : "Verbinden"}
          </button>
        </div>
      )}

      {connected && (
        <div className="mt-4 flex flex-col gap-4">
          <label className="flex items-center gap-2.5 text-sm font-medium text-[#0f172a]">
            <input
              type="checkbox"
              checked={syncOn}
              onChange={handleToggleSync}
              disabled={isPending}
              className="h-4 w-4 rounded border-[#cbd5e1]"
            />
            Neue Rechnungen automatisch an lexoffice übertragen
          </label>

          <button
            type="button"
            onClick={handleDisconnect}
            disabled={isPending}
            className="self-start rounded-xl border border-[#e2e8f0] px-4 py-2.5 text-sm font-semibold text-[#0f172a] hover:bg-[#f8fafc] disabled:cursor-not-allowed"
          >
            Verbindung trennen
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-[#dc2626]">{error}</p>}
      {notice && <p className="mt-3 text-sm text-[#166534]">{notice}</p>}
    </div>
  );
}
