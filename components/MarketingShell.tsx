import Link from "next/link";

const NAV_LINKS = [
  { href: "/", label: "Start" },
  { href: "/tool", label: "Das Tool" },
  { href: "/pricing", label: "Preise" },
  { href: "/faq", label: "FAQ" },
  { href: "/about", label: "Über uns" },
];

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-[#e9edf2] bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <Link href="/" className="text-lg font-semibold tracking-tight text-[#0f172a]">
          hantverkare
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-[#64748b] md:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="transition hover:text-[#0f172a]">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-xl border border-[#e9edf2] px-4 py-2 text-sm font-medium text-[#0f172a] transition hover:bg-[#f4f6f8]"
          >
            Anmelden
          </Link>
          <Link
            href="/login"
            className="rounded-full bg-[#2563eb] px-4 py-2 text-sm font-medium text-white shadow-[0_6px_16px_rgba(37,99,235,0.3)] transition hover:bg-[#1d4ed8]"
          >
            Kostenlos starten
          </Link>
        </div>
      </div>
      <nav className="flex items-center gap-4 overflow-x-auto border-t border-[#e9edf2] px-4 py-2 text-sm font-medium text-[#64748b] md:hidden">
        {NAV_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="shrink-0 transition hover:text-[#0f172a]">
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-[#e9edf2] bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-start sm:justify-between sm:px-8">
        <div className="flex flex-col gap-2">
          <span className="text-lg font-semibold tracking-tight text-[#0f172a]">hantverkare</span>
          <p className="max-w-xs text-sm text-[#64748b]">
            KI-gestützte Angebote für Handwerker — Auftrag beschreiben, Angebot in unter einer
            Minute, Kunde unterschreibt digital.
          </p>
        </div>
        <div className="flex gap-12 text-sm text-[#64748b]">
          <div className="flex flex-col gap-2">
            <span className="font-medium text-[#0f172a]">Produkt</span>
            <Link href="/tool" className="hover:text-[#0f172a]">
              Das Tool
            </Link>
            <Link href="/pricing" className="hover:text-[#0f172a]">
              Preise
            </Link>
            <Link href="/faq" className="hover:text-[#0f172a]">
              FAQ
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-medium text-[#0f172a]">Unternehmen</span>
            <Link href="/about" className="hover:text-[#0f172a]">
              Über uns
            </Link>
            <Link href="/login" className="hover:text-[#0f172a]">
              Anmelden
            </Link>
          </div>
        </div>
      </div>
      <div className="border-t border-[#e9edf2] px-4 py-4 text-center text-xs text-[#94a3b8] sm:px-8">
        © {new Date().getFullYear()} hantverkare. Alle Preise inkl. MwSt.
      </div>
    </footer>
  );
}

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-[#f4f6f8]">
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
