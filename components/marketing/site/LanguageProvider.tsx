"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DICTIONARY, type Language } from "./dictionary";

const STORAGE_KEY = "hantverkare_lang";

type LanguageContextValue = {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (typeof DICTIONARY)[Language];
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // German is the default everywhere else in this app (blog, trade pages,
  // authenticated product) — the marketing pages default to German too,
  // with EN available purely as an optional toggle.
  const [lang, setLangState] = useState<Language>("de");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "de" || stored === "en") {
        // Deliberately set state after mount (not during the initial render)
        // so the server-rendered default ("de") and the client's first
        // render always match, avoiding a hydration mismatch — the
        // persisted preference is applied one tick later instead.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLangState(stored);
      }
    } catch {
      // localStorage unavailable (private mode, etc.) — silently keep default.
    }
  }, []);

  function setLang(next: Language) {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }

  const value = useMemo<LanguageContextValue>(
    () => ({ lang, setLang, t: DICTIONARY[lang] }),
    [lang],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return ctx;
}
