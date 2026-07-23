import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv/toCsv";

function centsToEuroString(cents: number): string {
  return (cents / 100).toFixed(2);
}

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  // No explicit organization filter: RLS on `invoices` (and the joined
  // `quotes`/`customers`) scopes rows to the caller's organization already
  // (see supabase/migrations/0010_organizations.sql).
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, issued_at, subtotal_cents, vat_cents, total_cents, quotes(customer_description, customers(name))",
    )
    .order("issued_at", { ascending: false });

  if (error) {
    console.error("Failed to export invoices:", error);
    return NextResponse.json({ error: "Export fehlgeschlagen" }, { status: 500 });
  }

  const headers = [
    "Rechnungsnummer",
    "Rechnungsdatum",
    "Kunde",
    "Angebot",
    "Zwischensumme (EUR)",
    "MwSt. (EUR)",
    "Gesamt (EUR)",
  ];

  const rows = (invoices ?? []).map((invoice) => {
    const quote = Array.isArray(invoice.quotes) ? invoice.quotes[0] : invoice.quotes;
    const customer = quote ? (Array.isArray(quote.customers) ? quote.customers[0] : quote.customers) : null;
    return [
      invoice.invoice_number,
      new Date(invoice.issued_at).toLocaleDateString("de-DE"),
      customer?.name ?? "",
      quote?.customer_description ?? "",
      centsToEuroString(invoice.subtotal_cents),
      centsToEuroString(invoice.vat_cents),
      centsToEuroString(invoice.total_cents),
    ];
  });

  const csv = toCsv(headers, rows);

  // Append-only audit log entry for this export event (see
  // supabase/migrations/0034_gobd_invoice_compliance.sql). Not awaited-as-fatal:
  // a failed audit-log write should not block the export itself.
  const invoiceIds = (invoices ?? []).map((i) => i.id);
  if (invoiceIds.length > 0) {
    supabase.rpc("log_invoice_export", { p_invoice_ids: invoiceIds, p_format: "csv" }).then(({ error: logError }) => {
      if (logError) console.error("Failed to log invoice export event:", logError);
    });
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="rechnungen.csv"',
    },
  });
}
