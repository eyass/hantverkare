"use client";

import Link from "next/link";
import { LogoMark } from "@/components/marketing/illustrations/LogoMark";
import { AnimatedSection } from "@/components/marketing/AnimatedSection";

const NAV_LINKS = [
  { href: "/", label: "Start" },
  { href: "/tool", label: "Das Tool" },
  { href: "/pricing", label: "Preise" },
  { href: "/faq", label: "FAQ" },
  { href: "/about", label: "Über uns" },
];

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#020617]/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
          <LogoMark />
          hantverkare
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-300 md:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="transition hover:text-white">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-xl border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Anmelden
          </Link>
          <Link
            href="/login"
            className="rounded-full bg-gradient-to-r from-blue-500 to-blue-700 px-4 py-2 text-sm font-medium text-white shadow-[0_6px_20px_rgba(37,99,235,0.45)] transition hover:from-blue-400 hover:to-blue-600"
          >
            Kostenlos starten
          </Link>
        </div>
      </div>
      <nav className="flex items-center gap-4 overflow-x-auto border-t border-white/10 px-4 py-2 text-sm font-medium text-slate-300 md:hidden">
        {NAV_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="shrink-0 transition hover:text-white">
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#020617]">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-14 sm:flex-row sm:items-start sm:justify-between sm:px-8">
        <AnimatedSection className="flex flex-col gap-3">
          <span className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
            <LogoMark />
            hantverkare
          </span>
          <p className="max-w-xs text-sm leading-6 text-slate-400">
            KI-gestützte Angebote für Handwerker — Auftrag beschreiben, Angebot in unter einer
            Minute, Kunde unterschreibt digital.
          </p>
        </AnimatedSection>
        <div className="flex gap-12 text-sm text-slate-400">
          <div className="flex flex-col gap-2">
            <span className="font-medium text-white">Produkt</span>
            <Link href="/tool" className="transition hover:text-white">
              Das Tool
            </Link>
            <Link href="/pricing" className="transition hover:text-white">
              Preise
            </Link>
            <Link href="/faq" className="transition hover:text-white">
              FAQ
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-medium text-white">Unternehmen</span>
            <Link href="/about" className="transition hover:text-white">
              Über uns
            </Link>
            <Link href="/login" className="transition hover:text-white">
              Anmelden
            </Link>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-slate-500 sm:px-8">
        © {new Date().getFullYear()} hantverkare. Alle Preise inkl. MwSt.
      </div>
    </footer>
  );
}

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-white">
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
