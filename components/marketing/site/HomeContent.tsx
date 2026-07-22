"use client";

import Link from "next/link";
import { AnimatedSection } from "@/components/marketing/AnimatedSection";
import { GradientBackdrop } from "@/components/marketing/GradientBackdrop";
import { useLanguage } from "./LanguageProvider";
import { PhoneDemoHero } from "./PhoneDemoHero";
import { RoiCalculator } from "./RoiCalculator";

export function HomeContent() {
  const { t } = useLanguage();

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <GradientBackdrop className="opacity-70" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-14 sm:px-8 sm:pt-16 md:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#eef2ff] px-3 py-1.5 text-[13px] font-semibold text-blue-600">
              <span className="h-1.5 w-1.5 rounded-full bg-[#22a06b]" />
              {t.hero.badge}
            </div>
            <h1 className="mb-4 text-[40px] leading-[1.05] font-bold tracking-tight text-balance text-[#0f172a] sm:text-[58px]">
              {t.hero.h1}
            </h1>
            <p className="mb-7 max-w-[480px] text-lg leading-relaxed text-[#475569] sm:text-[19px]">
              {t.hero.sub}
            </p>
            <div className="mb-5 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-xl bg-blue-600 px-6 py-3.5 text-[15px] font-semibold text-white shadow-[0_6px_18px_rgba(37,99,235,0.28)] transition hover:bg-blue-700"
              >
                {t.hero.cta1}
              </Link>
              <Link
                href="/tool"
                className="rounded-xl border border-[#e2e8f0] bg-white px-6 py-3.5 text-[15px] font-semibold text-[#334155] transition hover:bg-[#f8fafc]"
              >
                {t.hero.cta2}
              </Link>
            </div>
            <div className="text-[13.5px] text-[#64748b]">
              {t.hero.statLine}
            </div>
          </div>
          <div className="hidden justify-center md:flex">
            <PhoneDemoHero />
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="border-t border-b border-[#eef1f4] bg-[#fafbfc]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-9 px-4 py-6 text-sm text-[#94a3b8] sm:px-8">
          <span className="font-semibold">{t.trust.label}</span>
          {t.trust.items.map((item) => (
            <span key={item} className="font-bold text-[#64748b]">
              {item}
            </span>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <AnimatedSection className="mx-auto max-w-6xl px-4 py-16 sm:px-8">
        <div className="mx-auto mb-12 max-w-xl text-center">
          <h2 className="mb-3.5 text-[34px] font-bold tracking-tight text-balance text-[#0f172a]">
            {t.features.head}
          </h2>
          <p className="text-[17px] leading-relaxed text-[#64748b]">
            {t.features.sub}
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          {t.features.items.map((f, i) => (
            <div
              key={f.title}
              className="rounded-[18px] border border-[#eef1f4] bg-white p-7 shadow-[0_2px_10px_rgba(15,23,42,0.03)]"
            >
              <div
                className="mb-4 flex h-[46px] w-[46px] items-center justify-center rounded-[13px]"
                style={{
                  background: ["#eef2ff", "#ecfdf5", "#fef3c7"][i],
                  color: ["#2563eb", "#059669", "#b45309"][i],
                }}
              >
                <FeatureIcon index={i} />
              </div>
              <div className="mb-2 text-lg font-bold text-[#0f172a]">
                {f.title}
              </div>
              <div className="text-[14.5px] leading-relaxed text-[#64748b]">
                {f.body}
              </div>
            </div>
          ))}
        </div>
      </AnimatedSection>

      {/* CALCULATOR */}
      <section className="border-t border-b border-[#eef1f4] bg-[#fafbfc]">
        <AnimatedSection className="mx-auto max-w-4xl px-4 py-16 sm:px-8">
          <div className="mx-auto mb-10 max-w-xl text-center">
            <h2 className="mb-3 text-[32px] font-bold tracking-tight text-balance text-[#0f172a]">
              {t.calc.head}
            </h2>
            <p className="text-[17px] text-[#64748b]">{t.calc.sub}</p>
          </div>
          <RoiCalculator />
        </AnimatedSection>
      </section>

      {/* STEPS */}
      <section className="bg-[#0f172a] text-white">
        <AnimatedSection className="mx-auto max-w-6xl px-4 py-16 sm:px-8">
          <div className="mx-auto mb-12 max-w-xl text-center">
            <h2 className="mb-3 text-[32px] font-bold tracking-tight">
              {t.steps.head}
            </h2>
            <p className="text-[17px] text-[#94a3b8]">{t.steps.sub}</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            {t.steps.items.map((s, i) => (
              <div
                key={s.title}
                className="rounded-[18px] border border-[#334155] bg-[#1e293b] p-6"
              >
                <div className="mono mb-4 text-[13px] font-semibold text-[#60a5fa]">
                  {t.steps.tag} {String(i + 1).padStart(2, "0")}
                </div>
                <div className="mb-2 text-lg font-bold">{s.title}</div>
                <div className="text-[14.5px] leading-relaxed text-[#94a3b8]">
                  {s.body}
                </div>
              </div>
            ))}
          </div>
        </AnimatedSection>
      </section>

      {/* TESTIMONIALS */}
      <AnimatedSection className="mx-auto max-w-6xl px-4 py-16 sm:px-8">
        <div className="mx-auto mb-2.5 max-w-xl text-center">
          <h2 className="mb-2 text-[32px] font-bold tracking-tight text-balance text-[#0f172a]">
            {t.testimonials.head}
          </h2>
          <p className="mb-9 text-xs font-medium text-[#94a3b8]">
            {t.testimonials.caption}
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          {t.testimonials.items.map((tm) => (
            <div
              key={tm.name}
              className="flex flex-col rounded-[18px] border border-[#eef1f4] bg-white p-6 shadow-[0_2px_10px_rgba(15,23,42,0.03)]"
            >
              <div className="mb-3.5 text-[15px] text-[#f59e0b]">★★★★★</div>
              <div className="flex-1 text-[15.5px] leading-relaxed text-[#0f172a]">
                {tm.quote}
              </div>
              <div className="mt-5 flex items-center gap-3 border-t border-[#f1f5f9] pt-4">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
                  style={{ background: tm.avBg, color: tm.avFg }}
                >
                  {tm.initials}
                </div>
                <div>
                  <div className="text-sm font-semibold">{tm.name}</div>
                  <div className="text-[12.5px] text-[#94a3b8]">{tm.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </AnimatedSection>

      {/* SECURITY */}
      <section className="border-t border-[#eef1f4] bg-[#fafbfc]">
        <AnimatedSection className="mx-auto max-w-6xl px-4 py-16 sm:px-8">
          <div className="mx-auto mb-11 max-w-xl text-center">
            <div className="mono mb-2.5 text-xs font-semibold tracking-wide text-blue-600">
              {t.security.kicker}
            </div>
            <h2 className="mb-3 text-[32px] font-bold tracking-tight text-balance text-[#0f172a]">
              {t.security.head}
            </h2>
            <p className="text-[17px] leading-relaxed text-[#64748b]">
              {t.security.sub}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {t.security.items.map((s, i) => (
              <div
                key={s.title}
                className="rounded-2xl border border-[#eef1f4] bg-white p-5"
              >
                <div className="mb-3.5 flex h-10 w-10 items-center justify-center rounded-[11px] bg-[#eef2ff] text-blue-600">
                  <SecurityIcon index={i} />
                </div>
                <div className="mb-1.5 text-[15px] font-bold text-[#0f172a]">
                  {s.title}
                </div>
                <div className="text-[13.5px] leading-relaxed text-[#64748b]">
                  {s.body}
                </div>
              </div>
            ))}
          </div>
        </AnimatedSection>
      </section>

      {/* FINAL CTA */}
      <AnimatedSection className="mx-auto max-w-6xl px-4 py-20 sm:px-8">
        <div className="rounded-[28px] bg-gradient-to-br from-blue-600 to-blue-700 p-10 text-center text-white shadow-[0_24px_60px_rgba(37,99,235,0.35)] sm:p-14">
          <h2 className="mb-3 text-[32px] font-bold tracking-tight">
            {t.finalCta.head}
          </h2>
          <p className="mx-auto mb-6 max-w-[440px] text-[17px] text-blue-100">
            {t.finalCta.sub}
          </p>
          <Link
            href="/login"
            className="inline-block rounded-xl bg-white px-7 py-3.5 text-[15px] font-bold text-blue-600 transition hover:bg-blue-50"
          >
            {t.finalCta.btn}
          </Link>
        </div>
      </AnimatedSection>
    </div>
  );
}

function FeatureIcon({ index }: { index: number }) {
  if (index === 0) {
    return (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <rect x="9" y="2" width="6" height="12" rx="3" />
        <path d="M5 10a7 7 0 0 0 14 0M12 17v4" />
      </svg>
    );
  }
  if (index === 1) {
    return (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h4" />
      </svg>
    );
  }
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 12l2 2 4-4" />
      <path d="M12 3l7 4v5c0 4.5-3 7-7 9-4-2-7-4.5-7-9V7z" />
    </svg>
  );
}

function SecurityIcon({ index }: { index: number }) {
  const paths = [
    ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"],
    [
      "M4 7V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2",
      "M2 9h20v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z",
      "M6 13h4",
    ],
    ["M9 12l2 2 4-4", "M21 12c0 5-3.5 7.5-8.5 9C7.5 19.5 4 17 4 12V6l8-3 8 3z"],
    ["M7 11V7a5 5 0 0 1 10 0v4", "M5 11h14v10H5z"],
  ][index];
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
