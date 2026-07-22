import Link from "next/link";
import { MarketingShell } from "@/components/MarketingShell";

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
      <section className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 pt-16 pb-10 text-center sm:px-8">
        <h1 className="text-3xl font-semibold tracking-tight text-[#0f172a] sm:text-4xl">
          Ein einfacher Preis
        </h1>
        <p className="max-w-xl text-lg leading-8 text-[#64748b]">
          Keine versteckten Kosten, keine Mindestlaufzeit. Teste hantverkare 14 Tage lang
          kostenlos.
        </p>
      </section>

      <section className="mx-auto max-w-md px-4 pb-16 sm:px-8">
        <div className="flex flex-col gap-6 rounded-2xl border border-[#e9edf2] bg-white p-8 shadow-sm">
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
            className="self-stretch rounded-full bg-[#2563eb] px-6 py-3 text-center text-sm font-medium text-white shadow-[0_6px_16px_rgba(37,99,235,0.3)] transition hover:bg-[#1d4ed8]"
          >
            14 Tage kostenlos starten
          </Link>
          <p className="text-center text-xs text-[#94a3b8]">
            Keine Kreditkarte für die Testphase nötig. Danach 29 €/Monat, jederzeit kündbar.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-8">
        <div className="flex flex-col gap-3 rounded-2xl border border-[#e9edf2] bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-semibold text-[#0f172a]">Fragen zur Abrechnung?</h2>
          <p className="text-sm leading-6 text-[#64748b]">
            Antworten zu Testphase, Kündigung und Abrechnung findest du auf unserer{" "}
            <Link href="/faq" className="font-medium text-[#2563eb] hover:text-[#1d4ed8]">
              FAQ-Seite
            </Link>
            .
          </p>
        </div>
      </section>
    </MarketingShell>
  );
}
