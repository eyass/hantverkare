import type { Dictionary } from "@/lib/i18n/dictionary";

export type BillingCopy = {
  title: string;
  ownerManagedNotice: string;
  trialing: (endsAt: string | null) => string;
  active: string;
  inactive: (status: string) => string;
  none: string;
  subscribe: string;
  manage: string;
};

export const BILLING_DICTIONARY: Dictionary<BillingCopy> = {
  de: {
    title: "Abonnement",
    ownerManagedNotice:
      "Das Abonnement wird vom Inhaber deiner Organisation verwaltet. Bitte wende dich an den Inhaber, wenn du Fragen zur Abrechnung hast.",
    trialing: (endsAt) =>
      `Du befindest dich in der kostenlosen Testphase${endsAt ? ` bis zum ${endsAt}` : ""}. Danach kostet hantverkare 29 €/Monat.`,
    active: "Dein Abonnement ist aktiv. Vielen Dank!",
    inactive: (status) =>
      `Dein Abonnement ist derzeit nicht aktiv (Status: ${status}). Bitte abonniere erneut, um weiter Zugriff zu haben.`,
    none: "Du hast noch kein Abonnement.",
    subscribe: "Jetzt abonnieren (29 €/Monat)",
    manage: "Abonnement verwalten",
  },
  en: {
    title: "Subscription",
    ownerManagedNotice:
      "The subscription is managed by your organization's owner. Please contact them with any billing questions.",
    trialing: (endsAt) =>
      `You're on the free trial${endsAt ? ` until ${endsAt}` : ""}. After that, hantverkare costs €29/month.`,
    active: "Your subscription is active. Thank you!",
    inactive: (status) =>
      `Your subscription is currently inactive (status: ${status}). Please subscribe again to keep access.`,
    none: "You don't have a subscription yet.",
    subscribe: "Subscribe now (€29/month)",
    manage: "Manage subscription",
  },
};
