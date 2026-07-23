"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type IssueCreditNoteResult =
  | { error: string; creditNote?: never }
  | { error: null; creditNote: { id: string; invoice_number: string; amount_cents: number } };

/**
 * Issues a credit note against an invoice -- the ONLY supported correction
 * path (GoBD: invoices are immutable once issued, see
 * supabase/migrations/0034_gobd_invoice_compliance.sql). This calls the
 * issue_credit_note() SECURITY DEFINER RPC rather than inserting into
 * credit_notes directly, since the RPC also draws the credit note's number
 * from the shared per-org/year sequence and stamps voided_at on the
 * original invoice in the same transaction.
 */
export async function issueCreditNote(
  invoiceId: string,
  reason: string,
  amountCents: number,
): Promise<IssueCreditNoteResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Bitte melde dich an." };
  }

  if (!reason || reason.trim().length === 0) {
    return { error: "Bitte gib einen Grund für die Gutschrift an." };
  }
  if (!Number.isFinite(amountCents) || amountCents === 0) {
    return { error: "Bitte gib einen gültigen Betrag an." };
  }

  const { data, error } = await supabase.rpc("issue_credit_note", {
    p_invoice_id: invoiceId,
    p_reason: reason.trim(),
    p_amount_cents: Math.round(amountCents),
  });

  if (error || !data) {
    console.error("Failed to issue credit note:", error);
    return { error: "Gutschrift konnte nicht erstellt werden." };
  }

  revalidatePath("/invoices");

  return {
    error: null,
    creditNote: {
      id: data.id as string,
      invoice_number: data.invoice_number as string,
      amount_cents: data.amount_cents as number,
    },
  };
}

/**
 * Records an 'exported' audit-log event for the given invoices. Called by
 * the DATEV/CSV export routes after a successful export so the append-only
 * invoice_audit_log has a complete trail of who exported what and when (see
 * 0034_gobd_invoice_compliance.sql's log_invoice_export() RPC).
 */
export async function logInvoiceExport(invoiceIds: string[], format: "csv" | "datev"): Promise<void> {
  if (invoiceIds.length === 0) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("log_invoice_export", {
    p_invoice_ids: invoiceIds,
    p_format: format,
  });
  if (error) {
    console.error("Failed to log invoice export event:", error);
  }
}
