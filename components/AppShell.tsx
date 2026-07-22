"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  BarChart3,
  Briefcase,
  Calendar,
  FileSignature,
  FileText,
  LayoutTemplate,
  Receipt,
  Settings as SettingsIcon,
  Tag,
  TriangleAlert,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { GlobalSearch } from "@/components/GlobalSearch";
import { useAppLanguage } from "@/lib/i18n/AppLanguageProvider";
import { APP_SHELL_DICTIONARY } from "@/components/AppShell.dictionary";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Rendered as an indented sub-item under the preceding top-level item. */
  nested?: boolean;
};

type NavSection = {
  title?: string;
  items: NavItem[];
};

function buildNavSections(
  t: (typeof APP_SHELL_DICTIONARY)["de"],
  role: "owner" | "member",
): NavSection[] {
  const sections: NavSection[] = [
    {
      title: t.navGroups.work,
      items: [
        { href: "/quotes", label: t.nav.quotes, icon: FileText },
        { href: "/schedule", label: t.nav.schedule, icon: Calendar },
        { href: "/jobs", label: t.nav.myJobs, icon: Briefcase },
        { href: "/contracts", label: t.nav.contracts, icon: FileSignature },
      ],
    },
    {
      title: t.navGroups.business,
      items: [
        { href: "/customers", label: t.nav.customers, icon: Users },
        { href: "/price-list", label: t.nav.priceList, icon: Tag },
        { href: "/quote-templates", label: t.nav.quoteTemplates, icon: LayoutTemplate },
        { href: "/invoices", label: t.nav.invoices, icon: Receipt },
        { href: "/reports", label: t.nav.reports, icon: BarChart3 },
      ],
    },
    {
      title: t.navGroups.admin,
      items: [
        { href: "/settings", label: t.nav.settings, icon: SettingsIcon },
        // Only owners manage the team / danger zone; members never see these
        // links (and the Server Actions behind them enforce owner-only
        // server-side regardless). Rendered as nested sub-items under
        // Settings rather than flat top-level entries.
        ...(role === "owner"
          ? [
              { href: "/settings/team", label: t.nav.team, icon: UserCog, nested: true },
              {
                href: "/settings/danger-zone",
                label: t.nav.dangerZone,
                icon: TriangleAlert,
                nested: true,
              },
            ]
          : []),
      ],
    },
  ];
  return sections;
}

// The active item is the one whose href is the longest prefix of the current
// path, so e.g. /settings/team highlights "Team" and not also "Einstellungen".
function activeHref(pathname: string, items: NavItem[]): string | null {
  const matches = items.filter(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  if (matches.length === 0) return null;
  return matches.reduce((best, item) =>
    item.href.length > best.href.length ? item : best,
  ).href;
}

export function AppShell({
  email,
  role,
  signOutAction,
  children,
}: {
  email: string;
  role: "owner" | "member";
  signOutAction: () => Promise<void>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { language } = useAppLanguage();
  const t = APP_SHELL_DICTIONARY[language];
  const sections = buildNavSections(t, role);
  const NAV_ITEMS = sections.flatMap((section) => section.items);
  const currentHref = activeHref(pathname, NAV_ITEMS);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-[236px] flex-none flex-col bg-[#0f172a] p-6 text-white md:flex">
        <div className="mb-8 flex items-center gap-2 px-1">
          <div className="h-[26px] w-[26px] rounded-[7px] bg-[#2563eb]" />
          <span className="text-[17px] font-bold tracking-tight">hantverkare</span>
        </div>
        <nav className="flex flex-col gap-4">
          {sections.map((section) => (
            <div key={section.title ?? section.items[0]?.href} className="flex flex-col gap-1">
              {section.title ? (
                <div className="px-3 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-[#64748b]">
                  {section.title}
                </div>
              ) : null}
              {section.items.map((item) => {
                const active = item.href === currentHref;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 rounded-[10px] py-2.5 text-sm font-semibold transition-colors ${
                      item.nested ? "ml-3 pl-3 pr-3" : "px-3"
                    } ${
                      active
                        ? "bg-[#1e293b] text-white"
                        : "text-[#94a3b8] hover:bg-[#1e293b] hover:text-white"
                    }`}
                  >
                    <Icon className="h-[16px] w-[16px] flex-none" aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-2.5 px-1 pt-4">
          <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-[#334155] text-[13px] font-semibold text-[#cbd5e1]">
            {email.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold">{email}</div>
            <form action={signOutAction}>
              <button type="submit" className="text-[11px] text-[#94a3b8] underline">
                {t.signOut}
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-h-screen flex-1 flex-col bg-[#f4f6f8]">
        <div className="flex items-center border-b border-[#e9edf2] bg-white px-4 py-3 md:px-8">
          <GlobalSearch />
        </div>
        <div className="flex-1 pb-16 md:pb-0">{children}</div>

        {/* Mobile bottom tabs */}
        <nav className="fixed inset-x-0 bottom-0 flex border-t border-[#e9edf2] bg-white px-2 py-2 md:hidden">
          {NAV_ITEMS.map((item) => {
            const active = item.href === currentHref;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10.5px] font-semibold ${
                  active ? "text-[#2563eb]" : "text-[#94a3b8]"
                }`}
              >
                <Icon className="h-[16px] w-[16px]" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
