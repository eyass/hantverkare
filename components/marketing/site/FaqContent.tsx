"use client";

import Link from "next/link";
import { AnimatedSection } from "@/components/marketing/AnimatedSection";
import { useLanguage } from "./LanguageProvider";
import { FaqAccordion } from "./FaqAccordion";

export function FaqContent() {
  const { t } = useLanguage();

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-8 sm:py-20">
      <div className="mb-11 text-center">
        <h1 className="mb-3.5 text-[34px] font-bold tracking-tight text-[#0f172a] sm:text-[46px]">{t.faq.h1}</h1>
        <p className="text-lg text-[#64748b]">{t.faq.sub}</p>
      </div>

      <FaqAccordion />

      <AnimatedSection className="mt-10">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#eef1f4] bg-[#f4f6f8] p-8 text-center">
          <p className="text-sm text-[#64748b]">
            {t.faq.sub}
          </p>
          <Link
            href="/login"
            className="rounded-full bg-gradient-to-r from-blue-500 to-blue-700 px-6 py-3 text-sm font-medium text-white shadow-[0_6px_20px_rgba(37,99,235,0.35)] transition hover:from-blue-400 hover:to-blue-600"
          >
            {t.header.startFree}
          </Link>
        </div>
      </AnimatedSection>
    </div>
  );
}
