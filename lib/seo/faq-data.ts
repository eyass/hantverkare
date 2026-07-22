/**
 * Single source of truth for the FAQ content shown on /faq. Both the page
 * (rendering the visible accordion) and the FAQPage JSON-LD schema import
 * this so the structured data can never drift from what's actually on the
 * page. The schema always uses the German (`question`/`answer`) fields,
 * matching this app's German-default marketing content; `questionEn`/
 * `answerEn` are additional fields used only by the optional client-side
 * EN toggle on the FAQ page and do not affect the schema.
 */
export const FAQS = [
  {
    question: "Wie funktioniert die KI-Kalkulation genau?",
    answer:
      "Du beschreibst den Auftrag per Text oder Sprache. Die KI gleicht die Beschreibung mit deiner hinterlegten Preisliste ab und schlägt passende Positionen mit Menge, Einheit und Preis vor. Du kannst jede Position vor dem Versand noch anpassen.",
    questionEn: "How does the AI pricing work exactly?",
    answerEn:
      "You describe the job by text or voice. The AI matches your description against your own price list and suggests line items with quantity, unit and price. You can adjust every line before sending.",
  },
  {
    question: "Muss ich vorher eine Preisliste anlegen?",
    answer:
      "Ja, für genaue KI-Vorschläge solltest du einmal deine Standardleistungen und Preise hinterlegen. Beim ersten Einrichten hilft dir ein Assistent mit Startkatalogen passend zu deinem Gewerk.",
    questionEn: "Do I need to set up a price list first?",
    answerEn:
      "Yes, for accurate AI suggestions you should set up your standard services and prices once. A setup wizard with starter catalogues for your trade helps you get started.",
  },
  {
    question: "Wie unterschreibt der Kunde?",
    answer:
      "Der Kunde erhält einen Link zum Angebot, prüft die Positionen und bestätigt direkt im Browser am Handy, Tablet oder Computer — ohne eigenes Konto. Die Bestätigung wird mit Zeitstempel gespeichert.",
    questionEn: "How does the customer sign?",
    answerEn:
      "The customer gets a link to the quote, reviews the line items and confirms directly in the browser on phone, tablet or computer — no account needed. The confirmation is stored with a timestamp.",
  },
  {
    question: "Wird aus dem Angebot automatisch eine Rechnung?",
    answer:
      "Sobald der Auftrag abgeschlossen ist, kannst du aus dem unterschriebenen Angebot mit einem Klick einen PDF-Rechnungsentwurf mit denselben Positionen erstellen — bereit für deine Buchhaltung.",
    questionEn: "Does the quote automatically become an invoice?",
    answerEn:
      "Once the job is done, you can turn the signed quote into a PDF invoice draft with the same line items with one click — ready for your bookkeeping.",
  },
  {
    question: "Was kostet hantverkare?",
    answer:
      "14 Tage kostenlos testen, danach 29 €/Monat zzgl. MwSt. Jederzeit monatlich kündbar, keine Mindestlaufzeit. Details findest du auf der Preise-Seite.",
    questionEn: "What does hantverkare cost?",
    answerEn:
      "14 days free, then €29/month plus VAT. Cancel monthly anytime, no minimum term. Details on the pricing page.",
  },
  {
    question: "Ist meine Preisliste sicher?",
    answer:
      "Deine Daten sind an dein Konto gebunden und für andere Nutzer nicht einsehbar. Wir setzen auf verschlüsselte Verbindungen und feingranulare Zugriffsrechte in unserer Datenbank.",
    questionEn: "Is my price list secure?",
    answerEn:
      "Your data is tied to your account and not visible to other users. We use encrypted connections and fine-grained access rules in our database.",
  },
  {
    question: "Kann ich hantverkare mit meinem Team nutzen?",
    answer:
      "Ja, du kannst weitere Mitglieder zu deinem Unternehmenskonto einladen, mit vom Konto-Inhaber festlegbaren Rechten. Preisliste, Kunden und Angebote werden im Team geteilt.",
    questionEn: "Can I use hantverkare with my team?",
    answerEn:
      "Yes, you can invite additional members to your company account, with permissions the owner can configure. Price list, customers and quotes are shared across the team.",
  },
  {
    question: "Kann ich Vorlagen für wiederkehrende Aufträge speichern?",
    answer:
      "Ja, du kannst häufige Positionsbündel als Vorlage speichern und bei neuen Angeboten wiederverwenden, statt sie jedes Mal neu zusammenzustellen.",
    questionEn: "Can I save templates for recurring jobs?",
    answerEn:
      "Yes, you can save common bundles of line items as a reusable template and reuse them on new quotes instead of building them from scratch each time.",
  },
  {
    question: "Funktioniert es mit meiner Buchhaltungssoftware?",
    answer:
      "hantverkare synchronisiert derzeit nicht direkt mit Buchhaltungsprogrammen. Du kannst aber jederzeit einen PDF-Rechnungsentwurf mit allen Positionen exportieren und an deinen Steuerberater oder in dein Buchhaltungsprogramm übernehmen. Kunden und Angebote lassen sich außerdem als CSV exportieren.",
    questionEn: "Does it work with my accounting software?",
    answerEn:
      "hantverkare doesn't currently sync directly with accounting software. You can always export a PDF invoice draft with all line items to hand to your accountant or import into your bookkeeping tool. Customers and quotes can also be exported as CSV.",
  },
  {
    question: "Für welche Gewerke ist hantverkare geeignet?",
    answer:
      "hantverkare eignet sich für Handwerksbetriebe aller Art — von Sanitär und Elektro über Maler bis Bodenleger. Die Preisliste passt sich mit Startkatalogen an dein Gewerk an.",
    questionEn: "Which trades is hantverkare suited for?",
    answerEn:
      "hantverkare suits trade businesses of all kinds — from plumbing and electrical to painting and flooring. The price list adapts with starter catalogues for your trade.",
  },
];
