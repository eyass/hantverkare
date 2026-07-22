import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingShell } from "@/components/MarketingShell";
import { QuoteDemo } from "@/components/QuoteDemo";
import { PageHero } from "@/components/marketing/PageHero";
import { AnimatedSection } from "@/components/marketing/AnimatedSection";
import { MicIcon, SparkleCalcIcon, SignatureIcon } from "@/components/marketing/illustrations/FeatureIcons";
import { TRADE_SLUGS, getTradeConfig, formatItemPrice } from "@/lib/trades/config";

type PageProps = {
  params: Promise<{ trade: string }>;
};

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

export function generateStaticParams() {
  return TRADE_SLUGS.map((trade) => ({ trade }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { trade } = await params;
  const config = getTradeConfig(trade);
  if (!config) return {};

  return {
    title: config.metaTitle,
    description: config.metaDescription,
    openGraph: {
      title: config.metaTitle,
      description: config.metaDescription,
      url: `/handwerker/${config.slug}`,
      siteName: "hantverkare",
      locale: "de_DE",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: config.metaTitle,
      description: config.metaDescription,
    },
  };
}

export default async function TradePage({ params }: PageProps) {
  const { trade } = await params;
  const config = getTradeConfig(trade);
  if (!config) notFound();

  return (
    <MarketingShell>
      <PageHero
        eyebrow="14 Tage kostenlos testen"
        title={config.heroTitle}
        description={config.heroDescription}
        compact
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/login"
            className="rounded-full bg-gradient-to-r from-blue-500 to-blue-700 px-6 py-3 text-sm font-medium text-white shadow-[0_6px_24px_rgba(37,99,235,0.5)] transition hover:scale-[1.03] hover:from-blue-400 hover:to-blue-600"
          >
            Jetzt kostenlos starten
          </Link>
          <Link
            href="/tool"
            className="rounded-xl border border-[#e2e8f0] bg-white/70 px-6 py-3 text-sm font-medium text-[#0f172a] backdrop-blur transition hover:bg-white"
          >
            So funktioniert&apos;s
          </Link>
        </div>
      </PageHero>

      <AnimatedSection className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-16 text-center sm:px-8">
        <h2 className="text-2xl font-semibold tracking-tight text-[#0f172a] sm:text-3xl">
          Gemacht für {config.labelDative}
        </h2>
        <p className="max-w-xl text-base leading-7 text-[#64748b]">{config.introBody}</p>
      </AnimatedSection>

      <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-8">
        <AnimatedSection className="rounded-3xl border border-[#e9edf2] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-10">
          <h3 className="text-lg font-semibold text-[#0f172a]">
            Beispielpositionen aus der {config.label}-Preisliste
          </h3>
          <p className="mt-1 text-sm text-[#64748b]">
            So sieht die vorausgefüllte Preisliste für {config.labelDative} nach der Einrichtung aus — du kannst
            jede Position anpassen.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {config.exampleItems.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between gap-3 rounded-xl bg-[#f4f6f8] px-4 py-3 text-sm"
              >
                <div className="flex flex-col">
                  <span className="font-medium text-[#0f172a]">{item.label}</span>
                  <span className="text-xs text-[#94a3b8]">pro {item.unit}</span>
                </div>
                <span className="mono shrink-0 font-medium text-[#0f172a]">
                  {formatItemPrice(item.priceCents)}
                </span>
              </div>
            ))}
          </div>
        </AnimatedSection>
      </section>

      <AnimatedSection className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 pb-16 sm:px-8">
        <h2 className="text-2xl font-semibold tracking-tight text-[#0f172a] sm:text-3xl">
          Probier es direkt aus
        </h2>
        <p className="max-w-xl text-center text-base leading-7 text-[#64748b]">
          Gib einen {config.label}-Auftrag ein oder wähle ein Beispiel — die Demo zeigt dir, wie ein fertiges
          Angebot aussieht. Kein Konto nötig, keine echten Daten.
        </p>
        <div className="mt-4 w-full">
          <QuoteDemo preferredJobIds={config.demoJobIds} defaultDescription={config.demoDefaultDescription} />
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
        <div className="relative flex flex-col items-center gap-4 overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-blue-50 p-8 text-center shadow-[0_16px_48px_rgba(37,99,235,0.1)] sm:p-14">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(96,165,250,0.18),transparent_60%),radial-gradient(circle_at_80%_80%,rgba(37,99,235,0.14),transparent_55%)]"
          />
          <div className="relative flex flex-col items-center gap-4">
            <h2 className="text-2xl font-semibold tracking-tight text-[#0f172a] sm:text-3xl">
              Bereit, weniger Zeit mit Angeboten zu verbringen?
            </h2>
            <p className="max-w-xl text-base leading-7 text-[#475569]">
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

