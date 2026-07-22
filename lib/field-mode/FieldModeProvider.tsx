"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "hantverkare:field-mode";

type FieldModeContextValue = {
  /** Larger touch targets / simplified density for on-site (gloved-hand) use. */
  fieldMode: boolean;
  toggleFieldMode: () => void;
};

const FieldModeContext = createContext<FieldModeContextValue | null>(null);

/**
 * Client-only "field mode" preference (issue #164): a purely visual density
 * toggle -- larger touch targets, bigger text -- for on-site use with gloves
 * or dirty hands. Persisted to localStorage only (no schema/DB change; this
 * is a display preference, not application data), so it's read on mount
 * rather than seeded from the server like AppLanguageProvider's language --
 * a one-tick-after-mount flash of the default (off) state is an acceptable
 * tradeoff for a pure styling toggle.
 */
export function FieldModeProvider({ children }: { children: ReactNode }) {
  const [fieldMode, setFieldMode] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) === "1";
      if (stored) {
        // Deliberately set state after mount (not during the initial render)
        // so the server-rendered default (false) and the client's first
        // render always match, avoiding a hydration mismatch -- mirrors
        // components/marketing/site/LanguageProvider.tsx's pattern.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFieldMode(true);
      }
    } catch {
      // localStorage unavailable (e.g. private browsing) -- default stands.
    }
  }, []);

  const value = useMemo<FieldModeContextValue>(
    () => ({
      fieldMode,
      toggleFieldMode: () =>
        setFieldMode((current) => {
          const next = !current;
          try {
            window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
          } catch {
            // Best-effort persistence only.
          }
          return next;
        }),
    }),
    [fieldMode],
  );

  return <FieldModeContext.Provider value={value}>{children}</FieldModeContext.Provider>;
}

export function useFieldMode() {
  const ctx = useContext(FieldModeContext);
  if (!ctx) {
    throw new Error("useFieldMode must be used within a FieldModeProvider");
  }
  return ctx;
}
