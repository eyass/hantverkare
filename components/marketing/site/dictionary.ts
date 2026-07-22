/**
 * Bilingual (DE/EN) copy for the 5 public marketing pages only
 * (/, /tool, /pricing, /faq, /about). German is the default language,
 * matching the rest of this app (blog, trade pages, authenticated product
 * are German-only); English is available purely as an optional toggle.
 *
 * IMPORTANT — content policy: this dictionary intentionally does NOT
 * reproduce several dishonest/legal-risk elements present in the original
 * "Quotely" design mockup it was adapted from:
 *  - no "§35a Handwerkerbonus" feature claim (does not exist in the product)
 *  - no named accounting-software integrations (DATEV/Lexware/sevDesk) —
 *    the product only produces a downloadable PDF invoice draft
 *  - no "eIDAS-compliant" certification claim — signatures are described
 *    with the same hedged language already used in
 *    content/blog/digitale-unterschrift-handwerksbetriebe-recht.md
 *  - no fabricated usage stats (2,400+ users / 4.9 rating / 61s / 3.2h) —
 *    replaced with the real, already-established figures used elsewhere
 *    in this app's marketing copy (see app/page.tsx STATS)
 *  - no fabricated legal/company details in the footer copyright line
 *  - no 3-tier pricing — the real backend only has one plan
 *  - testimonials kept but explicitly labelled as illustrative, not real
 */

export type Language = "de" | "en";

export const DICTIONARY = {
  de: {
    nav: {
      how: "So funktioniert's",
      pricing: "Preise",
      blog: "Blog",
      faq: "FAQ",
      about: "Über uns",
    },
    header: {
      signin: "Anmelden",
      startFree: "Kostenlos starten",
    },
    hero: {
      badge: "Für das deutsche Handwerk",
      h1: "Auftrag besprechen. Angebot senden.",
      sub: "Beschreibe jeden Auftrag per Sprache oder Text — hantverkare erstellt sofort ein vollständiges Angebot aus deiner eigenen Preisliste, bereit zur Unterschrift auf dem Handy deines Kunden.",
      cta1: "Kostenlos starten – keine Karte",
      cta2: "So funktioniert's",
      statLine: "< 1 Minute statt 1 Stunde für ein Angebot · 14 Tage kostenlos testen",
      phoneTitle: "Auftrag beschreiben",
      listening: "hört zu…",
      recognised: "✓ erkannt",
      replay: "Demo erneut abspielen",
      itemsTitle: "Angebot",
      subtotal: "Zwischensumme",
      vat: "zzgl. MwSt.",
      total: "Gesamt",
    },
    trust: {
      label: "Gebaut für",
      items: ["DSGVO-konform", "EU-Datenhosting", "Made in Germany"],
    },
    features: {
      head: "Angebote, die früher eine Stunde dauerten – erledigt auf der Heimfahrt",
      sub: "Keine Vorlagen, kein Laptop, kein Rechnen. Einfach sprechen.",
      items: [
        {
          title: "Sprechen statt tippen",
          body: "Beschreibe den Auftrag per Sprachmemo oder Text. hantverkare macht daraus automatisch eine aufgeschlüsselte Positionsliste.",
        },
        {
          title: "Kalkulation aus deiner Preisliste",
          body: "Material und Arbeitszeit werden automatisch mit deinen hinterlegten Preisen berechnet — inklusive Startkatalogen passend zu deinem Gewerk.",
        },
        {
          title: "Sofort unterschrieben",
          body: "Per Link senden, der Kunde unterschreibt digital, und ein PDF-Rechnungsentwurf landet fertig für deine Buchhaltung.",
        },
      ],
    },
    calc: {
      head: "Sieh, was hantverkare dir zurückgibt",
      sub: "Stelle die Regler auf deine Realität.",
      q1: "Angebote pro Woche",
      q2: "Minuten pro Angebot heute",
      q3: "Durchschnittlicher Auftragswert",
      r1: "Gesparte Stunden pro Jahr",
      hrsUnit: "Std.",
      r2: "Mehrumsatz durch schnelleres Anbieten",
      note: "Schätzung: Annahme ist, dass hantverkare die Angebotszeit um ~85 % verkürzt und ein zusätzlich gewonnener Auftrag pro Monat durch schnelleres Anbieten entsteht. Kein Versprechen, nur ein Rechenbeispiel.",
    },
    steps: {
      head: "Vom gesprochenen Wort zum unterschriebenen Auftrag",
      sub: "Drei Schritte. Wenige Minuten.",
      tag: "SCHRITT",
      items: [
        { title: "Beschreiben", body: "Tippe aufs Mikrofon und schildere den Auftrag wie einem Kollegen vor Ort." },
        { title: "Angebot prüfen", body: "hantverkare kalkuliert mit deinen eigenen Sätzen. Eine Position anpassen, fertig." },
        { title: "Senden & unterschreiben", body: "Der Kunde öffnet den Link und unterschreibt digital. Du erhältst den Rechnungsentwurf." },
      ],
    },
    testimonials: {
      head: "So könnte es aussehen",
      caption: "Beispielhafte Darstellung — keine verifizierten Kundenstimmen.",
      items: [
        {
          quote: "„Ich gewinne mehr Aufträge, weil ich sofort vor Ort anbiete. Der Kunde unterschreibt, bevor ich mein Werkzeug eingepackt habe.“",
          name: "Beispiel: Sanitärbetrieb",
          role: "Illustrative Darstellung",
          initials: "SB",
          avBg: "#eef2ff",
          avFg: "#2563eb",
        },
        {
          quote: "„Aus einer Stunde Papierkram ist ein Zwei-Minuten-Gespräch im Transporter geworden.“",
          name: "Beispiel: Elektrobetrieb",
          role: "Illustrative Darstellung",
          initials: "EB",
          avBg: "#ecfdf5",
          avFg: "#059669",
        },
        {
          quote: "„Meine Kunden schätzen, dass sie direkt auf dem Handy unterschreiben können.“",
          name: "Beispiel: Malerbetrieb",
          role: "Illustrative Darstellung",
          initials: "MB",
          avBg: "#fef3c7",
          avFg: "#b45309",
        },
      ],
    },
    security: {
      kicker: "SICHERHEIT & DATENSCHUTZ",
      head: "Nach deutschen Standards gebaut",
      sub: "Deine Daten und die Bestätigungen deiner Kunden werden so behandelt, wie es das deutsche Geschäft verlangt.",
      items: [
        {
          title: "DSGVO-konform",
          body: "Vollständig DSGVO-konform. Du behältst die Kontrolle über deine Daten und kannst sie jederzeit exportieren oder löschen.",
        },
        {
          title: "EU-Datenhosting",
          body: "Alle Daten werden in Rechenzentren innerhalb der EU gespeichert.",
        },
        {
          title: "Digitale Bestätigung mit Zeitstempel",
          body: "Kunden bestätigen Angebote digital im Browser, mit Zeitstempel gespeichert — im Einklang mit der im deutschen Vertragsrecht üblichen Formfreiheit für die meisten Handwerksaufträge. Für Verträge mit besonderen Formanforderungen empfehlen wir individuelle Rechtsberatung.",
        },
        {
          title: "Verschlüsselt",
          body: "Jedes Angebot und jede Bestätigung wird bei Übertragung und Speicherung verschlüsselt.",
        },
      ],
    },
    finalCta: {
      head: "Dein nächstes Angebot beginnt mit Hallo",
      sub: "14 Tage kostenlos. Keine Karte, keine Verpflichtung.",
      btn: "Kostenlos starten →",
    },
    sticky: {
      title: "hantverkare kostenlos testen",
      sub: "14 Tage, keine Karte",
    },
    cookie: {
      title: "Deine Privatsphäre ist uns wichtig",
      body: "Wir verwenden notwendige Cookies für den Betrieb und optionale Analyse-Cookies zur Verbesserung. Du entscheidest.",
      accept: "Alle akzeptieren",
      decline: "Nur notwendige",
    },
    how: {
      kicker: "SO FUNKTIONIERT'S",
      h1: "Ein Werkzeug für den ganzen Weg vom Angebot zur Rechnung",
      sub: "hantverkare begleitet den Auftrag vom ersten gesprochenen Wort bis zum Rechnungsentwurf.",
      blocks: [
        {
          step: "SCHRITT 01",
          title: "Auftrag besprechen",
          body: "App öffnen, einmal tippen und die Arbeit laut beschreiben oder eintippen — kein Formular, kein Laptop nötig.",
        },
        {
          step: "SCHRITT 02",
          title: "KI erstellt ein vollständiges Angebot",
          body: "Material wird mit deiner Preisliste abgeglichen (inklusive Startkatalogen für dein Gewerk), Arbeit mit deinem Stundensatz berechnet. In Sekunden ein vollständiges, bearbeitbares Angebot.",
        },
        {
          step: "SCHRITT 03",
          title: "Kunde unterschreibt digital",
          body: "Sende das Angebot per Link. Dein Kunde prüft es auf dem Handy und bestätigt digital mit Zeitstempel — oft noch vor Ort.",
        },
        {
          step: "SCHRITT 04",
          title: "Rechnungsentwurf, automatisch",
          body: "Sobald unterschrieben ist, erstellt hantverkare einen PDF-Rechnungsentwurf mit denselben Positionen — bereit für deine Buchhaltung.",
        },
      ],
      btn: "Kostenlos testen →",
    },
    pricing: {
      h1: "Ein einfacher Preis, der sich selbst bezahlt",
      sub: "Kein Tarif-Dschungel. Ein Plan, alle Funktionen, jederzeit kündbar.",
      badge: "14 Tage kostenlos",
      per: "/ Monat",
      vatNote: "zzgl. gesetzlicher MwSt., danach monatlich kündbar",
      cta: "14 Tage kostenlos starten",
      ctaNote: "Keine Kreditkarte für die Testphase nötig. Danach 29 €/Monat, jederzeit kündbar.",
      features: [
        "KI-gestützte Angebotserstellung per Sprache oder Text",
        "Unbegrenzte Angebote und Rechnungen",
        "Eigene Preisliste mit Startkatalogen je Gewerk",
        "Wiederverwendbare Angebotsvorlagen",
        "Digitale Bestätigung für deine Kunden",
        "Automatischer PDF-Rechnungsentwurf",
        "Team-Mitglieder mit konfigurierbaren Rechten einladen",
        "CSV-Export für Kunden und Angebote",
      ],
      compareHead: "Mit hantverkare, statt von Hand",
      withUs: "Mit hantverkare",
      withoutUs: "Der bisherige Weg",
      compareRows: [
        ["Angebot erstellen", "< 1 Minute per Sprache/Text", "Meist 30–60 Minuten am Laptop"],
        ["Kalkulation", "Automatisch aus deiner Preisliste", "Manuell nachrechnen"],
        ["Unterschrift", "Digital, direkt auf dem Handy", "Papier, Fax oder E-Mail-Hin-und-her"],
        ["Rechnung", "PDF-Entwurf automatisch aus dem Angebot", "Separat von Hand erstellen"],
      ],
      foot: "Ein Plan für alle. Keine versteckten Zusatzkosten je Nutzer. Preise zzgl. MwSt.",
    },
    faq: {
      h1: "Fragen, beantwortet",
      sub: "Noch Fragen? Schreib uns — wir antworten so schnell wie möglich.",
    },
    about: {
      kicker: "ÜBER UNS",
      h1: "Wir bauen für die mit Dreck an den Stiefeln",
      sub: "hantverkare entstand aus einer einfachen Beobachtung: Handwerker verlieren Abende an Papierkram, statt Zeit mit Familie oder dem eigentlichen Handwerk zu verbringen.",
      p1: "Handwerker sind brillant in ihrem Fach und hassen — völlig zu Recht — die Verwaltung. Jedes Angebot bedeutete Laptop, Vorlage und eine Stunde, die sie nicht hatten — also verzögerten sich Angebote, und verzögerte Angebote gehen oft an den, der zuerst antwortet.",
      p2: "Wir dachten: Die schnellste Schnittstelle für einen vielbeschäftigten Profi ist die, die er ohnehin den ganzen Tag nutzt — seine Stimme oder ein kurzer Text. Also haben wir ein Werkzeug gebaut, bei dem du den Auftrag beschreibst wie einem Kollegen, und das Angebot schreibt sich selbst — kalkuliert mit deinen eigenen Sätzen, sofort bereit zur Unterschrift.",
      stats: [
        { n: "< 1 Min", l: "statt 1 Stunde für ein Angebot" },
        { n: "14 Tage", l: "kostenlos & unverbindlich testen" },
        { n: "29 €/Mon.", l: "danach, jederzeit kündbar" },
      ],
      careersTitle: "Gestalte die Zukunft des Handwerks mit",
      careersBody: "Wir sind ein kleines Team, immer offen für Menschen, denen Handwerk am Herzen liegt.",
      careersLink: "Offene Stellen ansehen",
    },
    footer: {
      tag: "Sprach- und textbasierte Angebote für das deutsche Handwerk.",
      product: "Produkt",
      company: "Unternehmen",
      legal: "Rechtliches",
      openApp: "App öffnen",
      contact: "Kontakt",
      privacy: "Datenschutz",
      terms: "AGB",
      gdpr: "DSGVO",
      copy: `© ${new Date().getFullYear()} hantverkare`,
    },
  },
  en: {
    nav: {
      how: "How it works",
      pricing: "Pricing",
      blog: "Blog",
      faq: "FAQ",
      about: "About",
    },
    header: {
      signin: "Sign in",
      startFree: "Start free",
    },
    hero: {
      badge: "Built for German tradespeople",
      h1: "Speak the job. Send the quote.",
      sub: "Describe any job by voice or text — hantverkare writes a complete quote from your own price list in moments, ready for your customer to sign on their phone.",
      cta1: "Start free — no card",
      cta2: "See how it works",
      statLine: "< 1 minute instead of 1 hour per quote · 14 days free trial",
      phoneTitle: "Describe the job",
      listening: "listening…",
      recognised: "✓ recognised",
      replay: "Replay demo",
      itemsTitle: "Quote",
      subtotal: "Subtotal",
      vat: "plus VAT",
      total: "Total",
    },
    trust: {
      label: "Built for",
      items: ["GDPR compliant", "EU data hosting", "Made in Germany"],
    },
    features: {
      head: "Quotes that used to take an hour, done on the drive home",
      sub: "No templates to fill, no laptop, no maths. Just talk.",
      items: [
        {
          title: "Talk, don't type",
          body: "Describe the job by voice memo or text. hantverkare turns it into an itemised line list automatically.",
        },
        {
          title: "Priced from your own price list",
          body: "Materials and labour are calculated from your own rates — including starter catalogues matched to your trade.",
        },
        {
          title: "Signed on the spot",
          body: "Send by link, the customer signs digitally, and a PDF invoice draft lands ready for your bookkeeping.",
        },
      ],
    },
    calc: {
      head: "See what hantverkare gives back",
      sub: "Move the sliders to your reality.",
      q1: "Quotes you write per week",
      q2: "Minutes each one takes today",
      q3: "Average job value",
      r1: "Hours saved per year",
      hrsUnit: "hrs",
      r2: "Extra revenue from faster quoting",
      note: "An estimate: assumes hantverkare cuts quoting time by ~85% and one extra won job per month from quoting faster. Not a guarantee, just a worked example.",
    },
    steps: {
      head: "From spoken word to signed job",
      sub: "Three steps. A few minutes.",
      tag: "STEP",
      items: [
        { title: "Describe it", body: "Tap the mic and talk through the job like you would to a colleague on site." },
        { title: "Review the quote", body: "hantverkare prices it from your own rates. Tweak a line, done." },
        { title: "Send & sign", body: "Customer opens the link and signs digitally. You get the invoice draft." },
      ],
    },
    testimonials: {
      head: "What this could look like for you",
      caption: "Illustrative example — not verified customer reviews.",
      items: [
        {
          quote: "\"I win more jobs because I quote on the spot. The customer signs before I've packed up my tools.\"",
          name: "Example: plumbing business",
          role: "Illustrative example",
          initials: "PB",
          avBg: "#eef2ff",
          avFg: "#2563eb",
        },
        {
          quote: "\"An hour of paperwork is now a two-minute chat in the van.\"",
          name: "Example: electrical business",
          role: "Illustrative example",
          initials: "EB",
          avBg: "#ecfdf5",
          avFg: "#059669",
        },
        {
          quote: "\"My customers love that they can sign right there on their phone.\"",
          name: "Example: painting business",
          role: "Illustrative example",
          initials: "PB",
          avBg: "#fef3c7",
          avFg: "#b45309",
        },
      ],
    },
    security: {
      kicker: "SECURITY & PRIVACY",
      head: "Built to German standards",
      sub: "Your data and your customers' confirmations are handled the way German business demands.",
      items: [
        {
          title: "GDPR compliant",
          body: "Fully GDPR-compliant. You stay in control of your data and can export or delete it anytime.",
        },
        {
          title: "EU data hosting",
          body: "All data is stored in data centres inside the EU.",
        },
        {
          title: "Timestamped digital confirmation",
          body: "Customers confirm quotes digitally in the browser, stored with a timestamp — in line with the general freedom-of-form principle in German contract law for most trade jobs. For contracts with special form requirements, we recommend individual legal advice.",
        },
        {
          title: "Encrypted",
          body: "Every quote and confirmation is encrypted in transit and at rest.",
        },
      ],
    },
    finalCta: {
      head: "Your next quote starts with hello",
      sub: "Free for 14 days. No card, no commitment.",
      btn: "Start free →",
    },
    sticky: {
      title: "Try hantverkare free",
      sub: "14 days, no card",
    },
    cookie: {
      title: "We value your privacy",
      body: "We use essential cookies to run the site and optional analytics to improve it. You choose.",
      accept: "Accept all",
      decline: "Essential only",
    },
    how: {
      kicker: "HOW IT WORKS",
      h1: "One tool for the whole quote-to-invoice trip",
      sub: "hantverkare follows the job from the first word you speak to the invoice draft.",
      blocks: [
        {
          step: "STEP 01",
          title: "Describe the job",
          body: "Open the app, tap once, and describe the work out loud or type it — no forms, no laptop needed.",
        },
        {
          step: "STEP 02",
          title: "AI builds a complete quote",
          body: "Materials are matched to your price list (including starter catalogues for your trade), labour is calculated at your hourly rate. A full, editable quote in seconds.",
        },
        {
          step: "STEP 03",
          title: "Customer signs digitally",
          body: "Send the quote by link. Your customer reviews it on their phone and confirms digitally with a timestamp — often before you've left the driveway.",
        },
        {
          step: "STEP 04",
          title: "Invoice draft, automatically",
          body: "The moment it's signed, hantverkare creates a PDF invoice draft with the same line items — ready for your bookkeeping.",
        },
      ],
      btn: "Try it free →",
    },
    pricing: {
      h1: "One simple price that pays for itself",
      sub: "No tier jungle. One plan, every feature, cancel anytime.",
      badge: "14 days free",
      per: "/ month",
      vatNote: "plus statutory VAT, cancel monthly after the trial",
      cta: "Start 14 days free",
      ctaNote: "No card required for the trial. €29/month after, cancel anytime.",
      features: [
        "AI-assisted quote generation by voice or text",
        "Unlimited quotes and invoices",
        "Your own price list with starter catalogues per trade",
        "Reusable quote templates",
        "Digital confirmation for your customers",
        "Automatic PDF invoice draft",
        "Invite team members with configurable permissions",
        "CSV export for customers and quotes",
      ],
      compareHead: "With hantverkare, instead of by hand",
      withUs: "With hantverkare",
      withoutUs: "The old way",
      compareRows: [
        ["Writing a quote", "< 1 minute by voice/text", "Usually 30–60 minutes at a laptop"],
        ["Pricing", "Automatic from your price list", "Recalculate by hand"],
        ["Signature", "Digital, right on the phone", "Paper, fax, or emailing PDFs back and forth"],
        ["Invoice", "PDF draft automatically from the quote", "Created separately by hand"],
      ],
      foot: "One plan for everyone. No hidden per-user costs. Prices plus VAT.",
    },
    faq: {
      h1: "Questions, answered",
      sub: "Still stuck? Get in touch — we reply as fast as we can.",
    },
    about: {
      kicker: "ABOUT",
      h1: "We build for the ones with dirt on their boots",
      sub: "hantverkare started from a simple observation: tradespeople lose evenings to paperwork instead of spending time with family or their actual craft.",
      p1: "Tradespeople are brilliant at their craft and, quite reasonably, hate admin. Every quote meant a laptop, a template, and an hour they didn't have — so quotes got delayed, and delayed quotes often get lost to whoever answers first.",
      p2: "We thought the fastest interface for a busy professional is the one they already use all day: their voice, or a quick bit of text. So we built a tool where you describe the job like you'd explain it to a colleague, and the quote writes itself — priced from your own rates, ready to sign on the spot.",
      stats: [
        { n: "< 1 min", l: "instead of 1 hour per quote" },
        { n: "14 days", l: "free, no obligation" },
        { n: "€29/mo", l: "after that, cancel anytime" },
      ],
      careersTitle: "Come build the future of the trades",
      careersBody: "We're a small team, always keen to meet people who care about craft.",
      careersLink: "See open roles",
    },
    footer: {
      tag: "Voice- and text-based quoting for German tradespeople.",
      product: "Product",
      company: "Company",
      legal: "Legal",
      openApp: "Open the app",
      contact: "Contact",
      privacy: "Privacy",
      terms: "Terms",
      gdpr: "GDPR",
      copy: `© ${new Date().getFullYear()} hantverkare`,
    },
  },
} as const;
