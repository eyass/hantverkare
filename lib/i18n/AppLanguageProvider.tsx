"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { AppLanguage } from "./dictionary";

type AppLanguageContextValue = {
  language: AppLanguage;
  /** Updates the in-memory language immediately (for instant re-render);
   * callers are responsible for persisting the change server-side (see
   * app/(app)/settings/actions.ts's updateLanguage) and calling
   * router.refresh() so Server Components re-render with the new language
   * too. */
  setLanguage: (lang: AppLanguage) => void;
};

const AppLanguageContext = createContext<AppLanguageContextValue | null>(null);

/**
 * Client Context for the authenticated app's UI language (issue #116).
 *
 * Unlike the marketing site's LanguageProvider (which defaults to "de" and
 * applies a persisted localStorage preference one tick after mount, to
 * avoid a hydration mismatch), this provider is seeded with a
 * server-known `initialLanguage` -- read from `profiles.language` in
 * app/(app)/layout.tsx before any client code runs -- so there is no
 * flash-of-wrong-language on first paint.
 */
export function AppLanguageProvider({
  initialLanguage,
  children,
}: {
  initialLanguage: AppLanguage;
  children: ReactNode;
}) {
  const [language, setLanguage] = useState<AppLanguage>(initialLanguage);
  const value = useMemo<AppLanguageContextValue>(
    () => ({ language, setLanguage }),
    [language],
  );
  return <AppLanguageContext.Provider value={value}>{children}</AppLanguageContext.Provider>;
}

export function useAppLanguage() {
  const ctx = useContext(AppLanguageContext);
  if (!ctx) {
    throw new Error("useAppLanguage must be used within an AppLanguageProvider");
  }
  return ctx;
}
