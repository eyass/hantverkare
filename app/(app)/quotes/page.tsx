import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatExpiryBadge } from "@/lib/quotes/expiry";
import { computeQuoteDisplayStatus } from "@/lib/quotes/status";
import { getOnboardingChecklistState } from "@/lib/organizations/getOnboardingChecklist";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { getUserLanguage } from "@/lib/i18n/getUserLanguage";
import { QUOTES_DICTIONARY } from "./quotes.dictionary";
import { isStalledQuote, daysSinceFinalized } from "@/lib/quotes/followup";
import { StalledQuotesSection, type StalledQuote } from "./StalledQuotesSection";

function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE");
}

function formatJobDateTime(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const UPCOMING_JOBS_LIMIT = 5;


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
    .select("id, customer_description, status, total_cents, created_at, expires_at, declined_at")
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

  // Stalled-quotes follow-up nudges (issue #158): quotes sent (status =
  // "final") but neither signed nor declined for a while. Read-only query
  // reusing existing status/timestamp columns -- see lib/quotes/followup.ts.
  const { data: candidateStalledQuotes, error: stalledError } = await supabase
    .from("quotes")
    .select("id, customer_description, status, declined_at, signed_at, finalized_at")
    .eq("status", "final")
    .is("declined_at", null)
    .is("signed_at", null)
    .not("finalized_at", "is", null)
    .order("finalized_at", { ascending: true });
  if (stalledError) {
    console.error("Failed to load stalled quotes:", stalledError);
  }
  const now = new Date();
  const stalledQuotes: StalledQuote[] = (candidateStalledQuotes ?? [])
    .filter((q) =>
      isStalledQuote(
        { status: q.status, declinedAt: q.declined_at, signedAt: q.signed_at, finalizedAt: q.finalized_at },
        now,
      ),
    )
    .map((q) => ({
      id: q.id,
      customerDescription: q.customer_description,
      daysSinceSent: daysSinceFinalized(new Date(q.finalized_at as string), now),
    }));

  const checklistState = await getOnboardingChecklistState(supabase);
  const language = await getUserLanguage(supabase);
  const t = QUOTES_DICTIONARY[language];
  const STATUS_LABELS = t.status;

  // "Anstehende Termine" widget (issue #124): this repo has no dedicated
  // dashboard route, so the quotes list -- the closest thing to a home
  // screen for authenticated users -- surfaces the next few upcoming
  // scheduled jobs, with links to each quote and to the full /schedule view.
  const { data: upcomingJobsRaw, error: upcomingJobsError } = await supabase
    .from("scheduled_jobs")
    .select("id, scheduled_start, quote_id, quotes(customer_description)")
    .gte("scheduled_start", new Date().toISOString())
    .order("scheduled_start", { ascending: true })
    .limit(UPCOMING_JOBS_LIMIT);
  if (upcomingJobsError) {
    console.error("Failed to load upcoming scheduled jobs:", upcomingJobsError);
  }
  const upcomingJobs = (upcomingJobsRaw ?? []) as unknown as {
    id: string;
    scheduled_start: string;
    quote_id: string;
    quotes: { customer_description: string } | null;
  }[];

  const statusBadgeClasses: Record<string, string> = {
    draft: "bg-zinc-100 text-zinc-600",
    final: "bg-blue-50 text-blue-700",
    signed: "bg-[#dcfce7] text-[#16a34a]",
    declined: "bg-[#fee2e2] text-[#b91c1c]",
  };

  const expiryBadgeClasses: Record<"neutral" | "warning" | "expired", string> = {
    neutral: "bg-zinc-100 text-zinc-600",
    warning: "bg-[#fef3c7] text-[#b45309]",
    expired: "bg-[#fee2e2] text-[#b91c1c]",
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[#0f172a]">{t.title}</h1>
        <div className="flex items-center gap-2">
          <a
            href="/api/export/quotes"
            download
            className="rounded-full border border-[#e9edf2] bg-white px-4 py-3 text-sm font-medium text-[#0f172a] transition-colors hover:bg-[#f4f6f8]"
          >
            {t.exportQuotesCsv}
          </a>
          <a
            href="/api/export/invoices"
            download
            className="rounded-full border border-[#e9edf2] bg-white px-4 py-3 text-sm font-medium text-[#0f172a] transition-colors hover:bg-[#f4f6f8]"
          >
            {t.exportInvoicesCsv}
          </a>
          <Link
            href="/quotes/new"
            className="rounded-full bg-[#2563eb] px-5 py-3 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(37,99,235,0.3)]"
          >
            {t.newQuote}
          </Link>
        </div>
      </div>

      <OnboardingChecklist state={checklistState} />

      <StalledQuotesSection quotes={stalledQuotes} />

      {upcomingJobs.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-[#e9edf2] bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#0f172a]">{t.upcomingJobsTitle}</h2>
            <Link href="/schedule" className="text-xs font-medium text-[#2563eb] hover:underline">
              {t.upcomingJobsViewAll}
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {upcomingJobs.map((job) => (
              <Link
                key={job.id}
                href={`/quotes/${job.quote_id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-[#e9edf2] bg-[#f8fafc] px-3 py-2 text-sm transition-colors hover:bg-[#f1f5f9]"
              >
                <span className="truncate text-[#0f172a]">{job.quotes?.customer_description ?? t.upcomingJobFallbackLabel}</span>
                <span className="font-mono shrink-0 text-xs text-[#64748b]">
                  {formatJobDateTime(job.scheduled_start)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="flex flex-col gap-1 rounded-2xl border border-[#e9edf2] bg-white p-3 sm:p-4">
          <span className="font-mono text-xl font-bold text-[#0f172a] sm:text-2xl">{totalCount}</span>
          <span className="text-xs text-[#64748b] sm:text-sm">{t.statAll}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-[#e9edf2] bg-white p-3 sm:p-4">
          <span className="font-mono text-xl font-bold text-[#0f172a] sm:text-2xl">{draftCount}</span>
          <span className="text-xs text-[#64748b] sm:text-sm">{t.statDrafts}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-[#e9edf2] bg-white p-3 sm:p-4">
          <span className="font-mono text-xl font-bold text-[#0f172a] sm:text-2xl">{finalSignedCount}</span>
          <span className="text-xs text-[#64748b] sm:text-sm">{t.statFinalSigned}</span>
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
          {t.filterAll}
        </Link>
        <Link
          href="/quotes?status=draft"
          className={
            statusFilter === "draft"
              ? "rounded-full bg-[#2563eb] px-4 py-1.5 font-semibold text-white"
              : "rounded-full px-4 py-1.5 text-[#64748b]"
          }
        >
          {t.filterDrafts}
        </Link>
        <Link
          href="/quotes?status=final"
          className={
            statusFilter === "final"
              ? "rounded-full bg-[#2563eb] px-4 py-1.5 font-semibold text-white"
              : "rounded-full px-4 py-1.5 text-[#64748b]"
          }
        >
          {t.filterFinal}
        </Link>
      </div>

      {!quotes || quotes.length === 0 ? (
        <p className="text-sm text-[#64748b]">
          {t.emptyState}{" "}
          <Link href="/quotes/new" className="text-[#2563eb] underline">
            {t.emptyStateCta}
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
                {quote.status === "final" && !quote.declined_at && quote.expires_at ? (
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
                {(() => {
                  const displayStatus = computeQuoteDisplayStatus({
                    status: quote.status,
                    declinedAt: quote.declined_at,
                  });
                  return (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        statusBadgeClasses[displayStatus] ?? "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {STATUS_LABELS[displayStatus] ?? displayStatus}
                    </span>
                  );
                })()}
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
