"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  BarChart3,
  Briefcase,
  Calendar,
  FileSignature,
  FileText,
  Hand,
  LayoutTemplate,
  MoreHorizontal,
  Plug,
  Receipt,
  Settings as SettingsIcon,
  Tag,
  TriangleAlert,
  UserCog,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { GlobalSearch } from "@/components/GlobalSearch";
import { useAppLanguage } from "@/lib/i18n/AppLanguageProvider";
import { APP_SHELL_DICTIONARY } from "@/components/AppShell.dictionary";
import { useFieldMode } from "@/lib/field-mode/FieldModeProvider";

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
                href: "/settings/integrations",
                label: t.nav.integrations,
                icon: Plug,
                nested: true,
              },
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

// The mobile bottom bar only has room for a handful of equal-width tabs
// before labels start colliding/wrapping (confirmed at 375px). These four
// are the primary, most-used destinations; everything else (including the
// nested Settings sub-items) lives behind the "More" sheet, grouped exactly
// like the desktop sidebar via buildNavSections().
const PRIMARY_HREFS = ["/quotes", "/schedule", "/customers", "/jobs"];

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
  const { fieldMode, toggleFieldMode } = useFieldMode();
  const [moreOpen, setMoreOpen] = useState(false);
  const t = APP_SHELL_DICTIONARY[language];
  const sections = buildNavSections(t, role);
  const NAV_ITEMS = sections.flatMap((section) => section.items);
  const currentHref = activeHref(pathname, NAV_ITEMS);

  const primaryNavItems = PRIMARY_HREFS.map((href) =>
    NAV_ITEMS.find((item) => item.href === href),
  ).filter((item): item is NavItem => Boolean(item));
  // Everything not shown as a primary tab is grouped (reusing the same
  // section titles as the desktop sidebar) inside the "More" sheet.
  const moreSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !PRIMARY_HREFS.includes(item.href)),
    }))
    .filter((section) => section.items.length > 0);

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
                    className={`flex items-center gap-2.5 rounded-[10px] font-semibold transition-colors ${
                      fieldMode ? "py-4 text-base" : "py-2.5 text-sm"
                    } ${item.nested ? "ml-3 pl-3 pr-3" : "px-3"} ${
                      active
                        ? "bg-[#1e293b] text-white"
                        : "text-[#94a3b8] hover:bg-[#1e293b] hover:text-white"
                    }`}
                  >
                    <Icon
                      className={fieldMode ? "h-[22px] w-[22px] flex-none" : "h-[16px] w-[16px] flex-none"}
                      aria-hidden="true"
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-3 px-1 pt-4">
          <button
            type="button"
            onClick={toggleFieldMode}
            aria-pressed={fieldMode}
            aria-label={t.fieldMode.toggleAriaLabel}
            className={`flex items-center gap-2.5 rounded-[10px] px-3 font-semibold transition-colors ${
              fieldMode ? "bg-[#2563eb] py-4 text-base text-white" : "py-2.5 text-sm text-[#94a3b8] hover:bg-[#1e293b] hover:text-white"
            }`}
          >
            <Hand className={fieldMode ? "h-[22px] w-[22px] flex-none" : "h-[16px] w-[16px] flex-none"} aria-hidden="true" />
            <span className="truncate">{t.fieldMode.label}</span>
          </button>
          <div className="flex items-center gap-2.5">
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
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-h-screen flex-1 flex-col bg-[#f4f6f8]">
        <div className="flex items-center justify-between border-b border-[#e9edf2] bg-white px-4 py-3 md:px-8">
          <GlobalSearch />
          <button
            type="button"
            onClick={toggleFieldMode}
            aria-pressed={fieldMode}
            aria-label={t.fieldMode.toggleAriaLabel}
            className={`ml-3 flex flex-none items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-colors ${
              fieldMode
                ? "bg-[#2563eb] text-white"
                : "bg-[#f4f6f8] text-[#64748b] hover:bg-[#e9edf2]"
            }`}
          >
            <Hand className="h-[14px] w-[14px]" aria-hidden="true" />
            <span className="hidden sm:inline">{t.fieldMode.label}</span>
          </button>
        </div>
        <div className={`flex-1 ${fieldMode ? "pb-24" : "pb-16"} md:pb-0`}>{children}</div>

        {/* Mobile bottom tabs: a handful of primary destinations plus a
            "More" tab that opens a bottom sheet with everything else. */}
        <nav
          className={`fixed inset-x-0 bottom-0 flex border-t border-[#e9edf2] bg-white px-2 md:hidden ${
            fieldMode ? "py-3" : "py-2"
          }`}
        >
          {primaryNavItems.map((item) => {
            const active = item.href === currentHref;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg font-semibold ${
                  fieldMode ? "py-2.5 text-[12px]" : "py-1.5 text-[10.5px]"
                } ${active ? "text-[#2563eb]" : "text-[#94a3b8]"}`}
              >
                <Icon className={fieldMode ? "h-[22px] w-[22px]" : "h-[16px] w-[16px]"} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg font-semibold ${
              fieldMode ? "py-2.5 text-[12px]" : "py-1.5 text-[10.5px]"
            } text-[#94a3b8]`}
          >
            <MoreHorizontal
              className={fieldMode ? "h-[22px] w-[22px]" : "h-[16px] w-[16px]"}
              aria-hidden="true"
            />
            <span>{t.more}</span>
          </button>
        </nav>

        {/* "More" bottom sheet: everything not shown as a primary tab,
            grouped exactly like the desktop sidebar. */}
        {moreOpen ? (
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              type="button"
              aria-label={t.closeMore}
              onClick={() => setMoreOpen(false)}
              className="absolute inset-0 bg-black/40"
            />
            <div className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-t-2xl bg-white p-4 pb-8 shadow-[0_-8px_24px_rgba(15,23,42,0.15)]">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-[#0f172a]">{t.more}</span>
                <button
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  aria-label={t.closeMore}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[#64748b] hover:bg-[#f4f6f8]"
                >
                  <X className="h-[18px] w-[18px]" aria-hidden="true" />
                </button>
              </div>
              <nav className="flex flex-col gap-4">
                {moreSections.map((section) => (
                  <div
                    key={section.title ?? section.items[0]?.href}
                    className="flex flex-col gap-1"
                  >
                    {section.title ? (
                      <div className="px-3 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-[#94a3b8]">
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
                          onClick={() => setMoreOpen(false)}
                          className={`flex items-center gap-2.5 rounded-[10px] py-2.5 text-sm font-semibold transition-colors ${
                            item.nested ? "ml-3 pl-3 pr-3" : "px-3"
                          } ${active ? "bg-[#eef2ff] text-[#2563eb]" : "text-[#0f172a] hover:bg-[#f4f6f8]"}`}
                        >
                          <Icon className="h-[18px] w-[18px] flex-none" aria-hidden="true" />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </nav>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
