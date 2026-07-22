"use client";

import Link from "next/link";
import { AnimatedSection } from "@/components/marketing/AnimatedSection";
import { useLanguage } from "./LanguageProvider";

const TINTS = [
  { bg: "#eef2ff", fg: "#2563eb" },
  { bg: "#ecfdf5", fg: "#059669" },
  { bg: "#fef3c7", fg: "#b45309" },
  { bg: "#f1f5f9", fg: "#475569" },
];

function BlockIcon({ index }: { index: number }) {
  if (index === 0) {
    return (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="9" y="2" width="6" height="12" rx="3" />
        <path d="M5 10a7 7 0 0 0 14 0M12 17v4" />
      </svg>
    );
  }
  if (index === 1) {
    return (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h4" />
      </svg>
    );
  }
  if (index === 2) {
    return (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12l2 2 4-4" />
        <path d="M12 3l7 4v5c0 4.5-3 7-7 9-4-2-7-4.5-7-9V7z" />
      </svg>
    );
  }
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M9 13h6M9 17h4" />
    </svg>
  );
}

export function HowItWorksContent() {
  const { t } = useLanguage();

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto mb-14 max-w-2xl text-center">
        <div className="mono mb-3 text-xs font-semibold tracking-wide text-blue-600">{t.how.kicker}</div>
        <h1 className="mb-3.5 text-[34px] font-bold tracking-tight text-balance text-[#0f172a] sm:text-[46px]">{t.how.h1}</h1>
        <p className="mx-auto max-w-xl text-lg leading-relaxed text-[#64748b]">{t.how.sub}</p>
      </div>

      <div className="flex flex-col gap-5">
        {t.how.blocks.map((block, i) => (
          <AnimatedSection key={block.title} delay={Math.min(i, 3) * 0.05}>
            <div className="grid items-center gap-6 rounded-[20px] border border-[#eef1f4] bg-white p-7 shadow-[0_2px_10px_rgba(15,23,42,0.03)] sm:grid-cols-2">
              <div className={i % 2 === 1 ? "sm:order-2" : ""}>
                <div className="mono mb-2.5 text-[13px] font-semibold text-blue-600">{block.step}</div>
                <div className="mb-2.5 text-[22px] font-bold tracking-tight">{block.title}</div>
                <div className="text-[15px] leading-relaxed text-[#64748b]">{block.body}</div>
              </div>
              <div
                className="flex h-[150px] items-center justify-center rounded-[14px]"
                style={{ background: TINTS[i].bg, color: TINTS[i].fg }}
              >
                <BlockIcon index={i} />
              </div>
            </div>
          </AnimatedSection>
        ))}
      </div>

      <div className="mt-12 text-center">
        <Link
          href="/login"
          className="inline-block rounded-xl bg-blue-600 px-6 py-3.5 text-[15px] font-semibold text-white shadow-[0_6px_18px_rgba(37,99,235,0.28)] transition hover:bg-blue-700"
        >
          {t.how.btn}
        </Link>
      </div>
    </div>
  );
}
