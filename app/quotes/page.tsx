import Link from "next/link";
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
    .select("id, customer_description, status, total_cents, created_at")
    .order("created_at", { ascending: false });
  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }
  const { data: quotes, error } = await query;
  if (error) {
    console.error("Failed to load quotes:", error);
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Angebote</h1>
        <Link
          href="/quotes/new"
          className="rounded-full bg-foreground px-5 py-3 text-sm text-background"
        >
          Neues Angebot
        </Link>
      </div>
      <div className="flex gap-4 text-sm">
        <Link href="/quotes" className={statusFilter === null ? "font-semibold underline" : "underline"}>
          Alle
        </Link>
        <Link
          href="/quotes?status=draft"
          className={statusFilter === "draft" ? "font-semibold underline" : "underline"}
        >
          Entwürfe
        </Link>
        <Link
          href="/quotes?status=final"
          className={statusFilter === "final" ? "font-semibold underline" : "underline"}
        >
          Final
        </Link>
      </div>
      {!quotes || quotes.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Noch keine Angebote vorhanden.{" "}
          <Link href="/quotes/new" className="underline">
            Jetzt erstellen
          </Link>
          .
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
