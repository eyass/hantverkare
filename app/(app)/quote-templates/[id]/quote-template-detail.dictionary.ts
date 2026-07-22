import type { Dictionary } from "@/lib/i18n/dictionary";

export type QuoteTemplateDetailCopy = {
  back: string;
  title: string;
  nameLabel: string;
  itemsLabel: string;
  colLabel: string;
  colUnit: string;
  colQuantity: string;
  colPrice: string;
  removeItem: string;
  addItem: string;
  save: string;
  saved: string;
  historyTitle: string;
  historyEmpty: string;
  versionLabel: string;
  view: string;
  hide: string;
  restore: string;
};

export const QUOTE_TEMPLATE_DETAIL_DICTIONARY: Dictionary<QuoteTemplateDetailCopy> = {
  de: {
    back: "← Zurück zu Vorlagen",
    title: "Vorlage bearbeiten",
    nameLabel: "Name",
    itemsLabel: "Positionen",
    colLabel: "Bezeichnung",
    colUnit: "Einheit",
    colQuantity: "Menge",
    colPrice: "Preis (€)",
    removeItem: "Entfernen",
    addItem: "+ Position hinzufügen",
    save: "Speichern",
    saved: "Vorlage gespeichert.",
    historyTitle: "Versionsverlauf",
    historyEmpty: "Noch keine früheren Versionen — Änderungen werden ab der ersten Bearbeitung erfasst.",
    versionLabel: "Version",
    view: "Ansehen",
    hide: "Ausblenden",
    restore: "Wiederherstellen",
  },
  en: {
    back: "← Back to templates",
    title: "Edit template",
    nameLabel: "Name",
    itemsLabel: "Items",
    colLabel: "Label",
    colUnit: "Unit",
    colQuantity: "Quantity",
    colPrice: "Price (€)",
    removeItem: "Remove",
    addItem: "+ Add item",
    save: "Save",
    saved: "Template saved.",
    historyTitle: "Version history",
    historyEmpty: "No prior versions yet — changes are captured starting with the first edit.",
    versionLabel: "Version",
    view: "View",
    hide: "Hide",
    restore: "Restore",
  },
};
