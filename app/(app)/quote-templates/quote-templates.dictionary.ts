import type { Dictionary } from "@/lib/i18n/dictionary";

export type QuoteTemplatesCopy = {
  title: string;
  newQuote: string;
  description: string;
  emptyState: string;
  colName: string;
  colItems: string;
  colCreated: string;
  delete: string;
};

export const QUOTE_TEMPLATES_DICTIONARY: Dictionary<QuoteTemplatesCopy> = {
  de: {
    title: "Angebotsvorlagen",
    newQuote: "Neues Angebot",
    description:
      "Speichere wiederkehrende Positionen (z. B. „Badezimmer Renovierung Standard“) als Vorlage bei einem Angebot und füge sie hier verwaltet oder beim Erstellen eines neuen Angebots wieder ein.",
    emptyState:
      "Noch keine Vorlagen gespeichert. Öffne ein Angebot und speichere seine Positionen als Vorlage.",
    colName: "Name",
    colItems: "Positionen",
    colCreated: "Erstellt",
    delete: "Löschen",
  },
  en: {
    title: "Quote templates",
    newQuote: "New quote",
    description:
      "Save recurring line items (e.g. \"Standard bathroom renovation\") as a template from a quote, then reuse them here or when creating a new quote.",
    emptyState: "No templates saved yet. Open a quote and save its line items as a template.",
    colName: "Name",
    colItems: "Items",
    colCreated: "Created",
    delete: "Delete",
  },
};
