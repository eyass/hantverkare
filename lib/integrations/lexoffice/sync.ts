import type { SupabaseClient } from "@supabase/supabase-js";
import { createInvoiceVoucher, LexofficeApiError } from "./client";
import { VAT_RATE } from "@/lib/quotes/pricing";

/**
 * Best-effort push of a newly-created invoice to lexoffice (issue #165).
 *
 * Intentionally never throws: this is called right after createInvoice() in
 * app/(app)/quotes/[id]/actions.ts, and a third-party API being slow, down,
 * or rejecting the payload must never block or roll back the app's own
 * invoice creation (the invoice always exists in our DB regardless of sync
 * outcome). Every failure path here only logs and returns -- callers don't
 * need to check a return value, and none of them do.
 *
 * Must be called with a service-role admin client (lib/supabase/admin.ts):
 * it reads organizations.lexoffice_api_key, which is never exposed through a
 * client-readable RLS-scoped select.
 */
export async function syncInvoiceToLexoffice(
  admin: SupabaseClient,
  invoiceId: string,
): Promise<void> {
  try {
    const { data: invoice, error: invoiceError } = await admin
      .from("invoices")
      .select(
        "id, organization_id, quote_id, invoice_number, issued_at, lexoffice_voucher_id",
      )
      .eq("id", invoiceId)
      .maybeSingle();

    if (invoiceError || !invoice) {
      console.error("[lexoffice sync] failed to load invoice:", invoiceError);
      return;
    }

    if (invoice.lexoffice_voucher_id) {
      // Already synced -- never re-push (avoids duplicate vouchers in
      // lexoffice on retry/re-render, e.g. if this were ever called twice
      // for the same invoice).
      return;
    }

    const { data: org, error: orgError } = await admin
      .from("organizations")
      .select("lexoffice_api_key, lexoffice_sync_enabled")
      .eq("id", invoice.organization_id)
      .maybeSingle();

    if (orgError || !org) {
      console.error("[lexoffice sync] failed to load organization:", orgError);
      return;
    }

    if (!org.lexoffice_sync_enabled || !org.lexoffice_api_key) {
      // Not opted in, or no key saved -- silently skip, this is the expected
      // path for the vast majority of organizations that never enable sync.
      return;
    }

    const { data: quote, error: quoteError } = await admin
      .from("quotes")
      .select("customer_description, customer_id")
      .eq("id", invoice.quote_id)
      .maybeSingle();

    if (quoteError || !quote) {
      console.error("[lexoffice sync] failed to load quote for invoice:", quoteError);
      return;
    }

    let customerName = quote.customer_description ?? "Kunde";
    if (quote.customer_id) {
      const { data: customer } = await admin
        .from("customers")
        .select("name")
        .eq("id", quote.customer_id)
        .maybeSingle();
      if (customer?.name) {
        customerName = customer.name;
      }
    }

    const { data: lineItems, error: lineItemsError } = await admin
      .from("quote_line_items")
      .select("description, quantity, unit, unit_price_cents")
      .eq("quote_id", invoice.quote_id)
      .order("position");

    if (lineItemsError || !lineItems || lineItems.length === 0) {
      console.error(
        "[lexoffice sync] failed to load line items for invoice:",
        lineItemsError,
      );
      return;
    }

    const result = await createInvoiceVoucher(org.lexoffice_api_key, {
      voucherDate: new Date(invoice.issued_at).toISOString().slice(0, 10),
      customerName,
      ourInvoiceNumber: invoice.invoice_number,
      lineItems: lineItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitName: item.unit,
        unitPriceNetCents: item.unit_price_cents,
        vatRatePercent: VAT_RATE * 100,
      })),
    });

    const { error: updateError } = await admin
      .from("invoices")
      .update({ lexoffice_voucher_id: result.id })
      .eq("id", invoiceId);

    if (updateError) {
      console.error(
        "[lexoffice sync] invoice synced but failed to store voucher id:",
        updateError,
      );
    }
  } catch (error) {
    if (error instanceof LexofficeApiError) {
      console.error(
        `[lexoffice sync] lexoffice API error (${error.status}) for invoice ${invoiceId}:`,
        error.body,
      );
    } else {
      console.error(`[lexoffice sync] unexpected error for invoice ${invoiceId}:`, error);
    }
  }
}
