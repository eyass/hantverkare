"use client";

import { useState } from "react";
import Link from "next/link";
import { generateDemoQuote, formatCents, DEMO_JOB_TEMPLATES, type DemoQuote } from "@/lib/demo/mockQuote";

const EXAMPLE_JOBS = [
  DEMO_JOB_TEMPLATES[0].label,
  DEMO_JOB_TEMPLATES[1].label,
  DEMO_JOB_TEMPLATES[3].label,
];

export function QuoteDemo() {
  const [description, setDescription] = useState("");
  const [quote, setQuote] = useState<DemoQuote | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  function handleGenerate(text?: string) {
    const input = (text ?? description).trim();
    if (!input) return;
    setDescription(input);
    setIsGenerating(true);
    setQuote(null);
    // Simulate the AI generation delay of the real tool without calling any
    // server — this demo runs entirely client-side.
    window.setTimeout(() => {
      setQuote(generateDemoQuote(input));
      setIsGenerating(false);
    }, 700);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 rounded-2xl border border-[#e9edf2] bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="demo-description" className="text-sm font-medium text-[#0f172a]">
          Auftragsbeschreibung
        </label>
        <textarea
          id="demo-description"
          rows={4}
          maxLength={500}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Beschreibe den Auftrag, z. B. Badezimmer renovieren, Dusche und Fliesen erneuern"
          className="w-full rounded-xl border border-[#e9edf2] p-3 text-base text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#2563eb] focus:outline-none"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_JOBS.map((job) => (
          <button
            key={job}
            type="button"
            onClick={() => handleGenerate(job)}
            className="rounded-full border border-[#e9edf2] bg-[#f4f6f8] px-3 py-1.5 text-xs font-medium text-[#64748b] transition hover:border-[#2563eb] hover:text-[#2563eb]"
          >
            {job}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => handleGenerate()}
        disabled={isGenerating || !description.trim()}
        className="self-center rounded-full bg-[#2563eb] px-6 py-3 text-sm font-medium text-white shadow-[0_6px_16px_rgba(37,99,235,0.3)] transition hover:not-disabled:bg-[#1d4ed8] disabled:opacity-50"
      >
        {isGenerating ? "Angebot wird erstellt…" : "Demo-Angebot erstellen"}
      </button>
      <p className="text-center text-xs text-[#94a3b8]">
        Diese Demo läuft komplett in deinem Browser mit Beispieldaten. Keine echte KI-Anfrage,
        kein Konto nötig.
      </p>

      {quote && (
        <div className="flex flex-col gap-4 rounded-xl border border-[#e9edf2] bg-[#f4f6f8] p-4 sm:p-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[#94a3b8]">
              Erkannter Auftrag
            </p>
            <p className="text-base font-semibold text-[#0f172a]">{quote.matchedJob}</p>
          </div>
          <div className="flex flex-col gap-2">
            {quote.items.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm"
              >
                <div className="flex flex-col">
                  <span className="font-medium text-[#0f172a]">{item.description}</span>
                  <span className="text-xs text-[#94a3b8]">
                    {item.quantity} {item.unit} × {formatCents(item.unitPriceCents)}
                  </span>
                </div>
                <span className="mono shrink-0 font-medium text-[#0f172a]">
                  {formatCents(item.lineTotalCents)}
                </span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1 border-t border-[#e9edf2] pt-3 text-sm">
            <div className="flex justify-between text-[#64748b]">
              <span>Zwischensumme</span>
              <span className="mono">{formatCents(quote.subtotalCents)}</span>
            </div>
            <div className="flex justify-between text-[#64748b]">
              <span>zzgl. 19% MwSt.</span>
              <span className="mono">{formatCents(quote.vatCents)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold text-[#0f172a]">
              <span>Gesamt</span>
              <span className="mono">{formatCents(quote.totalCents)}</span>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2 pt-2 text-center">
            <p className="text-sm text-[#64748b]">
              So schnell geht&apos;s mit echten KI-Preisen aus deiner Preisliste.
            </p>
            <Link
              href="/login"
              className="rounded-full bg-[#2563eb] px-6 py-3 text-sm font-medium text-white shadow-[0_6px_16px_rgba(37,99,235,0.3)] transition hover:bg-[#1d4ed8]"
            >
              Jetzt kostenlos starten
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
