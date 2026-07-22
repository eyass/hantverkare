import type { Dictionary } from "@/lib/i18n/dictionary";

export type QuotesCopy = {
  title: string;
  exportQuotesCsv: string;
  exportInvoicesCsv: string;
  newQuote: string;
  statAll: string;
  statDrafts: string;
  statFinalSigned: string;
  filterAll: string;
  filterDrafts: string;
  filterFinal: string;
  emptyState: string;
  emptyStateCta: string;
  status: {
    draft: string;
    final: string;
    signed: string;
    declined: string;
  };
  upcomingJobsTitle: string;
  upcomingJobsViewAll: string;
  upcomingJobFallbackLabel: string;
};

export const QUOTES_DICTIONARY: Dictionary<QuotesCopy> = {
  de: {
    title: "Angebote",
    exportQuotesCsv: "Angebote als CSV exportieren",
    exportInvoicesCsv: "Rechnungen als CSV exportieren",
    newQuote: "Neues Angebot",
    statAll: "Alle Angebote",
    statDrafts: "Entwürfe",
    statFinalSigned: "Final/Signiert",
    filterAll: "Alle",
    filterDrafts: "Entwürfe",
    filterFinal: "Final",
    emptyState: "Noch keine Angebote vorhanden.",
    emptyStateCta: "Jetzt erstellen",
    status: {
      draft: "Entwurf",
      final: "Final",
      signed: "Signiert",
      declined: "Abgelehnt",
    },
    upcomingJobsTitle: "Anstehende Termine",
    upcomingJobsViewAll: "Alle Termine ansehen",
    upcomingJobFallbackLabel: "Auftrag",
  },
  en: {
    title: "Quotes",
    exportQuotesCsv: "Export quotes as CSV",
    exportInvoicesCsv: "Export invoices as CSV",
    newQuote: "New quote",
    statAll: "All quotes",
    statDrafts: "Drafts",
    statFinalSigned: "Final/Signed",
    filterAll: "All",
    filterDrafts: "Drafts",
    filterFinal: "Final",
    emptyState: "No quotes yet.",
    emptyStateCta: "Create one now",
    status: {
      draft: "Draft",
      final: "Final",
      signed: "Signed",
      declined: "Declined",
    },
    upcomingJobsTitle: "Upcoming appointments",
    upcomingJobsViewAll: "View all appointments",
    upcomingJobFallbackLabel: "Job",
  },
};
