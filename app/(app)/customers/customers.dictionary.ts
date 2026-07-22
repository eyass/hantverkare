import type { Dictionary } from "@/lib/i18n/dictionary";

export type CustomersCopy = {
  title: string;
  importCustomers: string;
  exportCsv: string;
  colName: string;
  colEmail: string;
  colPhone: string;
  colAddress: string;
  history: string;
  delete: string;
  newCustomerTitle: string;
  namePlaceholder: string;
  emailPlaceholder: string;
  phonePlaceholder: string;
  addressPlaceholder: string;
  addCustomer: string;
};

export const CUSTOMERS_DICTIONARY: Dictionary<CustomersCopy> = {
  de: {
    title: "Kunden",
    importCustomers: "Kunden importieren",
    exportCsv: "Als CSV exportieren",
    colName: "Name",
    colEmail: "E-Mail",
    colPhone: "Telefon",
    colAddress: "Adresse",
    history: "Verlauf",
    delete: "Löschen",
    newCustomerTitle: "Neuer Kunde",
    namePlaceholder: "Name",
    emailPlaceholder: "E-Mail",
    phonePlaceholder: "Telefon",
    addressPlaceholder: "Adresse",
    addCustomer: "Kunde hinzufügen",
  },
  en: {
    title: "Customers",
    importCustomers: "Import customers",
    exportCsv: "Export as CSV",
    colName: "Name",
    colEmail: "Email",
    colPhone: "Phone",
    colAddress: "Address",
    history: "History",
    delete: "Delete",
    newCustomerTitle: "New customer",
    namePlaceholder: "Name",
    emailPlaceholder: "Email",
    phonePlaceholder: "Phone",
    addressPlaceholder: "Address",
    addCustomer: "Add customer",
  },
};
