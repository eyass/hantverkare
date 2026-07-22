import Link from "next/link";
import { MarketingShell } from "@/components/MarketingShell";
import { QuoteDemo } from "@/components/QuoteDemo";

export default function Home() {
  return (
    <MarketingShell>
      <section className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 pt-16 pb-10 text-center sm:px-8 sm:pt-24">
        <span className="rounded-full bg-[#dcfce7] px-3 py-1 text-xs font-medium text-[#16a34a]">
          14 Tage kostenlos testen
        </span>
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-[#0f172a] sm:text-5xl">
          Angebote für Handwerker — in unter einer Minute, statt einer Stunde.
        </h1>
        <p className="max-w-2xl text-lg leading-8 text-[#64748b]">
          Beschreibe den Auftrag mit Stimme oder Text. Die KI erstellt sofort eine
          durchkalkulierte Positionsliste aus deiner Preisliste. Der Kunde unterschreibt digital —
          die Rechnung folgt automatisch.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/login"
            className="rounded-full bg-[#2563eb] px-6 py-3 text-sm font-medium text-white shadow-[0_6px_16px_rgba(37,99,235,0.3)] transition hover:bg-[#1d4ed8]"
          >
            Jetzt kostenlos starten
          </Link>
          <Link
            href="/tool"
            className="rounded-xl border border-[#e9edf2] bg-white px-6 py-3 text-sm font-medium text-[#0f172a] transition hover:bg-[#f4f6f8]"
          >
            So funktioniert&apos;s
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-6 sm:px-8">
        <div className="overflow-hidden rounded-2xl border border-[#e9edf2] bg-[#0f172a] p-6 shadow-sm sm:p-10">
          <div className="mx-auto flex max-w-4xl flex-col gap-4 rounded-xl bg-white/5 p-4 sm:p-6">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[#dc2626]" />
              <span className="h-3 w-3 rounded-full bg-[#94a3b8]" />
              <span className="h-3 w-3 rounded-full bg-[#16a34a]" />
              <span className="ml-2 text-xs text-white/50">hantverkare — Neues Angebot</span>
            </div>
            <div className="grid gap-3 rounded-lg bg-white p-4 sm:grid-cols-3">
              <div className="rounded-lg bg-[#f4f6f8] p-3">
                <p className="text-xs text-[#94a3b8]">Kunde</p>
                <p className="text-sm font-medium text-[#0f172a]">Familie Schmidt</p>
              </div>
              <div className="rounded-lg bg-[#f4f6f8] p-3 sm:col-span-2">
                <p className="text-xs text-[#94a3b8]">Auftrag</p>
                <p className="text-sm font-medium text-[#0f172a]">
                  Badezimmer renovieren, Dusche und Fliesen erneuern
                </p>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-[#dcfce7] p-3 sm:col-span-3">
                <p className="text-sm font-medium text-[#16a34a]">Angebot erstellt · 8 Positionen</p>
                <span className="mono text-sm font-semibold text-[#16a34a]">2.847,00 €</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-12 sm:px-8">
        <h2 className="text-2xl font-semibold tracking-tight text-[#0f172a]">
          Probier es direkt aus
        </h2>
        <p className="max-w-xl text-center text-base text-[#64748b]">
          Gib einen Auftrag ein oder wähle ein Beispiel — die Demo zeigt dir, wie ein fertiges
          Angebot aussieht. Kein Konto nötig, keine echten Daten.
        </p>
        <QuoteDemo />
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:grid-cols-3 sm:px-8">
        {[
          {
            title: "Auftrag beschreiben",
            body: "Per Stimme oder Text — direkt beim Kunden vor Ort oder im Büro.",
          },
          {
            title: "KI kalkuliert",
            body: "Positionen und Preise werden automatisch aus deiner Preisliste erstellt.",
          },
          {
            title: "Kunde unterschreibt",
            body: "Digital per Klick — die Rechnung folgt automatisch nach Auftragsabschluss.",
          },
        ].map((step, index) => (
          <div key={step.title} className="rounded-2xl border border-[#e9edf2] bg-white p-6 shadow-sm">
            <span className="mono text-sm font-semibold text-[#2563eb]">{index + 1}</span>
            <h3 className="mt-2 text-lg font-semibold text-[#0f172a]">{step.title}</h3>
            <p className="mt-1 text-sm text-[#64748b]">{step.body}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-8">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-[#e9edf2] bg-white p-8 text-center shadow-sm sm:p-12">
          <h2 className="text-2xl font-semibold tracking-tight text-[#0f172a]">
            Bereit, weniger Zeit mit Angeboten zu verbringen?
          </h2>
          <p className="max-w-xl text-base text-[#64748b]">
            14 Tage kostenlos testen, danach 29 €/Monat. Jederzeit kündbar.
          </p>
          <Link
            href="/login"
            className="rounded-full bg-[#2563eb] px-6 py-3 text-sm font-medium text-white shadow-[0_6px_16px_rgba(37,99,235,0.3)] transition hover:bg-[#1d4ed8]"
          >
            Jetzt kostenlos starten
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}
