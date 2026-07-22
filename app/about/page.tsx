import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/MarketingShell";
import { PageHero } from "@/components/marketing/PageHero";
import { AnimatedSection } from "@/components/marketing/AnimatedSection";

const SECTIONS = [
  {
    title: "Warum wir hantverkare gebaut haben",
    body:
      "Handwerker verbringen jede Woche Stunden mit dem Schreiben von Angeboten — oft abends, nach einem vollen Arbeitstag auf der Baustelle. Wir wollten dieses Problem lösen: den Auftrag direkt beim Kunden beschreiben, und die Kalkulation, das Angebot und die Rechnung automatisch erledigen lassen.",
  },
  {
    title: "Unser Ansatz",
    body:
      "hantverkare ist kein Marktplatz und keine Vermittlungsplattform — wir zeigen deine Angebote niemandem außer deinen eigenen Kunden. Es ist ein Verwaltungswerkzeug für dein eigenes Geschäft: deine Preisliste, deine Kunden, deine Angebote und Rechnungen, an einem Ort.",
  },
  {
    title: "Für wen ist hantverkare gedacht?",
    body:
      "Für Einzelunternehmer und kleine Handwerksbetriebe im deutschsprachigen Raum, die weniger Zeit mit Papierkram und mehr Zeit mit ihrem eigentlichen Handwerk verbringen wollen.",
  },
];

const TITLE = "Über uns — hantverkare";
const DESCRIPTION =
  "hantverkare ist kein Marktplatz, sondern ein Verwaltungswerkzeug für Einzelunternehmer und kleine Handwerksbetriebe: eigene Preisliste, Kunden, Angebote und Rechnungen an einem Ort.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/about",
    siteName: "hantverkare",
    locale: "de_DE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function AboutPage() {
  return (
    <MarketingShell>
      <PageHero
        compact
        title="Über uns"
        description="hantverkare macht Angebote für Handwerksbetriebe so schnell wie möglich — vom Kundengespräch bis zur Unterschrift."
      />

      <section className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-16 sm:px-8">
        {SECTIONS.map((section, index) => (
          <AnimatedSection key={section.title} delay={index * 0.08}>
            <div className="rounded-2xl border border-[#e9edf2] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:shadow-[0_12px_28px_rgba(15,23,42,0.06)] sm:p-8">
              <h2 className="text-lg font-semibold text-[#0f172a]">{section.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#64748b]">{section.body}</p>
            </div>
          </AnimatedSection>
        ))}
      </section>

      <AnimatedSection className="mx-auto max-w-3xl px-4 pb-20 sm:px-8">
        <div className="relative flex flex-col items-center gap-3 overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-blue-50 p-8 text-center shadow-[0_16px_48px_rgba(37,99,235,0.1)] sm:p-12">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgba(96,165,250,0.18),transparent_60%)]"
          />
          <div className="relative flex flex-col items-center gap-3">
            <h2 className="text-xl font-semibold text-[#0f172a]">Lerne hantverkare kennen</h2>
            <p className="text-sm text-[#475569]">14 Tage kostenlos testen, danach 29 €/Monat.</p>
            <Link
              href="/login"
              className="mt-2 rounded-full bg-gradient-to-r from-blue-500 to-blue-700 px-6 py-3 text-sm font-medium text-white shadow-[0_6px_20px_rgba(37,99,235,0.4)] transition hover:from-blue-400 hover:to-blue-600"
            >
              Jetzt kostenlos starten
            </Link>
          </div>
        </div>
      </AnimatedSection>
    </MarketingShell>
  );
}
