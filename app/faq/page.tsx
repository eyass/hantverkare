"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { MarketingShell } from "@/components/MarketingShell";
import { PageHero } from "@/components/marketing/PageHero";
import { AnimatedSection } from "@/components/marketing/AnimatedSection";

const FAQS = [
  {
    question: "Wie funktioniert die KI-Kalkulation genau?",
    answer:
      "Du beschreibst den Auftrag per Text oder Sprache. Die KI gleicht die Beschreibung mit deiner hinterlegten Preisliste ab und schlägt passende Positionen mit Menge, Einheit und Preis vor. Du kannst jede Position vor dem Versand noch anpassen.",
  },
  {
    question: "Muss ich vorher eine Preisliste anlegen?",
    answer:
      "Ja, für genaue KI-Vorschläge solltest du einmal deine Standardleistungen und Preise hinterlegen. Beim ersten Einrichten hilft dir ein Assistent, passend zu deinem Gewerk zu starten.",
  },
  {
    question: "Wie unterschreibt der Kunde?",
    answer:
      "Der Kunde erhält einen Link zum Angebot, prüft die Positionen und unterschreibt direkt im Browser am Handy, Tablet oder Computer — ohne eigenes Konto.",
  },
  {
    question: "Wird aus dem Angebot automatisch eine Rechnung?",
    answer:
      "Sobald der Auftrag abgeschlossen ist, kannst du aus dem unterschriebenen Angebot mit einem Klick eine Rechnung mit denselben Positionen erstellen.",
  },
  {
    question: "Was kostet hantverkare?",
    answer:
      "14 Tage kostenlos testen, danach 29 €/Monat zzgl. MwSt. Jederzeit monatlich kündbar, keine Mindestlaufzeit. Details findest du auf der Preise-Seite.",
  },
  {
    question: "Ist meine Preisliste sicher?",
    answer:
      "Deine Daten sind an dein Konto gebunden und für andere Nutzer nicht einsehbar. Wir setzen auf verschlüsselte Verbindungen und feingranulare Zugriffsrechte in unserer Datenbank.",
  },
  {
    question: "Kann ich hantverkare mit meinem Team nutzen?",
    answer:
      "Ja, du kannst weitere Mitglieder zu deinem Unternehmenskonto einladen. Preisliste, Kunden und Angebote werden im Team geteilt.",
  },
  {
    question: "Für welche Gewerke ist hantverkare geeignet?",
    answer:
      "hantverkare eignet sich für Handwerksbetriebe aller Art — von Sanitär und Elektro über Maler bis Bodenleger. Die Preisliste passt sich an dein Gewerk an.",
  },
];

export default function FaqPage() {
  return (
    <MarketingShell>
      <PageHero
        compact
        title="Häufig gestellte Fragen"
        description="Antworten auf die wichtigsten Fragen rund um hantverkare."
      />

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
        <div className="flex flex-col gap-4">
          {FAQS.map((faq, index) => (
            <AnimatedSection key={faq.question} delay={Math.min(index, 5) * 0.05}>
              <motion.details
                className="group rounded-2xl border border-[#e9edf2] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition open:shadow-[0_12px_28px_rgba(15,23,42,0.08)]"
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2 }}
              >
                <summary className="cursor-pointer list-none text-base font-medium text-[#0f172a] marker:content-none">
                  <span className="flex items-center justify-between gap-3">
                    {faq.question}
                    <span className="mono flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition group-open:rotate-45">
                      +
                    </span>
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-6 text-[#64748b]">{faq.answer}</p>
              </motion.details>
            </AnimatedSection>
          ))}
        </div>

        <AnimatedSection className="mt-10">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#e9edf2] bg-[#f4f6f8] p-8 text-center">
            <p className="text-sm text-[#64748b]">
              Noch Fragen? Probier hantverkare einfach unverbindlich aus.
            </p>
            <Link
              href="/login"
              className="rounded-full bg-gradient-to-r from-blue-500 to-blue-700 px-6 py-3 text-sm font-medium text-white shadow-[0_6px_20px_rgba(37,99,235,0.35)] transition hover:from-blue-400 hover:to-blue-600"
            >
              Jetzt kostenlos starten
            </Link>
          </div>
        </AnimatedSection>
      </section>
    </MarketingShell>
  );
}
