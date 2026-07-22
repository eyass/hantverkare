"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { saveBusinessSettings } from "./actions";

type BusinessSettings = {
  company_name: string | null;
  address: string | null;
  vat_id: string | null;
  tax_number: string | null;
};

export function SettingsForm({
  initialSettings,
}: {
  initialSettings: BusinessSettings | null;
}) {
  const [companyName, setCompanyName] = useState(initialSettings?.company_name ?? "");
  const [address, setAddress] = useState(initialSettings?.address ?? "");
  const [vatId, setVatId] = useState(initialSettings?.vat_id ?? "");
  const [taxNumber, setTaxNumber] = useState(initialSettings?.tax_number ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveBusinessSettings({
        companyName,
        address,
        vatId,
        taxNumber,
      });
      if (result.error !== null) {
        setError(result.error);
        setSaved(false);
        return;
      }
      setError(null);
      setSaved(true);
    });
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold text-[#0f172a]">Unternehmensdaten</h1>
      <div className="rounded-2xl border border-[#e9edf2] bg-white p-6">
        {error && <p className="mb-4 text-sm text-[#dc2626]">{error}</p>}
        {saved && !error && <p className="mb-4 text-sm text-[#16a34a]">Gespeichert.</p>}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-[#0f172a]">
            Firmenname
            <input
              value={companyName}
              onChange={(e) => {
                setCompanyName(e.target.value);
                setSaved(false);
              }}
              className="rounded-xl border border-[#e9edf2] p-2.5 text-sm font-normal text-[#0f172a] outline-none focus:border-[#2563eb]"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-[#0f172a]">
            Adresse
            <textarea
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                setSaved(false);
              }}
              rows={3}
              className="rounded-xl border border-[#e9edf2] p-2.5 text-sm font-normal text-[#0f172a] outline-none focus:border-[#2563eb]"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-[#0f172a]">
            USt-IdNr.
            <input
              value={vatId}
              onChange={(e) => {
                setVatId(e.target.value);
                setSaved(false);
              }}
              className="rounded-xl border border-[#e9edf2] p-2.5 text-sm font-normal text-[#0f172a] outline-none focus:border-[#2563eb]"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-[#0f172a]">
            Steuernummer
            <input
              value={taxNumber}
              onChange={(e) => {
                setTaxNumber(e.target.value);
                setSaved(false);
              }}
              className="rounded-xl border border-[#e9edf2] p-2.5 text-sm font-normal text-[#0f172a] outline-none focus:border-[#2563eb]"
            />
          </label>
          <button
            type="submit"
            disabled={isPending}
            className="mt-2 self-start rounded-full bg-[#2563eb] px-5 py-2.5 text-sm font-medium text-white shadow-[0_6px_16px_rgba(37,99,235,0.3)] transition-colors hover:bg-[#1d4ed8] disabled:opacity-50"
          >
            Speichern
          </button>
        </form>
      </div>
      <div className="rounded-2xl border border-[#e9edf2] bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#0f172a]">Sicherheit</h2>
            <p className="mt-1 text-sm text-[#64748b]">
              Zwei-Faktor-Authentifizierung einrichten oder verwalten.
            </p>
          </div>
          <Link
            href="/settings/security"
            className="rounded-full border border-[#e9edf2] px-4 py-2 text-sm font-medium text-[#0f172a] hover:bg-[#f4f6f8]"
          >
            Verwalten
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-[#e9edf2] bg-white p-6">
        <h2 className="text-base font-semibold text-[#0f172a]">Meine Daten</h2>
        <p className="mt-1.5 text-sm text-[#64748b]">
          Lade eine vollständige Kopie aller Angebote, Kunden, Rechnungen und
          Preislisten deiner Organisation herunter (Art. 15 DSGVO).
        </p>
        <a
          href="/settings/export"
          className="mt-4 inline-block rounded-xl border border-[#e9edf2] px-4 py-2.5 text-sm font-semibold text-[#0f172a] hover:bg-[#f4f6f8]"
        >
          Daten exportieren
        </a>
      </div>
    </div>
  );
}
