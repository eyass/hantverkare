import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatExpiryBadge } from "@/lib/quotes/expiry";
import { getOnboardingChecklistState } from "@/lib/organizations/getOnboardingChecklist";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";

function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE");
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf",
  final: "Final",
  signed: "Signiert",
};

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const statusFilter = status === "draft" || status === "final" ? status : null;

  const supabase = await createClient();
  let query = supabase
    .from("quotes")
    .select("id, customer_description, status, total_cents, created_at, expires_at")
    .order("created_at", { ascending: false });
  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }
  const { data: quotes, error } = await query;
  if (error) {
    console.error("Failed to load quotes:", error);
  }

  const { data: allStatuses, error: statusesError } = await supabase
    .from("quotes")
    .select("status");
  if (statusesError) {
    console.error("Failed to load quote status counts:", statusesError);
  }

  const allQuotes = allStatuses ?? [];
  const totalCount = allQuotes.length;
  const draftCount = allQuotes.filter((q) => q.status === "draft").length;
  const finalSignedCount = allQuotes.filter(
    (q) => q.status === "final" || q.status === "signed",
  ).length;

  const checklistState = await getOnboardingChecklistState(supabase);

  const statusBadgeClasses: Record<string, string> = {
    draft: "bg-zinc-100 text-zinc-600",
    final: "bg-blue-50 text-blue-700",
    signed: "bg-[#dcfce7] text-[#16a34a]",
  };

  const expiryBadgeClasses: Record<"neutral" | "warning" | "expired", string> = {
    neutral: "bg-zinc-100 text-zinc-600",
    warning: "bg-[#fef3c7] text-[#b45309]",
    expired: "bg-[#fee2e2] text-[#b91c1c]",
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[#0f172a]">Angebote</h1>
        <div className="flex items-center gap-2">
          <a
            href="/api/export/quotes"
            download
            className="rounded-full border border-[#e9edf2] bg-white px-4 py-3 text-sm font-medium text-[#0f172a] transition-colors hover:bg-[#f4f6f8]"
          >
            Angebote als CSV exportieren
          </a>
          <a
            href="/api/export/invoices"
            download
            className="rounded-full border border-[#e9edf2] bg-white px-4 py-3 text-sm font-medium text-[#0f172a] transition-colors hover:bg-[#f4f6f8]"
          >
            Rechnungen als CSV exportieren
          </a>
          <Link
            href="/quotes/new"
            className="rounded-full bg-[#2563eb] px-5 py-3 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(37,99,235,0.3)]"
          >
            Neues Angebot
          </Link>
        </div>
      </div>

      <OnboardingChecklist state={checklistState} />

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1 rounded-2xl border border-[#e9edf2] bg-white p-4">
          <span className="font-mono text-2xl font-bold text-[#0f172a]">{totalCount}</span>
          <span className="text-sm text-[#64748b]">Alle Angebote</span>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-[#e9edf2] bg-white p-4">
          <span className="font-mono text-2xl font-bold text-[#0f172a]">{draftCount}</span>
          <span className="text-sm text-[#64748b]">Entwürfe</span>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-[#e9edf2] bg-white p-4">
          <span className="font-mono text-2xl font-bold text-[#0f172a]">{finalSignedCount}</span>
          <span className="text-sm text-[#64748b]">Final/Signiert</span>
        </div>
      </div>

      <div className="flex w-fit gap-1 rounded-full border border-[#e9edf2] bg-white p-1 text-sm">
        <Link
          href="/quotes"
          className={
            statusFilter === null
              ? "rounded-full bg-[#2563eb] px-4 py-1.5 font-semibold text-white"
              : "rounded-full px-4 py-1.5 text-[#64748b]"
          }
        >
          Alle
        </Link>
        <Link
          href="/quotes?status=draft"
          className={
            statusFilter === "draft"
              ? "rounded-full bg-[#2563eb] px-4 py-1.5 font-semibold text-white"
              : "rounded-full px-4 py-1.5 text-[#64748b]"
          }
        >
          Entwürfe
        </Link>
        <Link
          href="/quotes?status=final"
          className={
            statusFilter === "final"
              ? "rounded-full bg-[#2563eb] px-4 py-1.5 font-semibold text-white"
              : "rounded-full px-4 py-1.5 text-[#64748b]"
          }
        >
          Final
        </Link>
      </div>

      {!quotes || quotes.length === 0 ? (
        <p className="text-sm text-[#64748b]">
          Noch keine Angebote vorhanden.{" "}
          <Link href="/quotes/new" className="text-[#2563eb] underline">
            Jetzt erstellen
          </Link>
          .
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#e9edf2] bg-white">
          {quotes.map((quote, index) => (
            <Link
              key={quote.id}
              href={`/quotes/${quote.id}`}
              className={`flex items-center justify-between gap-4 p-4 transition-colors hover:bg-[#f4f6f8] ${
                index !== 0 ? "border-t border-[#e9edf2]" : ""
              }`}
            >
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-[#0f172a]">
                  {quote.customer_description.length > 60
                    ? `${quote.customer_description.slice(0, 60)}…`
                    : quote.customer_description}
                </span>
                <span className="font-mono text-xs text-[#94a3b8]">
                  {formatDate(quote.created_at)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {quote.status === "final" && quote.expires_at ? (
                  (() => {
                    const badge = formatExpiryBadge(new Date(quote.expires_at));
                    return (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${expiryBadgeClasses[badge.tone]}`}
                      >
                        {badge.label}
                      </span>
                    );
                  })()
                ) : null}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    statusBadgeClasses[quote.status] ?? "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  {STATUS_LABELS[quote.status] ?? quote.status}
                </span>
                <span className="font-mono text-sm font-semibold text-[#0f172a]">
                  {formatEuros(quote.total_cents)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
