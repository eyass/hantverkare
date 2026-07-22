"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  previewCustomerImport,
  commitCustomerImport,
  type CustomerImportPreviewResult,
} from "../actions";

type Step = "pick" | "preview" | "done";

export function CustomerImportForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("pick");
  const [csvText, setCsvText] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<
    Extract<CustomerImportPreviewResult, { error: null }> | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState<number>(0);
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
        const result = await previewCustomerImport(text);
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
      const result = await commitCustomerImport(csvText);
      if (result.error !== null) {
        setError(result.error);
        return;
      }
      setError(null);
      setImportedCount(result.imported);
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

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[#0f172a]">Kunden aus CSV importieren</h1>
        <Link href="/customers" className="text-sm font-medium text-[#2563eb] hover:text-[#1d4ed8]">
          Zurück zu Kunden
        </Link>
      </div>

      {error && <p className="text-sm text-[#dc2626]">{error}</p>}

      {step === "pick" && (
        <div className="flex flex-col gap-3 rounded-2xl border border-[#e9edf2] bg-white p-6">
          <p className="text-sm text-[#64748b]">
            Wähle eine CSV-Datei mit den Spalten <strong>Name</strong> (erforderlich), E-Mail,
            Telefon und Adresse. Die erste Zeile muss die Spaltenüberschriften enthalten.
          </p>
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
              {preview.validRows.length}{" "}
              {preview.validRows.length === 1 ? "Kunde" : "Kunden"} können importiert werden.
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

          {preview.validRows.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-[#e9edf2] bg-white">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#e9edf2] text-xs font-medium uppercase tracking-wide text-[#94a3b8]">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">E-Mail</th>
                    <th className="px-4 py-3">Telefon</th>
                    <th className="px-4 py-3">Adresse</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.validRows.map((row) => (
                    <tr key={row.rowNumber} className="border-b border-[#e9edf2] last:border-b-0">
                      <td className="px-4 py-2 text-[#0f172a]">{row.name}</td>
                      <td className="px-4 py-2 text-[#0f172a]">{row.email}</td>
                      <td className="px-4 py-2 text-[#0f172a]">{row.phone}</td>
                      <td className="px-4 py-2 text-[#0f172a]">{row.address}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={isPending || preview.validRows.length === 0}
              className="self-start rounded-full bg-[#2563eb] px-5 py-2.5 text-sm font-medium text-white shadow-[0_6px_16px_rgba(37,99,235,0.3)] transition-colors hover:bg-[#1d4ed8] disabled:opacity-50"
            >
              {isPending
                ? "Importiere…"
                : `${preview.validRows.length} ${
                    preview.validRows.length === 1 ? "Kunde" : "Kunden"
                  } importieren`}
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

      {step === "done" && (
        <div className="flex flex-col gap-4 rounded-2xl border border-[#e9edf2] bg-white p-6">
          <p className="text-sm text-[#0f172a]">
            {importedCount} {importedCount === 1 ? "Kunde wurde" : "Kunden wurden"} erfolgreich
            importiert.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => router.push("/customers")}
              className="self-start rounded-full bg-[#2563eb] px-5 py-2.5 text-sm font-medium text-white shadow-[0_6px_16px_rgba(37,99,235,0.3)] transition-colors hover:bg-[#1d4ed8]"
            >
              Zu Kunden
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
