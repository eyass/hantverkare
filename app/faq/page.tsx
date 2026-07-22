import Link from "next/link";
import { MarketingShell } from "@/components/MarketingShell";

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
      <section className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 pt-16 pb-10 text-center sm:px-8">
        <h1 className="text-3xl font-semibold tracking-tight text-[#0f172a] sm:text-4xl">
          Häufig gestellte Fragen
        </h1>
        <p className="max-w-xl text-lg leading-8 text-[#64748b]">
          Antworten auf die wichtigsten Fragen rund um hantverkare.
        </p>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-8">
        <div className="flex flex-col gap-4">
          {FAQS.map((faq) => (
            <details
              key={faq.question}
              className="group rounded-2xl border border-[#e9edf2] bg-white p-5 shadow-sm open:shadow-md"
            >
              <summary className="cursor-pointer list-none text-base font-medium text-[#0f172a] marker:content-none">
                <span className="flex items-center justify-between gap-3">
                  {faq.question}
                  <span className="mono shrink-0 text-[#94a3b8] transition group-open:rotate-45">+</span>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-6 text-[#64748b]">{faq.answer}</p>
            </details>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-[#e9edf2] bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-[#64748b]">Noch Fragen? Probier hantverkare einfach unverbindlich aus.</p>
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
