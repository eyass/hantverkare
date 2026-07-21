import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE");
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf",
  final: "Final",
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

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{customer.name}</h1>
        <Link href="/customers" className="text-sm underline">
          Zurück zu Kunden
        </Link>
      </div>
      <h2 className="text-lg font-medium">Angebotsverlauf</h2>
      {!quotes || quotes.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Noch keine Angebote für diesen Kunden vorhanden.
        </p>
      ) : (
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-300 dark:border-zinc-700">
              <th className="py-2">Beschreibung</th>
              <th className="py-2">Status</th>
              <th className="py-2">Gesamt</th>
              <th className="py-2">Erstellt</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((quote) => (
              <tr key={quote.id} className="border-b border-zinc-200 dark:border-zinc-800">
                <td className="py-2">
                  <Link href={`/quotes/${quote.id}`} className="underline">
                    {quote.customer_description.length > 60
                      ? `${quote.customer_description.slice(0, 60)}…`
                      : quote.customer_description}
                  </Link>
                </td>
                <td className="py-2">{STATUS_LABELS[quote.status] ?? quote.status}</td>
                <td className="py-2">{formatEuros(quote.total_cents)}</td>
                <td className="py-2">{formatDate(quote.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
