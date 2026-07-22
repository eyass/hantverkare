// Client-side-only demo of the AI quote generation flow, used on the public
// marketing homepage so anonymous visitors can "try the tool" without any
// server/AI calls (see docs/superpowers/specs — landing page issue #47).
//
// This intentionally does NOT call the real /api generation endpoint: an
// unauthenticated visitor must never be able to trigger real AI-generation
// cost. Instead we match the free-text job description against a small set
// of canned job templates and return a plausible-looking priced line-item
// list, computed with the same VAT logic as the real product
// (see lib/quotes/pricing.ts).

export type DemoLineItem = {
  description: string;
  quantity: number;
  unit: string;
  unitPriceCents: number;
  lineTotalCents: number;
};

export type DemoQuote = {
  matchedJob: string;
  items: DemoLineItem[];
  subtotalCents: number;
  vatCents: number;
  totalCents: number;
};

const VAT_RATE = 0.19;

export type DemoJobId = "bathroom" | "kitchen-faucet" | "electrical" | "painting" | "flooring";

type JobTemplate = {
  id: DemoJobId;
  label: string;
  keywords: string[];
  items: Array<{ description: string; quantity: number; unit: string; unitPriceCents: number }>;
};

export const DEMO_JOB_TEMPLATES: JobTemplate[] = [
  {
    id: "bathroom",
    label: "Badezimmer renovieren",
    keywords: ["bad", "badezimmer", "dusche", "fliesen", "sanitär"],
    items: [
      { description: "Anfahrt & Baustelleneinrichtung", quantity: 1, unit: "Pauschale", unitPriceCents: 8000 },
      { description: "Altfliesen entfernen und entsorgen", quantity: 12, unit: "m²", unitPriceCents: 3500 },
      { description: "Neue Fliesen verlegen (Boden & Wand)", quantity: 18, unit: "m²", unitPriceCents: 6900 },
      { description: "Dusche und Armaturen montieren", quantity: 1, unit: "Pauschale", unitPriceCents: 45000 },
      { description: "Sanitärinstallation (Waschbecken, WC)", quantity: 6, unit: "Stunde", unitPriceCents: 6500 },
    ],
  },
  {
    id: "kitchen-faucet",
    label: "Küchenspüle & Wasserhahn austauschen",
    keywords: ["küche", "spüle", "wasserhahn", "armatur"],
    items: [
      { description: "Anfahrt", quantity: 1, unit: "Pauschale", unitPriceCents: 3500 },
      { description: "Alte Spüle und Armatur demontieren", quantity: 1, unit: "Stunde", unitPriceCents: 6500 },
      { description: "Neue Spüle montieren", quantity: 1, unit: "Stück", unitPriceCents: 18000 },
      { description: "Neuen Wasserhahn montieren", quantity: 1, unit: "Stück", unitPriceCents: 12000 },
      { description: "Anschluss & Dichtheitsprüfung", quantity: 1, unit: "Stunde", unitPriceCents: 6500 },
    ],
  },
  {
    id: "electrical",
    label: "Steckdosen und Beleuchtung erneuern",
    keywords: ["strom", "steckdose", "elektr", "beleuchtung", "lampe"],
    items: [
      { description: "Anfahrt", quantity: 1, unit: "Pauschale", unitPriceCents: 3500 },
      { description: "Steckdosen austauschen", quantity: 6, unit: "Stück", unitPriceCents: 4500 },
      { description: "Deckenleuchten montieren", quantity: 3, unit: "Stück", unitPriceCents: 5500 },
      { description: "Elektroinstallation prüfen", quantity: 2, unit: "Stunde", unitPriceCents: 7000 },
    ],
  },
  {
    id: "painting",
    label: "Wohnung streichen",
    keywords: ["streich", "maler", "farbe", "wand"],
    items: [
      { description: "Untergrund vorbereiten & abkleben", quantity: 1, unit: "Pauschale", unitPriceCents: 6000 },
      { description: "Wände streichen (2 Anstriche)", quantity: 60, unit: "m²", unitPriceCents: 1200 },
      { description: "Decken streichen", quantity: 25, unit: "m²", unitPriceCents: 1400 },
      { description: "Material (Farbe, Abdeckung)", quantity: 1, unit: "Pauschale", unitPriceCents: 15000 },
    ],
  },
  {
    id: "flooring",
    label: "Bodenbelag verlegen",
    keywords: ["boden", "parkett", "laminat", "vinyl"],
    items: [
      { description: "Alten Boden entfernen und entsorgen", quantity: 40, unit: "m²", unitPriceCents: 900 },
      { description: "Untergrund ausgleichen", quantity: 40, unit: "m²", unitPriceCents: 1100 },
      { description: "Neuen Bodenbelag verlegen", quantity: 40, unit: "m²", unitPriceCents: 2900 },
      { description: "Sockelleisten montieren", quantity: 25, unit: "Meter", unitPriceCents: 800 },
    ],
  },
];

const DEFAULT_TEMPLATE = DEMO_JOB_TEMPLATES[0];

function priceItem(item: {
  description: string;
  quantity: number;
  unit: string;
  unitPriceCents: number;
}): DemoLineItem {
  return { ...item, lineTotalCents: Math.round(item.quantity * item.unitPriceCents) };
}

export function getJobTemplateById(id: DemoJobId): JobTemplate {
  return DEMO_JOB_TEMPLATES.find((template) => template.id === id) ?? DEFAULT_TEMPLATE;
}

/**
 * Templates preferred for a given trade page (see lib/trades/config.ts
 * `demoJobIds`), in priority order. Used to bias `matchJobTemplate` on trade
 * landing pages so the demo stays on-topic even for ambiguous free text.
 */
export function getJobTemplatesForTrade(jobIds: DemoJobId[]): JobTemplate[] {
  return jobIds.map(getJobTemplateById);
}

/**
 * Very small keyword match — good enough for a canned demo, not a real
 * classifier. When `preferredJobIds` is given (trade landing pages), matches
 * are restricted to that trade's templates first; only if none of them score
 * at all do we fall back to the full template set, and finally to the first
 * preferred template (or the global default) if nothing matches at all.
 */
export function matchJobTemplate(description: string, preferredJobIds?: DemoJobId[]): JobTemplate {
  const text = description.trim().toLowerCase();
  const fallback = preferredJobIds?.length ? getJobTemplateById(preferredJobIds[0]) : DEFAULT_TEMPLATE;
  if (!text) return fallback;

  function bestMatch(candidates: JobTemplate[]): { template: JobTemplate; score: number } | null {
    let best: { template: JobTemplate; score: number } | null = null;
    for (const template of candidates) {
      const score = template.keywords.reduce((count, keyword) => (text.includes(keyword) ? count + 1 : count), 0);
      if (score > 0 && (!best || score > best.score)) {
        best = { template, score };
      }
    }
    return best;
  }

  if (preferredJobIds?.length) {
    const preferred = bestMatch(getJobTemplatesForTrade(preferredJobIds));
    if (preferred) return preferred.template;
  }

  const global = bestMatch(DEMO_JOB_TEMPLATES);
  return global?.template ?? fallback;
}

export function generateDemoQuote(description: string, preferredJobIds?: DemoJobId[]): DemoQuote {
  const template = matchJobTemplate(description, preferredJobIds);
  const items = template.items.map(priceItem);
  const subtotalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
  const vatCents = Math.round(subtotalCents * VAT_RATE);
  const totalCents = subtotalCents + vatCents;
  return { matchedJob: template.label, items, subtotalCents, vatCents, totalCents };
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}
