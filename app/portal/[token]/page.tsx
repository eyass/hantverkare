import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPortalToken } from "@/lib/portal/token";
import { setPortalSessionCookie, getPortalSession } from "@/lib/portal/session";
import { formatEuros, formatDate as formatDateBase } from "@/lib/format";

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return formatDateBase(iso);
}

const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf",
  final: "Ausstehend",
  signed: "Signiert",
  declined: "Abgelehnt",
};

// Pulled out of the component body: react-hooks/purity flags calling
// impure functions like Date.now() directly during render.
function isStillValid(expiresAtIso: string): boolean {
  return new Date(expiresAtIso).getTime() > Date.now();
}

/**
 * Public customer-portal page (issue #154). Mirrors the security model of
 * app/q/[token]/page.tsx and app/gallery/[token]/page.tsx: there is no
 * Supabase Auth session involved here at all -- the magic-link token in the
 * URL (or, on repeat navigation, the signed session cookie set below) IS the
 * access control. Everything is read via the service-role admin client
 * (lib/supabase/admin.ts), which deliberately bypasses RLS -- the whole point
 * of this route is to serve a customer who is not, and never will be, an
 * auth.users row (see public.customers, 0005_customers.sql).
 *
 * Read-only v1 per the issue's explicit scope: quotes, invoices, scheduled
 * jobs, and warranty records for the customer -- no editing capability
 * anywhere on this page.
 */
export default async function CustomerPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  let customerId: string;
  let organizationId: string;

  const tokenHash = hashPortalToken(token);
  const { data: tokenRow, error: tokenError } = await admin
    .from("customer_portal_tokens")
    .select("customer_id, organization_id, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (tokenRow && isStillValid(tokenRow.expires_at)) {
    customerId = tokenRow.customer_id;
    organizationId = tokenRow.organization_id;

    // Stamp first-use for auditing (best effort, never blocks the page).
    // Intentionally not a hard single-use gate: the emailed link may
    // legitimately be opened more than once (different device, cookie
    // cleared, etc.) within its 24h window -- the signed session cookie
    // below is what actually shortens how often the raw token needs to be
    // re-used at all.
    await admin
      .from("customer_portal_tokens")
      .update({ consumed_at: new Date().toISOString() })
      .eq("token_hash", tokenHash)
      .is("consumed_at", null);

    await setPortalSessionCookie({ customerId, organizationId });
  } else {
    if (tokenError) {
      console.error("Failed to load customer portal token", tokenError);
    }
    // Fall back to an existing signed session cookie -- lets a customer
    // continue browsing /portal/[token] links they've already bookmarked (or
    // a stale link they revisit) as long as their browser session cookie
    // from an earlier, valid visit is still live.
    const session = await getPortalSession();
    if (!session) {
      notFound();
    }
    customerId = session.customerId;
    organizationId = session.organizationId;
  }

  const { data: customer, error: customerError } = await admin
    .from("customers")
    .select("id, name, email")
    .eq("id", customerId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!customer) {
    if (customerError) {
      console.error("Failed to load customer for portal", customerError);
    }
    notFound();
  }

  const { data: quotes, error: quotesError } = await admin
    .from("quotes")
    .select("id, customer_description, status, total_cents, signed_at, created_at")
    .eq("customer_id", customerId)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (quotesError) {
    console.error("Failed to load quotes for portal", quotesError);
  }

  const quoteIds = (quotes ?? []).map((q) => q.id);

  const [{ data: invoices, error: invoicesError }, { data: jobs, error: jobsError }, { data: warranties, error: warrantiesError }] =
    await Promise.all([
      quoteIds.length > 0
        ? admin
            .from("invoices")
            .select("id, invoice_number, issued_at, total_cents, quote_id")
            .in("quote_id", quoteIds)
            .order("issued_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      quoteIds.length > 0
        ? admin
            .from("scheduled_jobs")
            .select("id, scheduled_start, scheduled_end, notes, quote_id")
            .in("quote_id", quoteIds)
            .order("scheduled_start", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      admin
        .from("warranty_records")
        .select("id, scope_description, warranty_start_date, warranty_expiry_date, quote_id")
        .eq("customer_id", customerId)
        .order("warranty_start_date", { ascending: false }),
    ]);
  if (invoicesError) console.error("Failed to load invoices for portal", invoicesError);
  if (jobsError) console.error("Failed to load scheduled jobs for portal", jobsError);
  if (warrantiesError) console.error("Failed to load warranty records for portal", warrantiesError);

  const quotesById = new Map((quotes ?? []).map((q) => [q.id, q]));

  return (
    <div className="min-h-screen bg-[#0f172a] px-4 py-10 sm:px-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 rounded-2xl bg-white p-6 shadow-xl sm:p-10">
        <div>
          <h1 className="text-2xl font-semibold text-[#0f172a]">Ihr Kundenportal</h1>
          <p className="mt-1 text-sm text-[#64748b]">
            Willkommen{customer.name ? `, ${customer.name}` : ""}. Hier finden Sie alle Ihre Angebote, Rechnungen,
            Termine und Gewährleistungen im Überblick.
          </p>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-[#0f172a]">Angebote</h2>
          {(quotes ?? []).length === 0 ? (
            <p className="text-sm text-[#64748b]">Es liegen noch keine Angebote vor.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#e9edf2]">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#e9edf2] bg-[#f4f6f8] text-[#64748b]">
                    <th className="px-4 py-3 font-medium">Beschreibung</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Gesamt</th>
                  </tr>
                </thead>
                <tbody>
                  {(quotes ?? []).map((quote) => (
                    <tr key={quote.id} className="border-b border-[#e9edf2] last:border-b-0">
                      <td className="px-4 py-3 text-[#0f172a]">{quote.customer_description}</td>
                      <td className="px-4 py-3 text-[#64748b]">{QUOTE_STATUS_LABELS[quote.status] ?? quote.status}</td>
                      <td className="px-4 py-3 font-mono text-[#0f172a]">{formatEuros(quote.total_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-[#0f172a]">Rechnungen</h2>
          {(invoices ?? []).length === 0 ? (
            <p className="text-sm text-[#64748b]">Es liegen noch keine Rechnungen vor.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#e9edf2]">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#e9edf2] bg-[#f4f6f8] text-[#64748b]">
                    <th className="px-4 py-3 font-medium">Rechnungsnr.</th>
                    <th className="px-4 py-3 font-medium">Datum</th>
                    <th className="px-4 py-3 font-medium">Gesamt</th>
                  </tr>
                </thead>
                <tbody>
                  {(invoices ?? []).map((invoice) => (
                    <tr key={invoice.id} className="border-b border-[#e9edf2] last:border-b-0">
                      <td className="px-4 py-3 text-[#0f172a]">{invoice.invoice_number}</td>
                      <td className="px-4 py-3 text-[#64748b]">{formatDate(invoice.issued_at)}</td>
                      <td className="px-4 py-3 font-mono text-[#0f172a]">{formatEuros(invoice.total_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-[#0f172a]">Geplante Termine</h2>
          {(jobs ?? []).length === 0 ? (
            <p className="text-sm text-[#64748b]">Es sind keine Termine geplant.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {(jobs ?? []).map((job) => (
                <li key={job.id} className="rounded-xl border border-[#e9edf2] p-4">
                  <p className="text-sm font-medium text-[#0f172a]">{formatDate(job.scheduled_start)}</p>
                  <p className="text-xs text-[#64748b]">{quotesById.get(job.quote_id)?.customer_description}</p>
                  {job.notes && <p className="mt-1 text-xs text-[#64748b]">{job.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-[#0f172a]">Gewährleistung</h2>
          {(warranties ?? []).length === 0 ? (
            <p className="text-sm text-[#64748b]">Es liegen keine Gewährleistungsunterlagen vor.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {(warranties ?? []).map((warranty) => (
                <li key={warranty.id} className="rounded-xl border border-[#e9edf2] p-4">
                  <p className="text-sm font-medium text-[#0f172a]">{warranty.scope_description}</p>
                  <p className="text-xs text-[#64748b]">
                    Gültig von {formatDate(warranty.warranty_start_date)} bis {formatDate(warranty.warranty_expiry_date)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
