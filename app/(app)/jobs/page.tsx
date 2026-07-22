import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeQuoteDisplayStatus } from "@/lib/quotes/status";

const STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf",
  final: "Final",
  signed: "Signiert",
  declined: "Abgelehnt",
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-600",
  final: "bg-blue-50 text-blue-700",
  signed: "bg-[#dcfce7] text-[#16a34a]",
  declined: "bg-[#fee2e2] text-[#b91c1c]",
};

function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE");
}

/**
 * "Meine Jobs" (issue #128): a lightweight, read-only list of the quotes
 * assigned to the signed-in user -- the "shared job link" the issue asks for.
 * Data access still goes through the ordinary org-scoped `quotes` RLS policy
 * (any member can already see every org quote); this page just filters and
 * renders a simpler view than the full quote editor, it grants no new access.
 */
export default async function JobsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: quotes, error } = await supabase
    .from("quotes")
    .select("id, customer_description, status, total_cents, created_at, declined_at")
    .eq("assigned_to", user.id)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Failed to load assigned jobs:", error);
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold text-[#0f172a]">Meine Jobs</h1>
      <p className="text-sm text-[#64748b]">
        Angebote, die dir zugewiesen wurden. Diese Ansicht ist schreibgeschützt --
        Änderungen nimmst du im vollständigen Angebot vor.
      </p>

      {!quotes || quotes.length === 0 ? (
        <p className="text-sm text-[#64748b]">Dir ist aktuell kein Job zugewiesen.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#e9edf2] bg-white">
          {quotes.map((quote, index) => {
            const displayStatus = computeQuoteDisplayStatus({
              status: quote.status,
              declinedAt: quote.declined_at,
            });
            return (
              <Link
                key={quote.id}
                href={`/jobs/${quote.id}`}
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
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      STATUS_BADGE_CLASSES[displayStatus] ?? "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {STATUS_LABELS[displayStatus] ?? displayStatus}
                  </span>
                  <span className="font-mono text-sm font-semibold text-[#0f172a]">
                    {formatEuros(quote.total_cents)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
