"use client";

import { useTransition } from "react";
import { startConnectOnboarding } from "./actions";

export function PaymentsSettingsForm({
  hasAccount,
  onboarded,
}: {
  hasAccount: boolean;
  onboarded: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function handleConnect() {
    startTransition(async () => {
      await startConnectOnboarding();
    });
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="rounded-2xl border border-[#e9edf2] bg-white p-6">
        <h1 className="text-lg font-semibold text-[#0f172a]">Online-Zahlungen</h1>
        <p className="mt-1.5 text-sm text-[#64748b]">
          Verbinde ein Stripe-Konto, damit deine Kunden Rechnungen direkt online bezahlen können.
          Zahlungen gehen direkt an dein eigenes Stripe-Konto -- hantverkare hat zu keinem
          Zeitpunkt Zugriff auf das Geld deiner Kunden.
        </p>

        <div className="mt-5 flex items-center gap-3">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              onboarded
                ? "bg-[#dcfce7] text-[#16a34a]"
                : hasAccount
                  ? "bg-[#fef9c3] text-[#a16207]"
                  : "bg-[#f1f5f9] text-[#64748b]"
            }`}
          >
            {onboarded ? "Verbunden" : hasAccount ? "Einrichtung unvollständig" : "Nicht verbunden"}
          </span>
        </div>

        {!onboarded && (
          <button
            onClick={handleConnect}
            disabled={isPending}
            className="mt-5 rounded-full bg-[#635bff] px-5 py-2.5 text-sm font-medium text-white shadow-[0_6px_16px_rgba(99,91,255,0.3)] transition-colors hover:bg-[#4f46e5] disabled:opacity-50"
          >
            {isPending ? "Wird geöffnet…" : hasAccount ? "Einrichtung fortsetzen" : "Stripe verbinden"}
          </button>
        )}
      </div>
    </div>
  );
}
