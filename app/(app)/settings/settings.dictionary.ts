import type { Dictionary } from "@/lib/i18n/dictionary";

export type SettingsCopy = {
  businessTitle: string;
  saved: string;
  companyName: string;
  address: string;
  vatId: string;
  taxNumber: string;
  save: string;
  languageTitle: string;
  languageDescription: string;
  languageDe: string;
  languageEn: string;
  languageSaved: string;
  languageError: string;
  securityTitle: string;
  securityDescription: string;
  manage: string;
  referralTitle: string;
  referralDescription: string;
  copyLink: string;
  copied: string;
  exportTitle: string;
  exportDescription: string;
  exportButton: string;
};

export const SETTINGS_DICTIONARY: Dictionary<SettingsCopy> = {
  de: {
    businessTitle: "Unternehmensdaten",
    saved: "Gespeichert.",
    companyName: "Firmenname",
    address: "Adresse",
    vatId: "USt-IdNr.",
    taxNumber: "Steuernummer",
    save: "Speichern",
    languageTitle: "Sprache / Language",
    languageDescription: "Wähle die Sprache für die Bedienoberfläche.",
    languageDe: "Deutsch",
    languageEn: "English",
    languageSaved: "Sprache gespeichert.",
    languageError: "Sprache konnte nicht gespeichert werden.",
    securityTitle: "Sicherheit",
    securityDescription: "Zwei-Faktor-Authentifizierung einrichten oder verwalten.",
    manage: "Verwalten",
    referralTitle: "Dein Empfehlungslink",
    referralDescription:
      "Empfiehl uns weiter: Wenn sich jemand über deinen Link anmeldet und ein bezahltes Abo startet, bekommt ihr beide einen Monat kostenlos dazu.",
    copyLink: "Link kopieren",
    copied: "Kopiert!",
    exportTitle: "Meine Daten",
    exportDescription:
      "Lade eine vollständige Kopie aller Angebote, Kunden, Rechnungen und Preislisten deiner Organisation herunter (Art. 15 DSGVO).",
    exportButton: "Daten exportieren",
  },
  en: {
    businessTitle: "Company details",
    saved: "Saved.",
    companyName: "Company name",
    address: "Address",
    vatId: "VAT ID",
    taxNumber: "Tax number",
    save: "Save",
    languageTitle: "Sprache / Language",
    languageDescription: "Choose the language for the app interface.",
    languageDe: "Deutsch",
    languageEn: "English",
    languageSaved: "Language saved.",
    languageError: "Could not save language.",
    securityTitle: "Security",
    securityDescription: "Set up or manage two-factor authentication.",
    manage: "Manage",
    referralTitle: "Your referral link",
    referralDescription:
      "Refer us: when someone signs up via your link and starts a paid subscription, you both get a free month.",
    copyLink: "Copy link",
    copied: "Copied!",
    exportTitle: "My data",
    exportDescription:
      "Download a full copy of all quotes, customers, invoices, and price lists for your organization (GDPR Art. 15).",
    exportButton: "Export data",
  },
};
