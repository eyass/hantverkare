import Link from "next/link";
import { MarketingShell } from "@/components/MarketingShell";
import { PageHero } from "@/components/marketing/PageHero";
import { AnimatedSection } from "@/components/marketing/AnimatedSection";
import {
  MicIcon,
  SparkleCalcIcon,
  ChecklistIcon,
  SignatureIcon,
  InvoiceIcon,
  PriceListIcon,
} from "@/components/marketing/illustrations/FeatureIcons";

const FEATURES = [
  {
    icon: MicIcon,
    title: "Spracheingabe statt Tippen",
    body:
      "Nimm den Auftrag direkt beim Kunden per Sprachmemo auf. Die Aufnahme wird automatisch in Text umgewandelt — kein manuelles Tippen auf der Baustelle nötig.",
  },
  {
    icon: SparkleCalcIcon,
    title: "KI-Kalkulation aus deiner Preisliste",
    body:
      "Die KI erkennt Leistungen aus der Beschreibung und ordnet sie deinen hinterlegten Preisen zu. Mengen, Einheiten und Preise sind sofort ausgefüllt — du musst nur noch prüfen.",
  },
  {
    icon: ChecklistIcon,
    title: "Angebot in Sekunden statt Stunden",
    body:
      "Statt abends am Schreibtisch ein Angebot zu tippen, hast du es direkt nach dem Kundentermin fertig — inklusive Positionsliste, Summen und 19% MwSt.",
  },
  {
    icon: SignatureIcon,
    title: "Digitale Unterschrift",
    body:
      "Der Kunde erhält einen Link, prüft das Angebot und unterschreibt direkt am Handy oder Tablet. Kein Papier, kein Hin- und Herschicken von PDFs per E-Mail.",
  },
  {
    icon: InvoiceIcon,
    title: "Automatische Rechnung",
    body:
      "Sobald der Auftrag abgeschlossen ist, wird aus dem unterschriebenen Angebot automatisch eine Rechnung erstellt — mit denselben Positionen und Preisen.",
  },
  {
    icon: PriceListIcon,
    title: "Eigene Preisliste",
    body:
      "Hinterlege einmal deine Standardleistungen und Preise pro Gewerk. Die KI greift bei jedem neuen Angebot darauf zurück, damit deine Kalkulation immer konsistent bleibt.",
  },
];

const FLOW_STEPS = [
  "Auftrag beschreiben — per Sprachmemo oder Text, direkt beim Kunden oder im Büro.",
  "KI erstellt eine Positionsliste — Leistungen, Mengen und Preise aus deiner Preisliste.",
  "Angebot prüfen und anpassen — Positionen bearbeiten, ergänzen oder entfernen.",
  "Kunde erhält einen Link und unterschreibt digital.",
  "Rechnung wird automatisch aus dem unterschriebenen Angebot erstellt.",
];

export default function ToolPage() {
  return (
    <MarketingShell>
      <PageHero
        compact
        title="Das Tool: vom Auftrag zum unterschriebenen Angebot"
        description="hantverkare übernimmt die Kalkulation, das Angebot und die Rechnung — du beschreibst nur den Auftrag."
      />

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-16 sm:grid-cols-2 sm:px-8 lg:grid-cols-3">
        {FEATURES.map((feature, index) => (
          <AnimatedSection key={feature.title} delay={(index % 3) * 0.08}>
            <div className="group h-full rounded-2xl border border-[#e9edf2] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:-translate-y-1 hover:shadow-[0_16px_32px_rgba(15,23,42,0.08)]">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50">
                <feature.icon />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-[#0f172a]">{feature.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#64748b]">{feature.body}</p>
            </div>
          </AnimatedSection>
        ))}
      </section>

      <AnimatedSection className="mx-auto max-w-4xl px-4 pb-20 sm:px-8">
        <div className="rounded-3xl border border-[#e9edf2] bg-white p-8 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_20px_48px_rgba(15,23,42,0.06)] sm:p-10">
          <h2 className="text-xl font-semibold text-[#0f172a]">Der Ablauf im Detail</h2>
          <ol className="mt-6 flex flex-col gap-5">
            {FLOW_STEPS.map((step, index) => (
              <li key={step} className="flex gap-4">
                <span className="mono flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-xs font-semibold text-white shadow-[0_4px_10px_rgba(37,99,235,0.35)]">
                  {index + 1}
                </span>
                <span className="pt-0.5 text-sm leading-6 text-[#64748b]">{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex flex-col items-center gap-3 border-t border-[#e9edf2] pt-6 sm:flex-row sm:justify-between">
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
                className="rounded-full bg-gradient-to-r from-blue-500 to-blue-700 px-5 py-2.5 text-sm font-medium text-white shadow-[0_6px_20px_rgba(37,99,235,0.35)] transition hover:from-blue-400 hover:to-blue-600"
              >
                Jetzt kostenlos starten
              </Link>
            </div>
          </div>
        </div>
      </AnimatedSection>
    </MarketingShell>
  );
}
