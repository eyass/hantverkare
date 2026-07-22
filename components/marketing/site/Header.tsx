"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "@/components/marketing/illustrations/LogoMark";
import { useLanguage } from "./LanguageProvider";
import type { Language } from "./dictionary";

const NAV = [
  { href: "/tool", key: "how" as const },
  { href: "/pricing", key: "pricing" as const },
  { href: "/blog", key: "blog" as const },
  { href: "/faq", key: "faq" as const },
  { href: "/about", key: "about" as const },
];

export function Header() {
  const { lang, setLang, t } = useLanguage();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-[#eef1f4] bg-white/86 backdrop-blur-lg">
      <div className="mx-auto flex h-[66px] max-w-6xl items-center justify-between gap-4 px-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoMark />
          <span className="text-lg font-bold tracking-tight text-[#0f172a]">hantverkare</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
                  active ? "bg-[#eef2ff] text-blue-600" : "text-[#475569] hover:text-[#0f172a]"
                }`}
              >
                {t.nav[item.key]}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageToggle lang={lang} setLang={setLang} />
          <Link
            href="/login"
            className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-[#475569] transition hover:text-[#0f172a] md:inline-block"
          >
            {t.header.signin}
          </Link>
          <Link
            href="/login"
            className="rounded-[10px] bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(37,99,235,0.25)] transition hover:bg-blue-700"
          >
            {t.header.startFree}
          </Link>
        </div>
      </div>

      <nav className="flex items-center gap-1 overflow-x-auto border-t border-[#f4f6f8] px-4 py-2 md:hidden">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold whitespace-nowrap transition ${
                active ? "bg-[#eef2ff] text-blue-600" : "text-[#475569]"
              }`}
            >
              {t.nav[item.key]}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

function LanguageToggle({
  lang,
  setLang,
}: {
  lang: Language;
  setLang: (l: Language) => void;
}) {
  return (
    <div className="flex rounded-[9px] bg-[#f1f5f9] p-[3px]" role="group" aria-label="Language">
      {(["de", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`rounded-[7px] px-2.5 py-1.5 text-[12.5px] font-semibold transition ${
            lang === l ? "bg-white text-[#0f172a] shadow-sm" : "text-[#64748b]"
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
