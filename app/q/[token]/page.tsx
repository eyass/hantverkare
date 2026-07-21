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
      <div className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
        <h1 className="text-2xl font-semibold">Angebot</h1>
        <p className="rounded-lg border border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          Dieses Angebot ist noch nicht bereit zur Ansicht.
        </p>
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
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Angebot</h1>
      <p className="text-zinc-600 dark:text-zinc-400">{quote.customer_description}</p>

      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-300 dark:border-zinc-700">
            <th className="py-2">Beschreibung</th>
            <th className="py-2">Menge</th>
            <th className="py-2">Einheit</th>
            <th className="py-2">Einzelpreis</th>
            <th className="py-2">Gesamt</th>
          </tr>
        </thead>
        <tbody>
          {(lineItems ?? []).map((item) => (
            <tr key={item.id} className="border-b border-zinc-200 dark:border-zinc-800">
              <td className="py-2">{item.description}</td>
              <td className="py-2">{item.quantity}</td>
              <td className="py-2">{item.unit}</td>
              <td className="py-2">{formatEuros(item.unit_price_cents)}</td>
              <td className="py-2">{formatEuros(item.line_total_cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-col items-end gap-1 text-sm">
        <p>Zwischensumme: {formatEuros(quote.subtotal_cents)}</p>
        <p>MwSt. (19%): {formatEuros(quote.vat_cents)}</p>
        <p className="text-base font-semibold">Gesamt: {formatEuros(quote.total_cents)}</p>
      </div>

      {quote.status === "final" && <SignForm token={token} />}

      {quote.status === "signed" && (
        <p className="rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
          Signiert am {quote.signed_at ? formatDate(quote.signed_at) : "-"} von {quote.signer_name ?? "-"}.
        </p>
      )}
    </div>
  );
}
