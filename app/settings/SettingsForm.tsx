"use client";

import { useState, useTransition } from "react";
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
      <h1 className="text-2xl font-semibold">Unternehmensdaten</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && !error && <p className="text-sm text-green-600">Gespeichert.</p>}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Firmenname
          <input
            value={companyName}
            onChange={(e) => {
              setCompanyName(e.target.value);
              setSaved(false);
            }}
            className="rounded-md border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Adresse
          <textarea
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              setSaved(false);
            }}
            rows={3}
            className="rounded-md border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          USt-IdNr.
          <input
            value={vatId}
            onChange={(e) => {
              setVatId(e.target.value);
              setSaved(false);
            }}
            className="rounded-md border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Steuernummer
          <input
            value={taxNumber}
            onChange={(e) => {
              setTaxNumber(e.target.value);
              setSaved(false);
            }}
            className="rounded-md border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="self-start rounded-full bg-foreground px-5 py-3 text-background disabled:opacity-50"
        >
          Speichern
        </button>
      </form>
    </div>
  );
}
