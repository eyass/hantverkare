"use client";

import { useState, useTransition } from "react";
import { issueCreditNote } from "./actions";

/**
 * Inline "issue credit note" form for a single invoice. This is the ONLY
 * in-app way to correct an issued invoice -- there is deliberately no edit
 * form for invoices themselves (see supabase/migrations/0034_gobd_invoice_compliance.sql).
 */
export function CreditNoteForm({
  invoiceId,
  invoiceNumber,
  totalCents,
  alreadyVoided,
}: {
  invoiceId: string;
  invoiceNumber: string;
  totalCents: number;
  alreadyVoided: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState(() => (totalCents / 100).toFixed(2));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (alreadyVoided) {
    return <span className="text-xs text-[#64748b]">Gutschrift bereits erstellt</span>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-[#e9edf2] px-2.5 py-1 text-xs font-medium text-[#0f172a] hover:bg-[#f8fafc]"
      >
        Gutschrift erstellen
      </button>
    );
  }

  return (
    <form
      className="flex flex-col gap-2 rounded-lg border border-[#e9edf2] bg-[#f8fafc] p-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const amountCents = Math.round(-Math.abs(parseFloat(amount.replace(",", "."))) * 100);
        if (!Number.isFinite(amountCents) || amountCents === 0) {
          setError("Bitte gib einen gültigen Betrag an.");
          return;
        }
        startTransition(async () => {
          const result = await issueCreditNote(invoiceId, reason, amountCents);
          if (result.error || !result.creditNote) {
            setError(result.error ?? "Gutschrift konnte nicht erstellt werden.");
            return;
          }
          setSuccess(`Gutschrift ${result.creditNote.invoice_number} erstellt.`);
          setOpen(false);
        });
      }}
    >
      <label className="text-xs font-medium text-[#0f172a]">
        Grund für die Gutschrift zu {invoiceNumber}
        <textarea
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1 w-full rounded-md border border-[#e9edf2] p-2 text-sm"
          rows={2}
        />
      </label>
      <label className="text-xs font-medium text-[#0f172a]">
        Betrag (EUR)
        <input
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 w-full rounded-md border border-[#e9edf2] p-2 text-sm"
        />
      </label>
      {error && <p className="text-xs text-[#dc2626]">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-[#0f172a] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {isPending ? "Wird erstellt…" : "Gutschrift bestätigen"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-[#e9edf2] px-3 py-1.5 text-xs font-medium text-[#0f172a]"
        >
          Abbrechen
        </button>
      </div>
      {success && <p className="text-xs text-[#16a34a]">{success}</p>}
    </form>
  );
}
