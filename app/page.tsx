import Link from "next/link";
import { MarketingShell } from "@/components/MarketingShell";
import { QuoteDemo } from "@/components/QuoteDemo";
import { PageHero } from "@/components/marketing/PageHero";
import { AnimatedSection } from "@/components/marketing/AnimatedSection";
import { QuoteFlowIllustration } from "@/components/marketing/illustrations/QuoteFlowIllustration";
import { MicIcon, SparkleCalcIcon, SignatureIcon } from "@/components/marketing/illustrations/FeatureIcons";

const STEPS = [
  {
    icon: MicIcon,
    title: "Auftrag beschreiben",
    body: "Per Stimme oder Text — direkt beim Kunden vor Ort oder im Büro.",
  },
  {
    icon: SparkleCalcIcon,
    title: "KI kalkuliert",
    body: "Positionen und Preise werden automatisch aus deiner Preisliste erstellt.",
  },
  {
    icon: SignatureIcon,
    title: "Kunde unterschreibt",
    body: "Digital per Klick — die Rechnung folgt automatisch nach Auftragsabschluss.",
  },
];

const STATS = [
  { value: "< 1 Minute", label: "statt 1 Stunde für ein Angebot" },
  { value: "14 Tage", label: "kostenlos & unverbindlich testen" },
  { value: "29 €/Monat", label: "danach, jederzeit kündbar" },
];

export default function Home() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="14 Tage kostenlos testen"
        title={
          <>
            Angebote für Handwerker —
            <br className="hidden sm:block" /> in unter einer Minute.
          </>
        }
        description="Beschreibe den Auftrag mit Stimme oder Text. Die KI erstellt sofort eine durchkalkulierte Positionsliste aus deiner Preisliste. Der Kunde unterschreibt digital — die Rechnung folgt automatisch."
      >
        <div className="flex flex-col items-center gap-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="rounded-full bg-gradient-to-r from-blue-500 to-blue-700 px-6 py-3 text-sm font-medium text-white shadow-[0_6px_24px_rgba(37,99,235,0.5)] transition hover:scale-[1.03] hover:from-blue-400 hover:to-blue-600"
            >
              Jetzt kostenlos starten
            </Link>
            <Link
              href="/tool"
              className="rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-medium text-white backdrop-blur transition hover:bg-white/10"
            >
              So funktioniert&apos;s
            </Link>
          </div>
          <div className="mx-auto mt-4 w-full max-w-md">
            <QuoteFlowIllustration className="w-full" />
          </div>
        </div>
      </PageHero>

      <AnimatedSection className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
        <div className="grid gap-6 rounded-3xl border border-[#e9edf2] bg-[#f4f6f8] p-6 sm:grid-cols-3 sm:p-10">
          {STATS.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center gap-1 text-center">
              <span className="mono text-2xl font-semibold text-[#0f172a] sm:text-3xl">
                {stat.value}
              </span>
              <span className="text-sm text-[#64748b]">{stat.label}</span>
            </div>
          ))}
        </div>
      </AnimatedSection>

      <AnimatedSection className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-16 sm:px-8">
        <h2 className="text-2xl font-semibold tracking-tight text-[#0f172a] sm:text-3xl">
          Probier es direkt aus
        </h2>
        <p className="max-w-xl text-center text-base leading-7 text-[#64748b]">
          Gib einen Auftrag ein oder wähle ein Beispiel — die Demo zeigt dir, wie ein fertiges
          Angebot aussieht. Kein Konto nötig, keine echten Daten.
        </p>
        <div className="mt-4 w-full">
          <QuoteDemo />
        </div>
      </AnimatedSection>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-16 sm:grid-cols-3 sm:px-8">
        {STEPS.map((step, index) => (
          <AnimatedSection key={step.title} delay={index * 0.1}>
            <div className="group h-full rounded-2xl border border-[#e9edf2] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:-translate-y-1 hover:shadow-[0_16px_32px_rgba(15,23,42,0.08)]">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50">
                <step.icon />
              </div>
              <span className="mono mt-4 block text-xs font-semibold text-blue-600">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-1 text-lg font-semibold text-[#0f172a]">{step.title}</h3>
              <p className="mt-1 text-sm leading-6 text-[#64748b]">{step.body}</p>
            </div>
          </AnimatedSection>
        ))}
      </section>

      <AnimatedSection className="mx-auto max-w-6xl px-4 pb-20 sm:px-8">
        <div className="relative flex flex-col items-center gap-4 overflow-hidden rounded-3xl bg-[#020617] p-8 text-center shadow-[0_24px_64px_rgba(2,6,23,0.35)] sm:p-14">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(96,165,250,0.25),transparent_60%),radial-gradient(circle_at_80%_80%,rgba(29,78,216,0.35),transparent_55%)]"
          />
          <div className="relative flex flex-col items-center gap-4">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Bereit, weniger Zeit mit Angeboten zu verbringen?
            </h2>
            <p className="max-w-xl text-base leading-7 text-slate-300">
              14 Tage kostenlos testen, danach 29 €/Monat. Jederzeit kündbar.
            </p>
            <Link
              href="/login"
              className="rounded-full bg-gradient-to-r from-blue-500 to-blue-700 px-6 py-3 text-sm font-medium text-white shadow-[0_6px_24px_rgba(37,99,235,0.5)] transition hover:scale-[1.03] hover:from-blue-400 hover:to-blue-600"
            >
              Jetzt kostenlos starten
            </Link>
          </div>
        </div>
      </AnimatedSection>
    </MarketingShell>
  );
}
