import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatEuros, formatDateShort as formatDate } from "@/lib/format";

const STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf",
  final: "Final",
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-600",
  final: "bg-blue-50 text-blue-700",
  signed: "bg-[#dcfce7] text-[#16a34a]",
};

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id, name")
    .eq("id", id)
    .single();

  if (customerError || !customer) {
    notFound();
  }

  const { data: quotes, error: quotesError } = await supabase
    .from("quotes")
    .select("id, customer_description, status, total_cents, created_at")
    .eq("customer_id", id)
    .order("created_at", { ascending: false });
  if (quotesError) {
    console.error("Failed to load customer quotes:", quotesError);
  }

  // Warranty expiry dates for this customer's signed jobs (#127), keyed by
  // quote_id so they can be looked up per row below.
  const { data: warranties, error: warrantiesError } = await supabase
    .from("warranty_records")
    .select("quote_id, warranty_expiry_date")
    .eq("customer_id", id);
  if (warrantiesError) {
    console.error("Failed to load warranty records:", warrantiesError);
  }
  const warrantyExpiryByQuoteId = new Map(
    (warranties ?? []).map((w) => [w.quote_id, w.warranty_expiry_date]),
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[#0f172a]">{customer.name}</h1>
        <Link href="/customers" className="text-sm font-medium text-[#2563eb] hover:text-[#1d4ed8]">
          Zurück zu Kunden
        </Link>
      </div>
      <h2 className="text-lg font-medium text-[#0f172a]">Angebotsverlauf</h2>
      {!quotes || quotes.length === 0 ? (
        <div className="rounded-2xl border border-[#e9edf2] bg-white p-6">
          <p className="text-sm text-[#64748b]">
            Noch keine Angebote für diesen Kunden vorhanden.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#e9edf2] bg-white">
          {quotes.map((quote) => (
            <Link
              key={quote.id}
              href={`/quotes/${quote.id}`}
              className="flex items-center justify-between gap-4 border-b border-[#e9edf2] px-4 py-3 last:border-b-0 hover:bg-[#f4f6f8]"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-sm font-medium text-[#0f172a]">
                  {quote.customer_description.length > 60
                    ? `${quote.customer_description.slice(0, 60)}…`
                    : quote.customer_description}
                </span>
                <span className="font-mono text-xs text-[#94a3b8]">
                  {formatDate(quote.created_at)}
                </span>
                {warrantyExpiryByQuoteId.has(quote.id) && (
                  <span className="font-mono text-xs text-[#64748b]">
                    Gewährleistung bis {formatDate(warrantyExpiryByQuoteId.get(quote.id)!)}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="font-mono text-sm text-[#0f172a]">
                  {formatEuros(quote.total_cents)}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[quote.status] ?? "bg-[#f4f6f8] text-[#64748b]"}`}
                >
                  {STATUS_LABELS[quote.status] ?? quote.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
