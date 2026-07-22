"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "./LanguageProvider";
import { generateDemoQuote, formatCents, type DemoQuote } from "@/lib/demo/mockQuote";

const EXAMPLE_DESCRIPTIONS = [
  "Bad wird komplett saniert, Wände und Boden neu fliesen, circa 14 Quadratmeter, beide Armaturen gegen neue tauschen und die Dusche mit einbauen, dauert schätzungsweise anderthalb Tage",
  "Küchenspüle ist undicht, bitte alte Spüle und Armatur ausbauen, neue Spüle einsetzen und neuen Wasserhahn montieren, danach auf Dichtheit prüfen",
  "Sechs Steckdosen im Wohnzimmer erneuern, drei neue Deckenleuchten anschließen und die komplette Elektroinstallation einmal durchchecken",
  "Zwei Zimmer streichen, Wände und Decke, Untergrund muss vorher gespachtelt und abgeklebt werden, Farbe bringe ich selbst mit",
  "Alten Teppichboden im Wohnzimmer raus, circa 40 Quadratmeter, Untergrund ausgleichen und neues Laminat verlegen inklusive Sockelleisten",
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
  const [phase, setPhase] = useState<"typing" | "generating" | "summary" | "items">("typing");
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
          setPhase("summary");
          const t2 = window.setTimeout(() => {
            if (cycleRef.current !== myCycle) return;
            setPhase("items");
            const t3 = window.setTimeout(() => {
              if (cycleRef.current !== myCycle) return;
              runCycle();
            }, 5200);
            timeouts.current.push(t3);
          }, 1600);
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
    phase === "summary" || phase === "items"
      ? t.hero.recognised
      : phase === "generating"
        ? "…"
        : `00:0${(typedText.length % 9) + 1} · ${t.hero.listening}`;

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
          <div className="text-[19px] font-bold text-[#0f172a]">
            {phase === "items" ? t.hero.itemsTitle : t.hero.phoneTitle}
          </div>
        </div>
        {phase === "items" ? (
          <div className="mono px-[18px] pb-1 text-center text-xs font-semibold text-blue-600">{statusText}</div>
        ) : (
          <>
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
          </>
        )}

        {phase === "items" && quote ? (
          <div className="mx-[18px] my-4 rounded-[13px] bg-[#f4f6f8] p-3 text-[13px] text-[#334155]">
            <div className="mb-2 border-b border-[#e2e8f0] pb-2 text-[12px] font-semibold text-[#0f172a]">
              {quote.matchedJob}
            </div>
            <div className="flex max-h-[150px] flex-col gap-1.5 overflow-y-auto pr-1">
              {quote.items.map((item, i) => (
                <div key={i} className="flex items-baseline justify-between gap-2">
                  <span className="leading-[1.35]">
                    {item.description}
                    <span className="text-[#94a3b8]"> · {item.quantity} {item.unit}</span>
                  </span>
                  <span className="mono flex-none text-[#0f172a]">{formatCents(item.lineTotalCents)}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-col gap-0.5 border-t border-[#e2e8f0] pt-2 text-[12px]">
              <div className="flex justify-between text-[#64748b]">
                <span>{t.hero.subtotal}</span>
                <span className="mono">{formatCents(quote.subtotalCents)}</span>
              </div>
              <div className="flex justify-between text-[#64748b]">
                <span>{t.hero.vat}</span>
                <span className="mono">{formatCents(quote.vatCents)}</span>
              </div>
              <div className="flex justify-between text-[14px] font-semibold text-[#0f172a]">
                <span>{t.hero.total}</span>
                <span className="mono text-blue-600">{formatCents(quote.totalCents)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-[18px] my-4 min-h-[66px] rounded-[13px] bg-[#f4f6f8] p-3 text-[13px] leading-[1.5] text-[#334155]">
            {phase === "summary" && quote ? (
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
        )}
      </div>
    </button>
  );
}
