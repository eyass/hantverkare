"use client";

import { useState } from "react";
import { FAQS } from "@/lib/seo/faq-data";
import { useLanguage } from "./LanguageProvider";

export function FaqAccordion() {
  const { lang } = useLanguage();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-3">
      {FAQS.map((faq, index) => {
        const open = openIndex === index;
        const question = lang === "en" ? faq.questionEn : faq.question;
        const answer = lang === "en" ? faq.answerEn : faq.answer;
        return (
          <button
            key={faq.question}
            type="button"
            onClick={() => setOpenIndex(open ? null : index)}
            aria-expanded={open}
            className={`w-full rounded-[14px] border bg-white px-[22px] py-5 text-left transition-colors ${
              open ? "border-[#c7d7f5]" : "border-[#eef1f4]"
            }`}
          >
            <div className="flex items-center justify-between gap-4">
              <span className="text-base font-semibold text-[#0f172a]">{question}</span>
              <span
                className="shrink-0 text-[22px] font-normal text-blue-600 transition-transform duration-200"
                style={{ transform: open ? "rotate(45deg)" : "rotate(0deg)" }}
              >
                +
              </span>
            </div>
            <div
              className="grid transition-[grid-template-rows] duration-300 ease-out"
              style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                <p className="pt-3.5 text-[14.5px] leading-[1.65] text-[#64748b]">{answer}</p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
