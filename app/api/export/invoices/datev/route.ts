import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildDatevInvoiceExport, type DatevInvoiceRow } from "@/lib/export/datev";
import { encodeCp1252 } from "@/lib/csv/toDatevCsv";

// DATEV EXTF-adjacent export (v1, see lib/export/datev.ts's module doc
// comment for what "adjacent" means here and why a full Buchungsstapel
// export is out of scope for now).
//
// IMPORTANT: this export has not been confirmed against a real DATEV import
// by a Steuerberater -- see the in-app notice on /invoices and the PR
// description. Do not treat successful generation of this file as proof it
// is compliant or importable as-is.
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  // RLS scopes both queries to the caller's organization (see
  // supabase/migrations/0010_organizations.sql / 0034_gobd_invoice_compliance.sql).
  const { data: invoices, error: invoicesError } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, issued_at, subtotal_cents, vat_cents, total_cents, voided_at, quotes(customer_description, customers(name))",
    )
    .order("issued_at", { ascending: true });

  if (invoicesError) {
    console.error("Failed to load invoices for DATEV export:", invoicesError);
    return NextResponse.json({ error: "Export fehlgeschlagen" }, { status: 500 });
  }

  const { data: creditNotes, error: creditNotesError } = await supabase
    .from("credit_notes")
    .select("id, invoice_number, issued_at, amount_cents, reason, original_invoice_id, invoices(invoice_number)")
    .order("issued_at", { ascending: true });

  if (creditNotesError) {
    console.error("Failed to load credit notes for DATEV export:", creditNotesError);
    return NextResponse.json({ error: "Export fehlgeschlagen" }, { status: 500 });
  }

  const invoiceRows: DatevInvoiceRow[] = (invoices ?? []).map((invoice) => {
    const quote = Array.isArray(invoice.quotes) ? invoice.quotes[0] : invoice.quotes;
    const customer = quote ? (Array.isArray(quote.customers) ? quote.customers[0] : quote.customers) : null;
    return {
      invoiceNumber: invoice.invoice_number,
      issuedAt: invoice.issued_at,
      customerName: customer?.name ?? "",
      description: quote?.customer_description ?? "",
      subtotalCents: invoice.subtotal_cents,
      vatCents: invoice.vat_cents,
      totalCents: invoice.total_cents,
      voided: invoice.voided_at !== null,
      creditNoteFor: null,
    };
  });

  const creditNoteRows: DatevInvoiceRow[] = (creditNotes ?? []).map((cn) => {
    const original = Array.isArray(cn.invoices) ? cn.invoices[0] : cn.invoices;
    return {
      invoiceNumber: cn.invoice_number,
      issuedAt: cn.issued_at,
      customerName: "",
      description: cn.reason,
      subtotalCents: 0,
      vatCents: 0,
      totalCents: cn.amount_cents,
      voided: false,
      creditNoteFor: original?.invoice_number ?? null,
    };
  });

  const csvBody = buildDatevInvoiceExport([...invoiceRows, ...creditNoteRows]);
  const bytes = encodeCp1252(csvBody);

  // Fire-and-forget audit log entry for the export event (append-only,
  // written via a SECURITY DEFINER RPC -- see 0034_gobd_invoice_compliance.sql).
  // Not awaited-and-checked as fatal: a failed audit-log write should not
  // block the accountant from getting their export.
  const invoiceIds = (invoices ?? []).map((i) => i.id);
  if (invoiceIds.length > 0) {
    supabase.rpc("log_invoice_export", { p_invoice_ids: invoiceIds, p_format: "datev" }).then(({ error }) => {
      if (error) console.error("Failed to log DATEV export event:", error);
    });
  }

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=windows-1252",
      "Content-Disposition": 'attachment; filename="datev_export.csv"',
    },
  });
}
