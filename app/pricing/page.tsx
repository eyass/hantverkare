import Link from "next/link";
import { MarketingShell } from "@/components/MarketingShell";
import { PageHero } from "@/components/marketing/PageHero";
import { AnimatedSection } from "@/components/marketing/AnimatedSection";

const INCLUDED = [
  "KI-gestützte Angebotserstellung per Sprache oder Text",
  "Unbegrenzte Angebote und Rechnungen",
  "Eigene Preisliste je Gewerk",
  "Digitale Unterschrift für deine Kunden",
  "Automatische Rechnungsstellung",
  "Team-Mitglieder einladen",
];

export default function PricingPage() {
  return (
    <MarketingShell>
      <PageHero
        compact
        title="Ein einfacher Preis"
        description="Keine versteckten Kosten, keine Mindestlaufzeit. Teste hantverkare 14 Tage lang kostenlos."
      />

      <AnimatedSection className="mx-auto max-w-md px-4 py-16 sm:px-8">
        <div className="relative flex flex-col gap-6 overflow-hidden rounded-3xl border border-[#e9edf2] bg-white p-8 shadow-[0_2px_8px_rgba(15,23,42,0.04),0_24px_56px_rgba(15,23,42,0.08)] transition-transform duration-300 hover:-translate-y-1">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-blue-400 via-blue-600 to-blue-700"
          />
          <div className="flex flex-col items-center gap-1 text-center">
            <span className="rounded-full bg-[#dcfce7] px-3 py-1 text-xs font-medium text-[#16a34a]">
              14 Tage kostenlos
            </span>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="mono text-4xl font-semibold text-[#0f172a]">29 €</span>
              <span className="text-sm text-[#64748b]">/ Monat</span>
            </div>
            <p className="text-xs text-[#94a3b8]">zzgl. gesetzlicher MwSt., danach monatlich kündbar</p>
          </div>
          <ul className="flex flex-col gap-2.5">
            {INCLUDED.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-[#0f172a]">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#dcfce7] text-[10px] font-bold text-[#16a34a]">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
          <Link
            href="/login"
            className="self-stretch rounded-full bg-gradient-to-r from-blue-500 to-blue-700 px-6 py-3 text-center text-sm font-medium text-white shadow-[0_6px_20px_rgba(37,99,235,0.35)] transition hover:from-blue-400 hover:to-blue-600"
          >
            14 Tage kostenlos starten
          </Link>
          <p className="text-center text-xs text-[#94a3b8]">
            Keine Kreditkarte für die Testphase nötig. Danach 29 €/Monat, jederzeit kündbar.
          </p>
        </div>
      </AnimatedSection>

      <AnimatedSection className="mx-auto max-w-3xl px-4 pb-20 sm:px-8">
        <div className="flex flex-col gap-3 rounded-2xl border border-[#e9edf2] bg-[#f4f6f8] p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-[#0f172a]">Fragen zur Abrechnung?</h2>
          <p className="text-sm leading-6 text-[#64748b]">
            Antworten zu Testphase, Kündigung und Abrechnung findest du auf unserer{" "}
            <Link href="/faq" className="font-medium text-blue-600 hover:text-blue-700">
              FAQ-Seite
            </Link>
            .
          </p>
        </div>
      </AnimatedSection>
    </MarketingShell>
  );
}
