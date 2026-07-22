import Link from "next/link";
import { MarketingShell } from "@/components/MarketingShell";

export default function AboutPage() {
  return (
    <MarketingShell>
      <section className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 pt-16 pb-10 text-center sm:px-8">
        <h1 className="text-3xl font-semibold tracking-tight text-[#0f172a] sm:text-4xl">
          Über uns
        </h1>
        <p className="max-w-xl text-lg leading-8 text-[#64748b]">
          hantverkare macht Angebote für Handwerksbetriebe so schnell wie möglich — vom
          Kundengespräch bis zur Unterschrift.
        </p>
      </section>

      <section className="mx-auto flex max-w-3xl flex-col gap-6 px-4 pb-16 sm:px-8">
        <div className="rounded-2xl border border-[#e9edf2] bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-semibold text-[#0f172a]">Warum wir hantverkare gebaut haben</h2>
          <p className="mt-2 text-sm leading-6 text-[#64748b]">
            Handwerker verbringen jede Woche Stunden mit dem Schreiben von Angeboten — oft abends,
            nach einem vollen Arbeitstag auf der Baustelle. Wir wollten dieses Problem lösen: den
            Auftrag direkt beim Kunden beschreiben, und die Kalkulation, das Angebot und die
            Rechnung automatisch erledigen lassen.
          </p>
        </div>
        <div className="rounded-2xl border border-[#e9edf2] bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-semibold text-[#0f172a]">Unser Ansatz</h2>
          <p className="mt-2 text-sm leading-6 text-[#64748b]">
            hantverkare ist kein Marktplatz und keine Vermittlungsplattform — wir zeigen deine
            Angebote niemandem außer deinen eigenen Kunden. Es ist ein Verwaltungswerkzeug für dein
            eigenes Geschäft: deine Preisliste, deine Kunden, deine Angebote und Rechnungen, an
            einem Ort.
          </p>
        </div>
        <div className="rounded-2xl border border-[#e9edf2] bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-semibold text-[#0f172a]">Für wen ist hantverkare gedacht?</h2>
          <p className="mt-2 text-sm leading-6 text-[#64748b]">
            Für Einzelunternehmer und kleine Handwerksbetriebe im deutschsprachigen Raum, die
            weniger Zeit mit Papierkram und mehr Zeit mit ihrem eigentlichen Handwerk verbringen
            wollen.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-8">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#e9edf2] bg-white p-8 text-center shadow-sm">
          <h2 className="text-xl font-semibold text-[#0f172a]">Lerne hantverkare kennen</h2>
          <p className="text-sm text-[#64748b]">14 Tage kostenlos testen, danach 29 €/Monat.</p>
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
