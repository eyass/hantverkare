"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import type { OnboardingChecklistState } from "@/lib/organizations/getOnboardingChecklist";

const DISMISSED_KEY = "hantverkare:onboarding-checklist-dismissed";

function subscribeToDismissed(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function readDismissed(): boolean {
  return window.localStorage.getItem(DISMISSED_KEY) === "1";
}

function readDismissedOnServer(): boolean {
  // The server has no localStorage; always render as "not dismissed" so the
  // hydrated client markup matches, then useSyncExternalStore reconciles the
  // real value client-side without an effect + setState round trip.
  return false;
}

type ChecklistItem = {
  key: keyof OnboardingChecklistState;
  label: string;
  description: string;
  href: string;
  cta: string;
};

const ITEMS: ChecklistItem[] = [
  {
    key: "hasBusinessSettings",
    label: "Unternehmensdaten hinterlegen",
    description: "Firmenname, Adresse und Steuernummer für Angebote und Rechnungen.",
    href: "/settings",
    cta: "Einstellungen öffnen",
  },
  {
    key: "hasPriceListItems",
    label: "Preisliste anlegen",
    description: "Eigene Positionen erfassen oder eine Gewerke-Vorlage im Assistenten nutzen.",
    href: "/price-list",
    cta: "Preisliste öffnen",
  },
  {
    key: "hasQuote",
    label: "Erstes Angebot erstellen",
    description: "In unter einer Minute ein Angebot beschreiben und berechnen lassen.",
    href: "/quotes/new",
    cta: "Angebot erstellen",
  },
  {
    key: "hasTeamMember",
    label: "Teammitglied einladen",
    description: "Kolleg:innen einladen, damit alle gemeinsam an Angeboten arbeiten können.",
    href: "/settings/team",
    cta: "Team verwalten",
  },
];

/**
 * Dismissible onboarding checklist for brand-new orgs (issue #74).
 *
 * Completion state is entirely COMPUTED server-side (see
 * getOnboardingChecklistState) from existing tables -- no "completed" column
 * anywhere. Dismissal, by contrast, has no natural derived signal, so it's a
 * plain localStorage flag: no migration, resets per-browser, which is an
 * acceptable v1 tradeoff since the checklist already auto-hides for good once
 * all four items are done. Persistent (server-side) dismissal would mostly
 * matter for someone who wants to hide it before finishing -- a narrower case
 * we can revisit later if it turns out to matter.
 */
export function OnboardingChecklist({ state }: { state: OnboardingChecklistState }) {
  const items = ITEMS.map((item) => ({ ...item, done: state[item.key] }));
  const doneCount = items.filter((item) => item.done).length;
  const allDone = doneCount === items.length;

  const dismissed = useSyncExternalStore(
    subscribeToDismissed,
    readDismissed,
    readDismissedOnServer,
  );

  if (allDone || dismissed) {
    return null;
  }

  function handleDismiss() {
    window.localStorage.setItem(DISMISSED_KEY, "1");
    // Same-tab writes don't fire the "storage" event, so nudge this tab's
    // subscribers directly.
    window.dispatchEvent(new StorageEvent("storage"));
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[#e9edf2] bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-[#0f172a]">Erste Schritte</h2>
          <p className="text-sm text-[#64748b]">
            {doneCount} von {items.length} erledigt — so richtest du hantverkare in wenigen
            Minuten ein.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-full px-3 py-1.5 text-sm text-[#64748b] transition-colors hover:bg-[#f4f6f8]"
          aria-label="Checkliste ausblenden"
        >
          Ausblenden
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.key}
            className={`flex items-center justify-between gap-4 rounded-xl border border-[#e9edf2] p-3 ${
              item.done ? "bg-[#f4f6f8]" : "bg-white"
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  item.done
                    ? "bg-[#dcfce7] text-[#16a34a]"
                    : "border border-[#e9edf2] text-[#94a3b8]"
                }`}
              >
                {item.done ? "✓" : ""}
              </span>
              <div className="flex flex-col">
                <span
                  className={`text-sm font-medium ${
                    item.done ? "text-[#64748b] line-through" : "text-[#0f172a]"
                  }`}
                >
                  {item.label}
                </span>
                <span className="text-xs text-[#94a3b8]">{item.description}</span>
              </div>
            </div>
            {!item.done ? (
              <Link
                href={item.href}
                className="shrink-0 rounded-full bg-[#2563eb] px-4 py-1.5 text-xs font-semibold text-white"
              >
                {item.cta}
              </Link>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
