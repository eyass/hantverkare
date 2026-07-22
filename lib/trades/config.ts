// Static content config for the programmatic trade landing pages
// (`/handwerker/[trade]`, see GitHub issue #85). Each entry mirrors the real
// trade catalog seeded in `supabase/migrations/0011_price_list_templates.sql`
// (trade labels, line items, unit prices) so the copy on these pages matches
// what a user actually sees in the price-list-wizard after signup.
//
// This is intentionally a static/hardcoded mapping rather than a live read
// from `price_list_templates` at request time: these are public marketing
// pages (no auth) and the interactive demo on them must stay fully
// client-side with zero DB/AI calls (see lib/demo/mockQuote.ts). Re-sync this
// file by hand if the migration's seed data changes.

import type { DemoJobId } from "@/lib/demo/mockQuote";

export type TradeSlug = "maler" | "elektriker" | "sanitaer-heizung" | "bodenleger";

export type TradeExampleItem = {
  label: string;
  unit: string;
  /** Matches `default_unit_price_cents` for this item in the seeded template. */
  priceCents: number;
};

export type TradeConfig = {
  slug: TradeSlug;
  /** Matches `trade_key` in `price_list_templates` for this trade. */
  tradeKey: string;
  /** Matches `trade_label` in `price_list_templates`. */
  label: string;
  /** Grammatical dative form used in running copy, e.g. "für Maler". */
  labelDative: string;
  heroTitle: string;
  heroDescription: string;
  metaTitle: string;
  metaDescription: string;
  /** Short intro copy for the "so funktioniert's für dein Gewerk" section. */
  introBody: string;
  /** Real example line items from the seeded price list template, for display. */
  exampleItems: TradeExampleItem[];
  /** Which canned demo job template(s) this trade's interactive demo should be biased toward. */
  demoJobIds: DemoJobId[];
  /** Prefilled example job description shown in the demo textarea. */
  demoDefaultDescription: string;
};

export const TRADE_CONFIGS: Record<TradeSlug, TradeConfig> = {
  maler: {
    slug: "maler",
    tradeKey: "maler",
    label: "Maler",
    labelDative: "Maler",
    heroTitle: "Angebote für Maler — in unter einer Minute.",
    heroDescription:
      "Beschreibe den Malerauftrag mit Stimme oder Text. Die KI erstellt sofort eine durchkalkulierte Positionsliste aus deiner Preisliste — Wände streichen, Tapezieren, Lackieren. Der Kunde unterschreibt digital, die Rechnung folgt automatisch.",
    metaTitle: "Angebote Software für Maler | hantverkare",
    metaDescription:
      "KI-gestützte Angebotssoftware für Malerbetriebe: Auftrag beschreiben, Angebot mit realistischen Malerpreisen in unter einer Minute erstellen, Kunde unterschreibt digital.",
    introBody:
      "Ob Wände streichen, Tapezieren oder Fenster lackieren — hinterlege einmal deine Malerpreise, und die KI schlägt bei jedem neuen Auftrag automatisch passende Positionen mit Menge und Preis vor.",
    exampleItems: [
      { label: "Wände streichen (Innenraum)", unit: "m²", priceCents: 1200 },
      { label: "Decke streichen", unit: "m²", priceCents: 1400 },
      { label: "Tapezieren", unit: "m²", priceCents: 1600 },
      { label: "Untergrund spachteln", unit: "m²", priceCents: 900 },
      { label: "Fenster/Türen lackieren", unit: "Stück", priceCents: 8500 },
    ],
    demoJobIds: ["painting"],
    demoDefaultDescription: "Wohnung streichen, Wände und Decke, ca. 60 m²",
  },
  elektriker: {
    slug: "elektriker",
    tradeKey: "elektriker",
    label: "Elektriker",
    labelDative: "Elektriker",
    heroTitle: "Angebote für Elektriker — in unter einer Minute.",
    heroDescription:
      "Beschreibe den Elektroauftrag mit Stimme oder Text. Die KI erstellt sofort eine durchkalkulierte Positionsliste aus deiner Preisliste — Steckdosen, Beleuchtung, Sicherungskasten. Der Kunde unterschreibt digital, die Rechnung folgt automatisch.",
    metaTitle: "Angebote Software für Elektriker | hantverkare",
    metaDescription:
      "KI-gestützte Angebotssoftware für Elektrobetriebe: Auftrag beschreiben, Angebot mit realistischen Elektriker-Preisen in unter einer Minute erstellen, Kunde unterschreibt digital.",
    introBody:
      "Ob Steckdosen tauschen, Deckenleuchten anschließen oder den Sicherungskasten prüfen — hinterlege einmal deine Elektriker-Preise, und die KI schlägt bei jedem neuen Auftrag automatisch passende Positionen vor.",
    exampleItems: [
      { label: "Steckdose setzen/tauschen", unit: "Stück", priceCents: 4500 },
      { label: "Lichtschalter setzen/tauschen", unit: "Stück", priceCents: 4000 },
      { label: "Deckenleuchte anschließen", unit: "Stück", priceCents: 6500 },
      { label: "Sicherungskasten prüfen/warten", unit: "Pauschale", priceCents: 12000 },
      { label: "Kabel verlegen (Unterputz)", unit: "m", priceCents: 1800 },
    ],
    demoJobIds: ["electrical"],
    demoDefaultDescription: "Steckdosen und Deckenleuchten erneuern, 6 Steckdosen und 3 Lampen",
  },
  "sanitaer-heizung": {
    slug: "sanitaer-heizung",
    tradeKey: "sanitaer_heizung",
    label: "Sanitär & Heizung",
    labelDative: "Sanitär- und Heizungsbetriebe",
    heroTitle: "Angebote für Sanitär & Heizung — in unter einer Minute.",
    heroDescription:
      "Beschreibe den Auftrag mit Stimme oder Text. Die KI erstellt sofort eine durchkalkulierte Positionsliste aus deiner Preisliste — Wasserhahn, WC, Heizungswartung. Der Kunde unterschreibt digital, die Rechnung folgt automatisch.",
    metaTitle: "Angebote Software für Sanitär & Heizung | hantverkare",
    metaDescription:
      "KI-gestützte Angebotssoftware für Sanitär- und Heizungsbetriebe: Auftrag beschreiben, Angebot mit realistischen Sanitär-Preisen in unter einer Minute erstellen, Kunde unterschreibt digital.",
    introBody:
      "Ob Wasserhahn tauschen, WC erneuern oder Heizungswartung — hinterlege einmal deine Sanitär- und Heizungspreise, und die KI schlägt bei jedem neuen Auftrag automatisch passende Positionen vor.",
    exampleItems: [
      { label: "Wasserhahn tauschen", unit: "Stück", priceCents: 9500 },
      { label: "WC tauschen", unit: "Stück", priceCents: 35000 },
      { label: "Heizkörper entlüften", unit: "Stück", priceCents: 3500 },
      { label: "Rohrleitung erneuern", unit: "m", priceCents: 4500 },
      { label: "Heizungswartung", unit: "Pauschale", priceCents: 15000 },
    ],
    demoJobIds: ["bathroom", "kitchen-faucet"],
    demoDefaultDescription: "Wasserhahn und WC austauschen, Bad",
  },
  bodenleger: {
    slug: "bodenleger",
    tradeKey: "bodenleger",
    label: "Bodenleger",
    labelDative: "Bodenleger",
    heroTitle: "Angebote für Bodenleger — in unter einer Minute.",
    heroDescription:
      "Beschreibe den Auftrag mit Stimme oder Text. Die KI erstellt sofort eine durchkalkulierte Positionsliste aus deiner Preisliste — Laminat, Vinyl, Sockelleisten. Der Kunde unterschreibt digital, die Rechnung folgt automatisch.",
    metaTitle: "Angebote Software für Bodenleger | hantverkare",
    metaDescription:
      "KI-gestützte Angebotssoftware für Bodenleger-Betriebe: Auftrag beschreiben, Angebot mit realistischen Bodenbelags-Preisen in unter einer Minute erstellen, Kunde unterschreibt digital.",
    introBody:
      "Ob Laminat verlegen, Vinylboden oder Sockelleisten montieren — hinterlege einmal deine Bodenleger-Preise, und die KI schlägt bei jedem neuen Auftrag automatisch passende Positionen vor.",
    exampleItems: [
      { label: "Laminat verlegen", unit: "m²", priceCents: 2500 },
      { label: "Vinylboden verlegen", unit: "m²", priceCents: 2800 },
      { label: "Alten Belag entfernen", unit: "m²", priceCents: 900 },
      { label: "Untergrund ausgleichen", unit: "m²", priceCents: 1100 },
      { label: "Sockelleisten montieren", unit: "m", priceCents: 700 },
    ],
    demoJobIds: ["flooring"],
    demoDefaultDescription: "Laminat verlegen, ca. 40 m², inkl. Sockelleisten",
  },
};

export const TRADE_SLUGS = Object.keys(TRADE_CONFIGS) as TradeSlug[];

export function getTradeConfig(slug: string): TradeConfig | undefined {
  return TRADE_CONFIGS[slug as TradeSlug];
}

export function formatItemPrice(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}
