"use client";

import Link from "next/link";
import { LogoMark } from "@/components/marketing/illustrations/LogoMark";
import { useLanguage } from "./LanguageProvider";

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-[#1e293b] bg-[#0f172a]">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-12 sm:px-8 md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <div className="mb-3.5 flex items-center gap-2.5">
            <LogoMark />
            <span className="text-[17px] font-bold text-white">hantverkare</span>
          </div>
          <p className="max-w-[260px] text-sm leading-6 text-[#94a3b8]">{t.footer.tag}</p>
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="mb-1 text-[13px] font-bold text-white">{t.footer.product}</span>
          <Link href="/tool" className="text-sm text-[#94a3b8] transition hover:text-white">
            {t.nav.how}
          </Link>
          <Link href="/pricing" className="text-sm text-[#94a3b8] transition hover:text-white">
            {t.nav.pricing}
          </Link>
          <Link href="/login" className="text-sm text-[#94a3b8] transition hover:text-white">
            {t.footer.openApp}
          </Link>
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="mb-1 text-[13px] font-bold text-white">{t.footer.company}</span>
          <Link href="/about" className="text-sm text-[#94a3b8] transition hover:text-white">
            {t.nav.about}
          </Link>
          <Link href="/faq" className="text-sm text-[#94a3b8] transition hover:text-white">
            {t.nav.faq}
          </Link>
          <Link href="/blog" className="text-sm text-[#94a3b8] transition hover:text-white">
            {t.nav.blog}
          </Link>
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="mb-1 text-[13px] font-bold text-white">{t.footer.legal}</span>
          <span className="text-sm text-[#64748b]">{t.footer.privacy}</span>
          <span className="text-sm text-[#64748b]">{t.footer.terms}</span>
          <span className="text-sm text-[#64748b]">{t.footer.gdpr}</span>
        </div>
      </div>
      <div className="mx-auto max-w-6xl border-t border-[#1e293b] px-4 py-5 text-[13px] text-[#64748b] sm:px-8">
        {t.footer.copy}
      </div>
    </footer>
  );
}
