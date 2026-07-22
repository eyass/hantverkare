"use client";

import { useMemo, useState } from "react";
import { useLanguage } from "./LanguageProvider";

function formatInt(n: number, lang: "de" | "en") {
  return Math.round(n).toLocaleString(lang === "de" ? "de-DE" : "en-US");
}

export function RoiCalculator() {
  const { lang, t } = useLanguage();
  const [quotesPerWeek, setQuotesPerWeek] = useState(8);
  const [minutesToday, setMinutesToday] = useState(45);
  const [jobValue, setJobValue] = useState(4000);

  const { hoursSaved, extraRevenue } = useMemo(() => {
    const savedPerQuoteMin = minutesToday * 0.85;
    const hours = Math.round((savedPerQuoteMin * quotesPerWeek * 52) / 60);
    const revenue = jobValue * 12;
    return { hoursSaved: hours, extraRevenue: revenue };
  }, [quotesPerWeek, minutesToday, jobValue]);

  return (
    <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr] md:items-stretch">
      <div className="rounded-[20px] border border-[#eef1f4] bg-white p-7">
        <SliderRow
          label={t.calc.q1}
          value={quotesPerWeek}
          display={String(quotesPerWeek)}
          min={1}
          max={40}
          onChange={setQuotesPerWeek}
        />
        <SliderRow
          label={t.calc.q2}
          value={minutesToday}
          display={`${minutesToday} min`}
          min={10}
          max={90}
          step={5}
          onChange={setMinutesToday}
        />
        <SliderRow
          label={t.calc.q3}
          value={jobValue}
          display={`€${formatInt(jobValue, lang)}`}
          min={500}
          max={20000}
          step={500}
          onChange={setJobValue}
          last
        />
      </div>
      <div className="flex flex-col justify-center rounded-[20px] bg-gradient-to-br from-blue-600 to-blue-700 p-8 text-white shadow-[0_20px_50px_rgba(37,99,235,0.28)]">
        <div className="mb-1.5 text-sm text-blue-100">{t.calc.r1}</div>
        <div className="mb-5 text-[44px] leading-none font-bold tracking-tight">
          {formatInt(hoursSaved, lang)} <span className="text-xl font-semibold text-blue-200">{t.calc.hrsUnit}</span>
        </div>
        <div className="mb-1.5 text-sm text-blue-100">{t.calc.r2}</div>
        <div className="text-[44px] leading-none font-bold tracking-tight">€{formatInt(extraRevenue, lang)}</div>
        <div className="mt-2.5 text-[12.5px] leading-[1.5] text-blue-100">{t.calc.note}</div>
      </div>
    </div>
  );
}

function SliderRow({
  label,
  value,
  display,
  min,
  max,
  step = 1,
  onChange,
  last,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  last?: boolean;
}) {
  return (
    <div className={last ? "" : "mb-6"}>
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="text-sm font-semibold text-[#334155]">{label}</span>
        <span className="mono text-base font-bold text-blue-600">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full accent-blue-600"
      />
    </div>
  );
}
