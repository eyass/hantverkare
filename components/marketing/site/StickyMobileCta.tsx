"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "./LanguageProvider";
import { useCookieConsent } from "./CookieConsent";

/**
 * Sticky bottom CTA bar shown on mobile only, once the cookie banner has
 * been dismissed (accept or decline) so the two overlays never stack.
 */
export function StickyMobileCta() {
  const { t } = useLanguage();
  const { decided } = useCookieConsent();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    function check() {
      setIsMobile(window.innerWidth < 860);
    }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!isMobile || !decided) return null;

  return (
    <div
      className="sticky-cta-in fixed inset-x-0 bottom-0 z-50 flex items-center gap-2.5 border-t border-[#eef1f4] bg-white/94 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md md:hidden"
    >
      <div className="flex-1 text-[13px] leading-tight text-[#475569]">
        <span className="font-bold text-[#0f172a]">{t.sticky.title}</span>
        <br />
        {t.sticky.sub}
      </div>
      <Link
        href="/login"
        className="shrink-0 rounded-[11px] bg-blue-600 px-5 py-3 text-sm font-semibold whitespace-nowrap text-white shadow-[0_4px_12px_rgba(37,99,235,0.28)] transition hover:bg-blue-700"
      >
        {t.header.startFree}
      </Link>
    </div>
  );
}
