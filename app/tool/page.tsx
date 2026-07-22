import Link from "next/link";
import { MarketingShell } from "@/components/MarketingShell";

const FEATURES = [
  {
    title: "Spracheingabe statt Tippen",
    body:
      "Nimm den Auftrag direkt beim Kunden per Sprachmemo auf. Die Aufnahme wird automatisch in Text umgewandelt — kein manuelles Tippen auf der Baustelle nötig.",
  },
  {
    title: "KI-Kalkulation aus deiner Preisliste",
    body:
      "Die KI erkennt Leistungen aus der Beschreibung und ordnet sie deinen hinterlegten Preisen zu. Mengen, Einheiten und Preise sind sofort ausgefüllt — du musst nur noch prüfen.",
  },
  {
    title: "Angebot in Sekunden statt Stunden",
    body:
      "Statt abends am Schreibtisch ein Angebot zu tippen, hast du es direkt nach dem Kundentermin fertig — inklusive Positionsliste, Summen und 19% MwSt.",
  },
  {
    title: "Digitale Unterschrift",
    body:
      "Der Kunde erhält einen Link, prüft das Angebot und unterschreibt direkt am Handy oder Tablet. Kein Papier, kein Hin- und Herschicken von PDFs per E-Mail.",
  },
  {
    title: "Automatische Rechnung",
    body:
      "Sobald der Auftrag abgeschlossen ist, wird aus dem unterschriebenen Angebot automatisch eine Rechnung erstellt — mit denselben Positionen und Preisen.",
  },
  {
    title: "Eigene Preisliste",
    body:
      "Hinterlege einmal deine Standardleistungen und Preise pro Gewerk. Die KI greift bei jedem neuen Angebot darauf zurück, damit deine Kalkulation immer konsistent bleibt.",
  },
];

export default function ToolPage() {
  return (
    <MarketingShell>
      <section className="mx-auto flex max-w-4xl flex-col items-center gap-4 px-4 pt-16 pb-10 text-center sm:px-8">
        <h1 className="text-3xl font-semibold tracking-tight text-[#0f172a] sm:text-4xl">
          Das Tool: vom Auftrag zum unterschriebenen Angebot
        </h1>
        <p className="max-w-2xl text-lg leading-8 text-[#64748b]">
          hantverkare übernimmt die Kalkulation, das Angebot und die Rechnung — du beschreibst nur
          den Auftrag.
        </p>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 pb-12 sm:grid-cols-2 sm:px-8 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <div key={feature.title} className="rounded-2xl border border-[#e9edf2] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[#0f172a]">{feature.title}</h2>
            <p className="mt-2 text-sm leading-6 text-[#64748b]">{feature.body}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-16 sm:px-8">
        <div className="rounded-2xl border border-[#e9edf2] bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-[#0f172a]">Der Ablauf im Detail</h2>
          <ol className="mt-4 flex flex-col gap-4">
            {[
              "Auftrag beschreiben — per Sprachmemo oder Text, direkt beim Kunden oder im Büro.",
              "KI erstellt eine Positionsliste — Leistungen, Mengen und Preise aus deiner Preisliste.",
              "Angebot prüfen und anpassen — Positionen bearbeiten, ergänzen oder entfernen.",
              "Kunde erhält einen Link und unterschreibt digital.",
              "Rechnung wird automatisch aus dem unterschriebenen Angebot erstellt.",
            ].map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="mono flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2563eb] text-xs font-semibold text-white">
                  {index + 1}
                </span>
                <span className="text-sm leading-6 text-[#64748b]">{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
            <p className="text-sm text-[#64748b]">Probier die Demo auf der Startseite aus.</p>
            <div className="flex gap-3">
              <Link
                href="/"
                className="rounded-xl border border-[#e9edf2] bg-white px-5 py-2.5 text-sm font-medium text-[#0f172a] transition hover:bg-[#f4f6f8]"
              >
                Zur Demo
              </Link>
              <Link
                href="/login"
                className="rounded-full bg-[#2563eb] px-5 py-2.5 text-sm font-medium text-white shadow-[0_6px_16px_rgba(37,99,235,0.3)] transition hover:bg-[#1d4ed8]"
              >
                Jetzt kostenlos starten
              </Link>
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
