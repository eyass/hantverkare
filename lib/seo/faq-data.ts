/**
 * Single source of truth for the FAQ content shown on /faq. Both the page
 * (rendering the visible accordion) and the FAQPage JSON-LD schema import
 * this so the structured data can never drift from what's actually on the
 * page.
 */
export const FAQS = [
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
