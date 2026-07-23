"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { normalizeTotpCode } from "@/lib/mfa/totpCode";

type EnrolledFactor = {
  factorId: string;
  friendlyName: string | null;
};

type EnrollmentDraft = {
  factorId: string;
  qrCodeSvg: string;
  secret: string;
};

export function SecuritySettingsForm({ enrolled }: { enrolled: EnrolledFactor | null }) {
  const router = useRouter();
  const supabase = createClient();

  const [factor, setFactor] = useState<EnrolledFactor | null>(enrolled);
  const [draft, setDraft] = useState<EnrollmentDraft | null>(null);
  const [showDisableForm, setShowDisableForm] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function startEnrollment() {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      // Clean up any abandoned (unverified) enrollment first -- Supabase
      // rejects a new TOTP enroll while one is already pending for this user.
      const { data: existing } = await supabase.auth.mfa.listFactors();
      const pending = existing?.totp?.find((f) => f.status !== "verified");
      if (pending) {
        await supabase.auth.mfa.unenroll({ factorId: pending.id });
      }

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        issuer: "Hantverkare",
      });
      if (enrollError || !data) {
        console.error("MFA enroll failed:", enrollError);
        setError("Einrichtung fehlgeschlagen. Bitte versuche es erneut.");
        return;
      }
      setDraft({
        factorId: data.id,
        qrCodeSvg: data.totp.qr_code,
        secret: data.totp.secret,
      });
    });
  }

  function confirmEnrollment(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const normalized = normalizeTotpCode(code);
    if (!normalized || !draft) {
      setError("Bitte gib den 6-stelligen Code aus deiner Authenticator-App ein.");
      return;
    }
    startTransition(async () => {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: draft.factorId,
        code: normalized,
      });
      if (verifyError) {
        console.error("MFA verify failed:", verifyError);
        setError("Code ungültig oder abgelaufen. Bitte erneut versuchen.");
        return;
      }
      setFactor({ factorId: draft.factorId, friendlyName: null });
      setDraft(null);
      setCode("");
      setInfo("Zwei-Faktor-Authentifizierung ist jetzt aktiv.");
      router.refresh();
    });
  }

  function cancelEnrollment() {
    if (!draft) return;
    startTransition(async () => {
      await supabase.auth.mfa.unenroll({ factorId: draft.factorId });
      setDraft(null);
      setCode("");
      setError(null);
    });
  }

  function confirmDisable(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const normalized = normalizeTotpCode(code);
    if (!normalized || !factor) {
      setError("Bitte gib den 6-stelligen Code aus deiner Authenticator-App ein.");
      return;
    }
    startTransition(async () => {
      // Require proof of possession of the current TOTP code before
      // disabling -- a stolen session token alone must not be able to
      // silently turn off 2FA.
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: factor.factorId,
        code: normalized,
      });
      if (verifyError) {
        console.error("MFA verify (disable) failed:", verifyError);
        setError("Code ungültig oder abgelaufen. Bitte erneut versuchen.");
        return;
      }
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId: factor.factorId,
      });
      if (unenrollError) {
        console.error("MFA unenroll failed:", unenrollError);
        setError("Deaktivierung fehlgeschlagen. Bitte versuche es erneut.");
        return;
      }
      setFactor(null);
      setShowDisableForm(false);
      setCode("");
      setInfo("Zwei-Faktor-Authentifizierung wurde deaktiviert.");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 p-6 sm:p-8">
      <h1 className="text-2xl font-semibold text-[#0f172a]">Sicherheit</h1>
      <div className="rounded-2xl border border-[#e9edf2] bg-white p-6">
        <h2 className="text-base font-semibold text-[#0f172a]">Zwei-Faktor-Authentifizierung</h2>
        <p className="mt-1 text-sm text-[#64748b]">
          Schütze dein Konto zusätzlich mit einem Code aus einer Authenticator-App (z. B. Google
          Authenticator, 1Password).
        </p>

        {info && <p className="mt-4 text-sm text-[#16a34a]">{info}</p>}
        {error && <p className="mt-4 text-sm text-[#dc2626]">{error}</p>}

        {factor && !showDisableForm && (
          <div className="mt-4 flex items-center justify-between rounded-xl bg-[#f0fdf4] p-4">
            <span className="text-sm font-medium text-[#166534]">2FA ist aktiv</span>
            <button
              type="button"
              onClick={() => setShowDisableForm(true)}
              className="text-sm font-medium text-[#dc2626] underline"
            >
              Deaktivieren
            </button>
          </div>
        )}

        {factor && showDisableForm && (
          <form onSubmit={confirmDisable} className="mt-4 flex flex-col gap-3">
            <p className="text-sm text-[#0f172a]">
              Gib zur Bestätigung einen aktuellen Code aus deiner Authenticator-App ein, um 2FA zu
              deaktivieren.
            </p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              maxLength={7}
              className="w-40 rounded-xl border border-[#e9edf2] p-2.5 text-sm outline-none focus:border-[#2563eb]"
            />
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-full bg-[#dc2626] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                Bestätigen & deaktivieren
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDisableForm(false);
                  setCode("");
                  setError(null);
                }}
                className="rounded-full px-5 py-2.5 text-sm font-medium text-[#64748b]"
              >
                Abbrechen
              </button>
            </div>
          </form>
        )}

        {!factor && !draft && (
          <button
            type="button"
            onClick={startEnrollment}
            disabled={isPending}
            className="mt-4 rounded-full bg-[#2563eb] px-5 py-2.5 text-sm font-medium text-white shadow-[0_6px_16px_rgba(37,99,235,0.3)] transition-colors hover:bg-[#1d4ed8] disabled:opacity-50"
          >
            {isPending ? "Wird eingerichtet…" : "Aktivieren"}
          </button>
        )}

        {!factor && draft && (
          <form onSubmit={confirmEnrollment} className="mt-4 flex flex-col gap-4">
            <p className="text-sm text-[#0f172a]">
              Scanne den QR-Code mit deiner Authenticator-App und gib den angezeigten Code ein.
            </p>
            <div
              className="h-48 w-48 self-center"
              // Supabase returns an inline SVG string for the QR code.
              dangerouslySetInnerHTML={{ __html: draft.qrCodeSvg }}
            />
            <p className="text-xs text-[#64748b]">
              Kein Scanner zur Hand? Gib diesen Schlüssel manuell ein:{" "}
              <code className="rounded bg-[#f4f6f8] px-1.5 py-0.5">{draft.secret}</code>
            </p>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-[#0f172a]">
              Bestätigungscode
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                maxLength={7}
                className="w-40 rounded-xl border border-[#e9edf2] p-2.5 text-sm font-normal outline-none focus:border-[#2563eb]"
              />
            </label>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-full bg-[#2563eb] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                Bestätigen
              </button>
              <button
                type="button"
                onClick={cancelEnrollment}
                disabled={isPending}
                className="rounded-full px-5 py-2.5 text-sm font-medium text-[#64748b]"
              >
                Abbrechen
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
