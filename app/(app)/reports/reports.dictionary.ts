import type { Dictionary } from "@/lib/i18n/dictionary";

export type ReportsCopy = {
  title: string;
  rangeThisMonth: string;
  rangeLastMonth: string;
  rangeThisQuarter: string;
  rangeThisYear: string;
  rangeCustom: string;
  rangeCustomFrom: string;
  rangeCustomTo: string;
  rangeCustomApply: string;
  tileTotalQuotes: string;
  tileDraft: string;
  tileFinal: string;
  tileSigned: string;
  tileConversionRate: string;
  tileRevenue: string;
  tileAvgSignedValue: string;
  profitabilityTitle: string;
  profitabilityEmpty: string;
  profitabilityRevenue: string;
  profitabilityCost: string;
  profitabilityMargin: string;
  profitabilityIncomplete: (withCost: number, total: number) => string;
  declinedTitle: string;
  declinedEmpty: string;
  declinedSummary: (count: number, totalLost: string) => string;
  declinedColDate: string;
  declinedColCustomer: string;
  declinedColReason: string;
  declinedColValue: string;
  declinedNoReason: string;
};

export const REPORTS_DICTIONARY: Dictionary<ReportsCopy> = {
  de: {
    title: "Auswertung",
    rangeThisMonth: "Dieser Monat",
    rangeLastMonth: "Letzter Monat",
    rangeThisQuarter: "Dieses Quartal",
    rangeThisYear: "Dieses Jahr",
    rangeCustom: "Benutzerdefiniert",
    rangeCustomFrom: "Von",
    rangeCustomTo: "Bis",
    rangeCustomApply: "Anwenden",
    tileTotalQuotes: "Angebote insgesamt",
    tileDraft: "Entwurf",
    tileFinal: "Final",
    tileSigned: "Signiert",
    tileConversionRate: "Abschlussquote",
    tileRevenue: "Umsatz (signiert)",
    tileAvgSignedValue: "Ø Wert pro signiertem Angebot",
    profitabilityTitle: "Profitabilität (intern)",
    profitabilityEmpty:
      "– Noch keine Kostendaten erfasst. Trage bei Angebotspositionen optional Kosten ein, um hier die Marge zu sehen.",
    profitabilityRevenue: "Umsatz (mit Kostendaten)",
    profitabilityCost: "Kosten",
    profitabilityMargin: "Rohertrag",
    profitabilityIncomplete: (withCost, total) =>
      `Hinweis: Nicht für alle Positionen sind Kosten hinterlegt (${withCost} von ${total}). Die Marge oben bezieht sich nur auf Positionen mit erfassten Kosten.`,
    declinedTitle: "Abgelehnte Angebote",
    declinedEmpty: "– Im aktuellen Zeitraum wurden keine Angebote abgelehnt.",
    declinedSummary: (count, totalLost) =>
      `${count} abgelehnte${count === 1 ? "s" : ""} Angebot${count === 1 ? "" : "e"} · ${totalLost} entgangener Wert`,
    declinedColDate: "Datum",
    declinedColCustomer: "Angebot",
    declinedColReason: "Grund",
    declinedColValue: "Wert",
    declinedNoReason: "– kein Grund angegeben –",
  },
  en: {
    title: "Reports",
    rangeThisMonth: "This month",
    rangeLastMonth: "Last month",
    rangeThisQuarter: "This quarter",
    rangeThisYear: "This year",
    rangeCustom: "Custom",
    rangeCustomFrom: "From",
    rangeCustomTo: "To",
    rangeCustomApply: "Apply",
    tileTotalQuotes: "Total quotes",
    tileDraft: "Draft",
    tileFinal: "Final",
    tileSigned: "Signed",
    tileConversionRate: "Conversion rate",
    tileRevenue: "Revenue (signed)",
    tileAvgSignedValue: "Avg. value per signed quote",
    profitabilityTitle: "Profitability (internal)",
    profitabilityEmpty:
      "– No cost data recorded yet. Optionally add costs on quote line items to see the margin here.",
    profitabilityRevenue: "Revenue (with cost data)",
    profitabilityCost: "Cost",
    profitabilityMargin: "Gross margin",
    profitabilityIncomplete: (withCost, total) =>
      `Note: not all line items have cost data (${withCost} of ${total}). The margin above only reflects items with recorded costs.`,
    declinedTitle: "Declined quotes",
    declinedEmpty: "– No quotes were declined in the current range.",
    declinedSummary: (count, totalLost) =>
      `${count} declined quote${count === 1 ? "" : "s"} · ${totalLost} in lost value`,
    declinedColDate: "Date",
    declinedColCustomer: "Quote",
    declinedColReason: "Reason",
    declinedColValue: "Value",
    declinedNoReason: "– no reason given –",
  },
};
