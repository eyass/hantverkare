"use client";

import Link from "next/link";
import { AnimatedSection } from "@/components/marketing/AnimatedSection";
import { useLanguage } from "./LanguageProvider";

/**
 * The real backend only has ONE Stripe-integrated plan (14-day free trial,
 * then a flat 29 €/month, no tiers, no yearly discount). Per the content
 * policy, this page shows a single prominent pricing card instead of the
 * source design's fabricated Solo/Team/Business tiers — presenting
 * multiple priced tiers that don't match what Stripe actually charges
 * would be deceptive pricing.
 */
export function PricingContent() {
  const { t } = useLanguage();

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-8 sm:py-20">
      <div className="mb-10 text-center">
        <h1 className="mb-3.5 text-[34px] font-bold tracking-tight text-balance text-[#0f172a] sm:text-[46px]">
          {t.pricing.h1}
        </h1>
        <p className="mx-auto max-w-xl text-lg leading-relaxed text-[#64748b]">{t.pricing.sub}</p>
      </div>

      <AnimatedSection className="mx-auto max-w-md">
        <div className="relative overflow-hidden rounded-[24px] border border-[#eef1f4] bg-white p-8 shadow-[0_2px_8px_rgba(15,23,42,0.04),0_24px_56px_rgba(15,23,42,0.08)]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-blue-400 via-blue-600 to-blue-700"
          />
          <div className="flex flex-col items-center gap-1 text-center">
            <span className="rounded-full bg-[#dcfce7] px-3 py-1 text-xs font-medium text-[#16a34a]">
              {t.pricing.badge}
            </span>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="mono text-4xl font-bold text-[#0f172a]">29 €</span>
              <span className="text-sm text-[#64748b]">{t.pricing.per}</span>
            </div>
            <p className="text-xs text-[#94a3b8]">{t.pricing.vatNote}</p>
          </div>
          <ul className="mt-6 flex flex-col gap-2.5">
            {t.pricing.features.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-[#0f172a]">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#dcfce7] text-[10px] font-bold text-[#16a34a]">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
          <Link
            href="/login"
            className="mt-7 block self-stretch rounded-full bg-gradient-to-r from-blue-500 to-blue-700 px-6 py-3 text-center text-sm font-semibold text-white shadow-[0_6px_20px_rgba(37,99,235,0.35)] transition hover:from-blue-400 hover:to-blue-600"
          >
            {t.pricing.cta}
          </Link>
          <p className="mt-3 text-center text-xs text-[#94a3b8]">{t.pricing.ctaNote}</p>
        </div>
      </AnimatedSection>

      <AnimatedSection className="mt-16">
        <h2 className="mb-6 text-center text-2xl font-bold tracking-tight text-[#0f172a]">{t.pricing.compareHead}</h2>
        <div className="overflow-hidden rounded-[18px] border border-[#eef1f4]">
          <div className="grid grid-cols-3 bg-[#0f172a] text-white">
            <div className="px-5 py-3.5 text-[13px] font-semibold"> </div>
            <div className="px-3 py-3.5 text-center text-[13px] font-semibold">{t.pricing.withUs}</div>
            <div className="px-3 py-3.5 text-center text-[13px] font-semibold">{t.pricing.withoutUs}</div>
          </div>
          {t.pricing.compareRows.map((row, i) => (
            <div
              key={row[0]}
              className="grid grid-cols-3 border-t border-[#f1f5f9]"
              style={{ background: i % 2 ? "#fff" : "#fafbfc" }}
            >
              <div className="px-5 py-3.5 text-sm text-[#334155]">{row[0]}</div>
              <div className="px-3 py-3.5 text-center text-[13.5px] font-medium text-[#0f172a]">{row[1]}</div>
              <div className="px-3 py-3.5 text-center text-[13.5px] text-[#94a3b8]">{row[2]}</div>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-[#94a3b8]">{t.pricing.foot}</p>
      </AnimatedSection>
    </div>
  );
}
