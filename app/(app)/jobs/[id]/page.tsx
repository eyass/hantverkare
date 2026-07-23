import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeQuoteDisplayStatus } from "@/lib/quotes/status";

const STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf",
  final: "Final",
  signed: "Signiert",
  declined: "Abgelehnt",
};

function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

/**
 * Read-only job view for the assignee (issue #128) -- the "shared job link"
 * from the issue. No new auth surface: the underlying select still goes
 * through the same org-scoped `quotes`/`quote_line_items` RLS policies every
 * other page in the app uses (is_org_member(organization_id)), so this page
 * grants nothing a member couldn't already reach via /quotes/[id]. The one
 * thing enforced here, at the page level rather than in RLS, is that this
 * particular *simplified* view is scoped to the job's current assignee --
 * anyone else (including another member) is redirected to the full editor
 * instead of seeing a stripped-down page that isn't meant for them.
 */
export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select(
      "id, customer_description, status, subtotal_cents, vat_cents, total_cents, declined_at, decline_reason, assigned_to",
    )
    .eq("id", id)
    .maybeSingle();
  if (!quote) {
    if (quoteError) {
      console.error("Failed to load job/quote", id, quoteError);
    }
    notFound();
  }
  if (quote.assigned_to !== user.id) {
    // Not this user's assigned job -- send them to the full editor instead
    // (ordinary org RLS still governs whether they can view it there).
    redirect(`/quotes/${id}`);
  }

  const { data: lineItems, error: lineItemsError } = await supabase
    .from("quote_line_items")
    .select("id, description, quantity, unit, unit_price_cents, line_total_cents, position")
    .eq("quote_id", id)
    .order("position");
  if (lineItemsError) {
    console.error("Failed to load line items for job", id, lineItemsError);
  }

  const displayStatus = computeQuoteDisplayStatus({
    status: quote.status,
    declinedAt: quote.declined_at,
  });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6 sm:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-[#0f172a]">Job</h1>
        <span className="rounded-full bg-[#dbeafe] px-3 py-1 text-xs font-medium text-[#1d4ed8]">
          {STATUS_LABELS[displayStatus] ?? displayStatus}
        </span>
      </div>
      <p className="text-[#64748b]">{quote.customer_description}</p>
      {quote.declined_at && (
        <p className="rounded-xl border border-[#fecaca] bg-red-50 px-4 py-2 text-sm text-[#b91c1c]">
          Vom Kunden abgelehnt.{quote.decline_reason ? ` Grund: ${quote.decline_reason}` : ""}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-[#e9edf2] bg-white">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[#e9edf2] bg-[#f8fafc] text-xs uppercase tracking-wide text-[#94a3b8]">
              <th className="px-4 py-3 font-medium">Beschreibung</th>
              <th className="px-4 py-3 font-medium">Menge</th>
              <th className="px-4 py-3 font-medium">Einheit</th>
              <th className="px-4 py-3 font-medium">Gesamt</th>
            </tr>
          </thead>
          <tbody>
            {(lineItems ?? []).map((item) => (
              <tr key={item.id} className="border-b border-[#e9edf2] last:border-b-0">
                <td className="px-4 py-3">{item.description}</td>
                <td className="px-4 py-3">{item.quantity}</td>
                <td className="px-4 py-3">{item.unit}</td>
                <td className="px-4 py-3 font-mono">{formatEuros(item.line_total_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-1 self-end text-right">
        <span className="text-sm text-[#64748b]">
          Zwischensumme: {formatEuros(quote.subtotal_cents)}
        </span>
        <span className="text-sm text-[#64748b]">MwSt.: {formatEuros(quote.vat_cents)}</span>
        <span className="text-lg font-semibold text-[#0f172a]">
          Gesamt: {formatEuros(quote.total_cents)}
        </span>
      </div>
    </div>
  );
}
