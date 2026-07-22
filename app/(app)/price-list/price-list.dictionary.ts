import type { Dictionary } from "@/lib/i18n/dictionary";

export type PriceListCopy = {
  title: string;
  colLabel: string;
  colUnit: string;
  colPrice: string;
  colCategory: string;
  delete: string;
  newItemTitle: string;
  labelPlaceholder: string;
  unitPlaceholder: string;
  pricePlaceholder: string;
  categoryPlaceholder: string;
  addItem: string;
  back: string;
  apply: string;
  wizardTitle: string;
  wizardDescription: string;
  startBlank: string;
};

export const PRICE_LIST_DICTIONARY: Dictionary<PriceListCopy> = {
  de: {
    title: "Preisliste",
    colLabel: "Bezeichnung",
    colUnit: "Einheit",
    colPrice: "Preis (EUR)",
    colCategory: "Kategorie",
    delete: "Löschen",
    newItemTitle: "Neue Position",
    labelPlaceholder: "Bezeichnung",
    unitPlaceholder: "Einheit",
    pricePlaceholder: "Preis (EUR)",
    categoryPlaceholder: "Kategorie",
    addItem: "Position hinzufügen",
    back: "Zurück",
    apply: "Übernehmen",
    wizardTitle: "Preisliste einrichten",
    wizardDescription:
      "Wähle dein Gewerk für eine vorausgefüllte Preisliste, die du vor dem Speichern anpassen kannst.",
    startBlank: "Leer starten",
  },
  en: {
    title: "Price list",
    colLabel: "Description",
    colUnit: "Unit",
    colPrice: "Price (EUR)",
    colCategory: "Category",
    delete: "Delete",
    newItemTitle: "New item",
    labelPlaceholder: "Description",
    unitPlaceholder: "Unit",
    pricePlaceholder: "Price (EUR)",
    categoryPlaceholder: "Category",
    addItem: "Add item",
    back: "Back",
    apply: "Apply",
    wizardTitle: "Set up your price list",
    wizardDescription:
      "Choose your trade for a pre-filled price list you can adjust before saving.",
    startBlank: "Start blank",
  },
};
