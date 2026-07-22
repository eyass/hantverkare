"use client";

import Link from "next/link";
import { AnimatedSection } from "@/components/marketing/AnimatedSection";
import { useLanguage } from "./LanguageProvider";

export function AboutContent() {
  const { t } = useLanguage();

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-8 sm:py-20">
      <div className="mb-12 text-center">
        <div className="mono mb-3 text-xs font-semibold tracking-wide text-blue-600">{t.about.kicker}</div>
        <h1 className="mb-4 text-[34px] font-bold tracking-tight text-balance text-[#0f172a] sm:text-[46px]">{t.about.h1}</h1>
        <p className="mx-auto max-w-xl text-lg leading-relaxed text-[#64748b]">{t.about.sub}</p>
      </div>

      <div className="mb-12 flex flex-col gap-5 text-base leading-relaxed text-[#334155]">
        <p>{t.about.p1}</p>
        <p>{t.about.p2}</p>
      </div>

      <AnimatedSection className="mb-12 grid gap-4 sm:grid-cols-3">
        {t.about.stats.map((s) => (
          <div key={s.l} className="rounded-2xl border border-[#eef1f4] bg-[#fafbfc] p-6 text-center">
            <div className="text-[28px] font-bold text-blue-600">{s.n}</div>
            <div className="mt-1 text-[13.5px] text-[#64748b]">{s.l}</div>
          </div>
        ))}
      </AnimatedSection>

      <AnimatedSection>
        <div className="rounded-[22px] bg-[#0f172a] p-10 text-center text-white sm:p-12">
          <div className="mb-2.5 text-[22px] font-bold">{t.about.careersTitle}</div>
          <p className="mx-auto mb-6 max-w-md leading-relaxed text-[#94a3b8]">{t.about.careersBody}</p>
          <Link
            href="/login"
            className="inline-block rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            {t.about.careersLink}
          </Link>
        </div>
      </AnimatedSection>
    </div>
  );
}
