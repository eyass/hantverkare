import type { Dictionary } from "@/lib/i18n/dictionary";

export type AppShellCopy = {
  nav: {
    quotes: string;
    schedule: string;
    myJobs: string;
    contracts: string;
    customers: string;
    priceList: string;
    quoteTemplates: string;
    invoices: string;
    reports: string;
    settings: string;
    team: string;
    dangerZone: string;
  };
  navGroups: {
    work: string;
    business: string;
    admin: string;
  };
  signOut: string;
  more: string;
  closeMore: string;
  fieldMode: {
    /** Label shown next to the toggle control in both header and sidebar. */
    label: string;
    /** aria-label describing what enabling the toggle does. */
    toggleAriaLabel: string;
  };
};

export const APP_SHELL_DICTIONARY: Dictionary<AppShellCopy> = {
  de: {
    nav: {
      quotes: "Angebote",
      schedule: "Termine",
      myJobs: "Meine Jobs",
      contracts: "Wartungsverträge",
      customers: "Kunden",
      priceList: "Preisliste",
      quoteTemplates: "Vorlagen",
      invoices: "Zahlungsabgleich",
      reports: "Berichte",
      settings: "Einstellungen",
      team: "Team",
      dangerZone: "Gefahrenzone",
    },
    navGroups: {
      work: "Arbeit",
      business: "Geschäft",
      admin: "Verwaltung",
    },
    signOut: "Abmelden",
    more: "Mehr",
    closeMore: "Schließen",
    fieldMode: {
      label: "Baustellenmodus",
      toggleAriaLabel: "Baustellenmodus umschalten (größere Schaltflächen für Handschuhe)",
    },
  },
  en: {
    nav: {
      quotes: "Quotes",
      schedule: "Schedule",
      myJobs: "My jobs",
      contracts: "Contracts",
      customers: "Customers",
      priceList: "Price list",
      quoteTemplates: "Templates",
      invoices: "Reconciliation",
      reports: "Reports",
      settings: "Settings",
      team: "Team",
      dangerZone: "Danger zone",
    },
    navGroups: {
      work: "Work",
      business: "Business",
      admin: "Admin",
    },
    signOut: "Sign out",
    more: "More",
    closeMore: "Close",
    fieldMode: {
      label: "Field mode",
      toggleAriaLabel: "Toggle field mode (larger buttons for gloves)",
    },
  },
};
