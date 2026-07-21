import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { SignForm } from "./SignForm";

function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", { year: "numeric", month: "long", day: "numeric" });
}

export default async function PublicQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select("id, customer_description, status, subtotal_cents, vat_cents, total_cents, signed_at, signer_name")
    .eq("share_token", token)
    .single();
  if (!quote) notFound();

  // Defense in depth: a draft quote's pricing detail is never fetched or rendered for
  // the public link, even though an unguessable share_token is the primary access
  // control. Drafts aren't meant to be shared yet.
  if (quote.status === "draft") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f172a] p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
          <h1 className="text-xl font-semibold text-[#0f172a]">Angebot</h1>
          <p className="mt-4 text-sm text-[#64748b]">
            Dieses Angebot ist noch nicht bereit zur Ansicht.
          </p>
        </div>
      </div>
    );
  }

  const { data: lineItems, error: lineItemsError } = await supabase
    .from("quote_line_items")
    .select("id, description, quantity, unit, unit_price_cents, line_total_cents, position")
    .eq("quote_id", quote.id)
    .order("position");
  if (lineItemsError) {
    console.error("Failed to load line items for public quote", quote.id, lineItemsError);
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#0f172a] px-4 py-10 sm:px-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 rounded-2xl bg-white p-6 shadow-xl sm:p-10">
        <div>
          <h1 className="text-2xl font-semibold text-[#0f172a]">Angebot</h1>
          <p className="mt-1 text-sm text-[#64748b]">{quote.customer_description}</p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[#e9edf2]">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#e9edf2] bg-[#f4f6f8] text-[#64748b]">
                <th className="px-4 py-3 font-medium">Beschreibung</th>
                <th className="px-4 py-3 font-medium">Menge</th>
                <th className="px-4 py-3 font-medium">Einheit</th>
                <th className="px-4 py-3 font-medium">Einzelpreis</th>
                <th className="px-4 py-3 font-medium">Gesamt</th>
              </tr>
            </thead>
            <tbody>
              {(lineItems ?? []).map((item) => (
                <tr key={item.id} className="border-b border-[#e9edf2] last:border-b-0">
                  <td className="px-4 py-3 text-[#0f172a]">{item.description}</td>
                  <td className="px-4 py-3 font-mono text-[#0f172a]">{item.quantity}</td>
                  <td className="px-4 py-3 text-[#64748b]">{item.unit}</td>
                  <td className="px-4 py-3 font-mono text-[#0f172a]">{formatEuros(item.unit_price_cents)}</td>
                  <td className="px-4 py-3 font-mono text-[#0f172a]">{formatEuros(item.line_total_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-end gap-1 self-end text-sm">
          <p className="text-[#64748b]">
            Zwischensumme: <span className="font-mono text-[#0f172a]">{formatEuros(quote.subtotal_cents)}</span>
          </p>
          <p className="text-[#64748b]">
            MwSt. (19%): <span className="font-mono text-[#0f172a]">{formatEuros(quote.vat_cents)}</span>
          </p>
          <p className="text-base font-semibold text-[#0f172a]">
            Gesamt: <span className="font-mono">{formatEuros(quote.total_cents)}</span>
          </p>
        </div>

        {quote.status === "final" && <SignForm token={token} />}

        {quote.status === "signed" && (
          <div className="rounded-2xl bg-[#dcfce7] p-6 text-center">
            <p className="text-sm font-medium text-[#16a34a]">
              Signiert am {quote.signed_at ? formatDate(quote.signed_at) : "-"} von {quote.signer_name ?? "-"}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
