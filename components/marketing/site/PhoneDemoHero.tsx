"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "./LanguageProvider";
import { generateDemoQuote, formatCents, type DemoQuote } from "@/lib/demo/mockQuote";

const EXAMPLE_DESCRIPTIONS = [
  "Bad sanieren, Wände neu fliesen ca. 14m², beide Armaturen tauschen",
  "Küchenspüle und Wasserhahn austauschen",
  "Steckdosen und Deckenleuchten erneuern",
  "Wohnung streichen, zwei Zimmer",
];

/**
 * Phone-mockup visual frame (chrome, mic icon, pulsing circle, status text)
 * ported from the source design, but wired to the REAL client-side demo
 * logic (lib/demo/mockQuote.ts) instead of a fake typing-only animation —
 * so the hero shows something real and functional, not just a scripted
 * typing effect with no actual output.
 */
export function PhoneDemoHero() {
  const { lang, t } = useLanguage();
  const [phase, setPhase] = useState<"typing" | "generating" | "done">("typing");
  const [typedText, setTypedText] = useState("");
  const [quote, setQuote] = useState<DemoQuote | null>(null);
  const cycleRef = useRef(0);
  const timeouts = useRef<number[]>([]);

  function clearAll() {
    timeouts.current.forEach((id) => window.clearTimeout(id));
    timeouts.current = [];
  }

  function runCycle() {
    clearAll();
    const myCycle = ++cycleRef.current;
    const full = EXAMPLE_DESCRIPTIONS[(myCycle - 1) % EXAMPLE_DESCRIPTIONS.length];
    setPhase("typing");
    setTypedText("");
    setQuote(null);

    let i = 0;
    const typeStep = () => {
      if (cycleRef.current !== myCycle) return;
      i += 2;
      if (i >= full.length) {
        setTypedText(full);
        setPhase("generating");
        const t1 = window.setTimeout(() => {
          if (cycleRef.current !== myCycle) return;
          setQuote(generateDemoQuote(full));
          setPhase("done");
          const t2 = window.setTimeout(() => {
            if (cycleRef.current !== myCycle) return;
            runCycle();
          }, 4200);
          timeouts.current.push(t2);
        }, 650);
        timeouts.current.push(t1);
        return;
      }
      setTypedText(full.slice(0, i));
      const t = window.setTimeout(typeStep, 45);
      timeouts.current.push(t);
    };
    const startT = window.setTimeout(typeStep, 500);
    timeouts.current.push(startT);
  }

  useEffect(() => {
    runCycle();
    return clearAll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusText =
    phase === "done" ? t.hero.recognised : phase === "generating" ? "…" : `00:0${(typedText.length % 9) + 1} · ${t.hero.listening}`;

  return (
    <button
      type="button"
      onClick={() => runCycle()}
      aria-label={t.hero.replay}
      className="floaty w-[280px] cursor-pointer rounded-[34px] border-none bg-[#0f172a] p-2.5 text-left shadow-[0_30px_70px_rgba(15,23,42,0.28)]"
    >
      <div className="overflow-hidden rounded-[26px] bg-white text-left">
        <div className="flex justify-between px-5 pt-3 pb-1.5 text-xs font-semibold text-[#0f172a]">
          <span className="mono">9:41</span>
          <span>{lang === "de" ? "◉ ▪ 5G" : "◉ ▪ 5G"}</span>
        </div>
        <div className="px-[22px] pt-6 pb-2 text-center">
          <div className="text-[19px] font-bold text-[#0f172a]">{t.hero.phoneTitle}</div>
        </div>
        <div className="flex justify-center py-1">
          <div className="relative flex h-[120px] w-[120px] items-center justify-center">
            <div
              className="absolute inset-3 rounded-full bg-[#dbeafe] transition-opacity duration-300"
              style={{ opacity: phase === "typing" ? 1 : 0.4 }}
            />
            <div className="relative flex h-[84px] w-[84px] items-center justify-center rounded-full bg-blue-600 shadow-[0_12px_28px_rgba(37,99,235,0.4)]">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 10a7 7 0 0 0 14 0M12 17v4" />
              </svg>
            </div>
          </div>
        </div>
        <div className="mono text-center text-xs font-semibold text-blue-600">{statusText}</div>
        <div className="mx-[18px] my-4 min-h-[66px] rounded-[13px] bg-[#f4f6f8] p-3 text-[13px] leading-[1.5] text-[#334155]">
          {phase === "done" && quote ? (
            <div className="flex flex-col gap-1">
              <div className="font-semibold text-[#0f172a]">{quote.matchedJob}</div>
              <div className="mono text-blue-600">{formatCents(quote.totalCents)}</div>
            </div>
          ) : (
            <>
              &ldquo;{typedText}&rdquo;
              {phase === "typing" && (
                <span className="caret-blink ml-0.5 inline-block h-[1em] w-[2px] align-[-2px] bg-blue-600" />
              )}
            </>
          )}
        </div>
      </div>
    </button>
  );
}
