"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  previewSupplierPriceUpdate,
  commitSupplierPriceUpdate,
  type SupplierPriceUpdatePreviewResult,
} from "../../actions";

type Step = "pick" | "preview" | "done";

function centsToEuroString(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function SupplierPriceUpdateForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("pick");
  const [csvText, setCsvText] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<
    Extract<SupplierPriceUpdatePreviewResult, { error: null }> | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ updated: number; created: number; unchanged: number } | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    setError(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setCsvText(text);
      startTransition(async () => {
        const result = await previewSupplierPriceUpdate(text);
        if (result.error !== null) {
          setError(result.error);
          setCsvText(null);
          return;
        }
        setPreview(result);
        setStep("preview");
      });
    };
    reader.onerror = () => {
      setError("Datei konnte nicht gelesen werden.");
    };
    reader.readAsText(file);
  }

  function handleConfirm() {
    if (!csvText) {
      return;
    }
    startTransition(async () => {
      const commitResult = await commitSupplierPriceUpdate(csvText);
      if (commitResult.error !== null) {
        setError(commitResult.error);
        return;
      }
      setError(null);
      setResult({
        updated: commitResult.updated,
        created: commitResult.created,
        unchanged: commitResult.unchanged,
      });
      setStep("done");
    });
  }

  function handleReset() {
    setStep("pick");
    setCsvText(null);
    setFileName(null);
    setPreview(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  const changedUpdates = preview?.diff.updates.filter((row) => row.changed) ?? [];
  const unchangedUpdates = preview?.diff.updates.filter((row) => !row.changed) ?? [];
  const creates = preview?.diff.creates ?? [];
  const hasAnyChange = changedUpdates.length > 0 || creates.length > 0;

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[#0f172a]">Lieferanten-Preisupdate</h1>
        <Link href="/price-list" className="text-sm font-medium text-[#2563eb] hover:text-[#1d4ed8]">
          Zurück zur Preisliste
        </Link>
      </div>

      {error && <p className="text-sm text-[#dc2626]">{error}</p>}

      {step === "pick" && (
        <div className="flex flex-col gap-3 rounded-2xl border border-[#e9edf2] bg-white p-6">
          <p className="text-sm text-[#64748b]">
            Lade den Preisexport deines Lieferanten hoch (gleiches Format wie der
            Preislisten-CSV-Import: <strong>Bezeichnung</strong>, <strong>Einheit</strong>,{" "}
            <strong>Preis</strong>, <strong>Kategorie</strong>). Anders als beim normalen Import
            werden die Preise nicht sofort übernommen -- du siehst zuerst eine Übersicht, welche
            Preise sich ändern würden, und entscheidest dann, ob du das Update anwendest.
          </p>
          <Link
            href="/price-list/import"
            className="text-xs font-medium text-[#2563eb] hover:text-[#1d4ed8]"
          >
            Stattdessen sofort importieren (ohne Vorschau-Vergleich) →
          </Link>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            disabled={isPending}
            className="text-sm text-[#0f172a]"
          />
          {isPending && <p className="text-sm text-[#64748b]">Datei wird geprüft…</p>}
        </div>
      )}

      {step === "preview" && preview && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-[#e9edf2] bg-white p-6">
            <h2 className="mb-2 text-lg font-medium text-[#0f172a]">Vorschau: {fileName}</h2>
            <p className="text-sm text-[#64748b]">
              {changedUpdates.length}{" "}
              {changedUpdates.length === 1 ? "Preis ändert sich" : "Preise ändern sich"},{" "}
              {unchangedUpdates.length} unverändert, {creates.length}{" "}
              {creates.length === 1 ? "neue Position" : "neue Positionen"}.
              {preview.errors.length > 0 &&
                ` ${preview.errors.length} ${
                  preview.errors.length === 1 ? "Zeile" : "Zeilen"
                } mit Fehlern werden übersprungen.`}
            </p>
          </div>

          {preview.errors.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-[#fecaca] bg-[#fef2f2]">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#fecaca] text-xs font-medium uppercase tracking-wide text-[#b91c1c]">
                    <th className="px-4 py-3">Zeile</th>
                    <th className="px-4 py-3">Fehler</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.errors.map((rowError) => (
                    <tr key={rowError.rowNumber} className="border-b border-[#fecaca] last:border-b-0">
                      <td className="px-4 py-2 font-mono text-[#b91c1c]">{rowError.rowNumber}</td>
                      <td className="px-4 py-2 text-[#7f1d1d]">{rowError.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {changedUpdates.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-[#fde68a] bg-[#fffbeb]">
              <div className="border-b border-[#fde68a] px-4 py-2 text-xs font-medium uppercase tracking-wide text-[#92400e]">
                Preisänderungen
              </div>
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#fde68a] text-xs font-medium uppercase tracking-wide text-[#92400e]">
                    <th className="px-4 py-3">Bezeichnung</th>
                    <th className="px-4 py-3">Alter Preis (EUR)</th>
                    <th className="px-4 py-3">Neuer Preis (EUR)</th>
                  </tr>
                </thead>
                <tbody>
                  {changedUpdates.map((row) => {
                    const delta = row.newUnitPriceCents - row.oldUnitPriceCents;
                    return (
                      <tr key={row.id} className="border-b border-[#fde68a] last:border-b-0">
                        <td className="px-4 py-2 text-[#0f172a]">{row.label}</td>
                        <td className="px-4 py-2 font-mono text-[#64748b] line-through">
                          {centsToEuroString(row.oldUnitPriceCents)}
                        </td>
                        <td className="px-4 py-2 font-mono text-[#0f172a]">
                          {centsToEuroString(row.newUnitPriceCents)}{" "}
                          <span className={delta > 0 ? "text-[#b91c1c]" : "text-[#15803d]"}>
                            ({delta > 0 ? "+" : ""}
                            {centsToEuroString(delta)})
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {creates.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-[#bbf7d0] bg-[#f0fdf4]">
              <div className="border-b border-[#bbf7d0] px-4 py-2 text-xs font-medium uppercase tracking-wide text-[#166534]">
                Neue Positionen
              </div>
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#bbf7d0] text-xs font-medium uppercase tracking-wide text-[#166534]">
                    <th className="px-4 py-3">Bezeichnung</th>
                    <th className="px-4 py-3">Einheit</th>
                    <th className="px-4 py-3">Preis (EUR)</th>
                    <th className="px-4 py-3">Kategorie</th>
                  </tr>
                </thead>
                <tbody>
                  {creates.map((row) => (
                    <tr key={row.rowNumber} className="border-b border-[#bbf7d0] last:border-b-0">
                      <td className="px-4 py-2 text-[#0f172a]">{row.label}</td>
                      <td className="px-4 py-2 text-[#0f172a]">{row.unit}</td>
                      <td className="px-4 py-2 font-mono text-[#0f172a]">
                        {centsToEuroString(row.unitPriceCents)}
                      </td>
                      <td className="px-4 py-2 text-[#0f172a]">{row.category}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {unchangedUpdates.length > 0 && (
            <p className="text-xs text-[#94a3b8]">
              {unchangedUpdates.length}{" "}
              {unchangedUpdates.length === 1
                ? "Position ist bereits auf dem gemeldeten Preis"
                : "Positionen sind bereits auf dem gemeldeten Preis"}{" "}
              und werden nicht verändert.
            </p>
          )}

          {!hasAnyChange && preview.errors.length === 0 && (
            <p className="text-sm text-[#64748b]">
              Keine Preisänderungen oder neuen Positionen gefunden -- es gibt nichts anzuwenden.
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={isPending || !hasAnyChange}
              className="self-start rounded-full bg-[#2563eb] px-5 py-2.5 text-sm font-medium text-white shadow-[0_6px_16px_rgba(37,99,235,0.3)] transition-colors hover:bg-[#1d4ed8] disabled:opacity-50"
            >
              {isPending ? "Wende Update an…" : "Update anwenden"}
            </button>
            <button
              onClick={handleReset}
              disabled={isPending}
              className="self-start rounded-full border border-[#e9edf2] bg-white px-5 py-2.5 text-sm font-medium text-[#0f172a] transition-colors hover:bg-[#f4f6f8] disabled:opacity-50"
            >
              Andere Datei wählen
            </button>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div className="flex flex-col gap-4 rounded-2xl border border-[#e9edf2] bg-white p-6">
          <p className="text-sm text-[#0f172a]">
            {result.updated} {result.updated === 1 ? "Preis wurde" : "Preise wurden"} aktualisiert,{" "}
            {result.created} {result.created === 1 ? "Position wurde" : "Positionen wurden"} neu
            angelegt und {result.unchanged}{" "}
            {result.unchanged === 1 ? "Position blieb" : "Positionen blieben"} unverändert.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => router.push("/price-list")}
              className="self-start rounded-full bg-[#2563eb] px-5 py-2.5 text-sm font-medium text-white shadow-[0_6px_16px_rgba(37,99,235,0.3)] transition-colors hover:bg-[#1d4ed8]"
            >
              Zur Preisliste
            </button>
            <button
              onClick={handleReset}
              className="self-start rounded-full border border-[#e9edf2] bg-white px-5 py-2.5 text-sm font-medium text-[#0f172a] transition-colors hover:bg-[#f4f6f8]"
            >
              Weitere Datei importieren
            </button>
          </div>
        </div>
      )}
    </>
  );
}
