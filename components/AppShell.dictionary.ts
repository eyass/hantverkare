import type { Dictionary } from "@/lib/i18n/dictionary";

export type AppShellCopy = {
  nav: {
    quotes: string;
    customers: string;
    priceList: string;
    quoteTemplates: string;
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
      customers: "Kunden",
      priceList: "Preisliste",
      quoteTemplates: "Vorlagen",
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
      customers: "Customers",
      priceList: "Price list",
      quoteTemplates: "Templates",
      reports: "Reports",
      settings: "Settings",
      team: "Team",
      dangerZone: "Danger Zone",
    },
    signOut: "Sign out",
  },
};
