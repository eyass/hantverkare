"use client";

import { LanguageProvider } from "@/components/marketing/site/LanguageProvider";
import { CookieConsentProvider, CookieConsentBanner } from "@/components/marketing/site/CookieConsent";
import { Header } from "@/components/marketing/site/Header";
import { Footer } from "@/components/marketing/site/Footer";
import { StickyMobileCta } from "@/components/marketing/site/StickyMobileCta";

/**
 * Shared chrome for all public marketing pages (home, tool, pricing, faq,
 * about, blog, trade landing pages): sticky header with nav + language
 * toggle, footer, a mobile sticky CTA bar, and a cookie-consent banner.
 *
 * The bilingual EN/DE toggle and cookie banner are intentionally scoped to
 * this shell only — the authenticated app is untouched and stays
 * German-only.
 */
export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <CookieConsentProvider>
        <div className="flex min-h-full flex-col bg-white">
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
        <StickyMobileCta />
        <CookieConsentBanner />
      </CookieConsentProvider>
    </LanguageProvider>
  );
}
