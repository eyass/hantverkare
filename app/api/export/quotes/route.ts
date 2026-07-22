import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv/toCsv";

function centsToEuroString(cents: number): string {
  return (cents / 100).toFixed(2);
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf",
  final: "Final",
  signed: "Signiert",
};

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  // No explicit organization filter: RLS on `quotes` scopes rows to the
  // caller's organization already (see supabase/migrations/0010_organizations.sql).
  const { data: quotes, error } = await supabase
    .from("quotes")
    .select("id, customer_description, status, subtotal_cents, vat_cents, total_cents, created_at, customers(name)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to export quotes:", error);
    return NextResponse.json({ error: "Export fehlgeschlagen" }, { status: 500 });
  }

  const headers = [
    "Erstellt am",
    "Kunde",
    "Beschreibung",
    "Status",
    "Zwischensumme (EUR)",
    "MwSt. (EUR)",
    "Gesamt (EUR)",
  ];

  const rows = (quotes ?? []).map((quote) => {
    const customer = Array.isArray(quote.customers) ? quote.customers[0] : quote.customers;
    return [
      new Date(quote.created_at).toLocaleDateString("de-DE"),
      customer?.name ?? "",
      quote.customer_description,
      STATUS_LABELS[quote.status] ?? quote.status,
      centsToEuroString(quote.subtotal_cents),
      centsToEuroString(quote.vat_cents),
      centsToEuroString(quote.total_cents),
    ];
  });

  const csv = toCsv(headers, rows);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="angebote.csv"',
    },
  });
}
