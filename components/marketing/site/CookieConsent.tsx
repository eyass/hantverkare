"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLanguage } from "./LanguageProvider";

const STORAGE_KEY = "hantverkare_cookie";

type Choice = "" | "accept" | "decline";

type CookieConsentContextValue = {
  choice: Choice;
  decided: boolean;
  hydrated: boolean;
  accept: () => void;
  decline: () => void;
};

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<Choice>("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Deliberately read/apply the persisted choice after mount rather than
    // during the initial render, so the server-rendered output (banner
    // hidden until hydrated) and the client's first render always match —
    // avoids a hydration mismatch from reading localStorage synchronously.
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "accept" || stored === "decline") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setChoice(stored);
      }
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  const value = useMemo<CookieConsentContextValue>(
    () => ({
      choice,
      decided: hydrated && choice !== "",
      hydrated,
      accept: () => {
        setChoice("accept");
        try {
          window.localStorage.setItem(STORAGE_KEY, "accept");
        } catch {
          // ignore
        }
      },
      decline: () => {
        setChoice("decline");
        try {
          window.localStorage.setItem(STORAGE_KEY, "decline");
        } catch {
          // ignore
        }
      },
    }),
    [choice, hydrated],
  );

  return <CookieConsentContext.Provider value={value}>{children}</CookieConsentContext.Provider>;
}

export function useCookieConsent() {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) throw new Error("useCookieConsent must be used within CookieConsentProvider");
  return ctx;
}

export function CookieConsentBanner() {
  const { t } = useLanguage();
  const { choice, hydrated, accept, decline } = useCookieConsent();

  // Avoid a flash of the banner during SSR/hydration before we've read
  // localStorage.
  if (!hydrated || choice !== "") return null;

  return (
    <div className="cookie-fade-in fixed inset-x-4 bottom-4 z-[70] mx-auto max-w-[520px] rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-[0_16px_44px_rgba(15,23,42,0.2)] sm:px-[22px]">
      <div className="mb-1.5 text-sm font-bold text-[#0f172a]">{t.cookie.title}</div>
      <div className="mb-4 text-[13px] leading-[1.55] text-[#64748b]">{t.cookie.body}</div>
      <div className="flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={accept}
          className="min-w-[120px] flex-1 rounded-[10px] bg-blue-600 px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-blue-700"
        >
          {t.cookie.accept}
        </button>
        <button
          type="button"
          onClick={decline}
          className="min-w-[120px] flex-1 rounded-[10px] border border-[#e2e8f0] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-[#475569] transition hover:bg-[#f8fafc]"
        >
          {t.cookie.decline}
        </button>
      </div>
    </div>
  );
}
