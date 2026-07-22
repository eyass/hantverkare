import type { Dictionary } from "@/lib/i18n/dictionary";

export type AppShellCopy = {
  nav: {
    quotes: string;
    schedule: string;
    customers: string;
    priceList: string;
    quoteTemplates: string;
    invoices: string;
    reports: string;
    settings: string;
    team: string;
    dangerZone: string;
  };
  signOut: string;
};

export const APP_SHELL_DICTIONARY: Dictionary<AppShellCopy> = {
  de: {
    nav: {
      quotes: "Angebote",
      schedule: "Termine",
      customers: "Kunden",
      priceList: "Preisliste",
      quoteTemplates: "Vorlagen",
      invoices: "Zahlungsabgleich",
      reports: "Berichte",
      settings: "Einstellungen",
      team: "Team",
      dangerZone: "Danger Zone",
    },
    signOut: "Abmelden",
  },
  en: {
    nav: {
      quotes: "Quotes",
      schedule: "Schedule",
      customers: "Customers",
      priceList: "Price list",
      quoteTemplates: "Templates",
      invoices: "Reconciliation",
      reports: "Reports",
      settings: "Settings",
      team: "Team",
      dangerZone: "Danger Zone",
    },
    signOut: "Sign out",
  },
};
