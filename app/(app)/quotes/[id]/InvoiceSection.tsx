"use client";

import { useState, useTransition } from "react";
import { createInvoice } from "./actions";

type Invoice = {
  id: string;
  invoice_number: string;
  issued_at: string;
  subtotal_cents: number;
  vat_cents: number;
  total_cents: number;
};

function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE");
}

export function InvoiceSection({ quoteId, invoice: initialInvoice }: { quoteId: string; invoice: Invoice | null }) {
  const [invoice, setInvoice] = useState(initialInvoice);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCreateInvoice() {
    startTransition(async () => {
      const result = await createInvoice(quoteId);
      if (result.error !== null) {
        setError(result.error);
        return;
      }
      setError(null);
      setInvoice(result.invoice);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded border border-zinc-300 p-4 dark:border-zinc-700">
      <h2 className="text-lg font-semibold">Rechnung</h2>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {invoice ? (
        <dl className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <dt>Rechnungsnummer</dt>
            <dd className="font-medium">{invoice.invoice_number}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Rechnungsdatum</dt>
            <dd>{formatDate(invoice.issued_at)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Zwischensumme</dt>
            <dd>{formatEuros(invoice.subtotal_cents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>MwSt.</dt>
            <dd>{formatEuros(invoice.vat_cents)}</dd>
          </div>
          <div className="flex justify-between font-semibold">
            <dt>Gesamt</dt>
            <dd>{formatEuros(invoice.total_cents)}</dd>
          </div>
        </dl>
      ) : (
        <button
          onClick={handleCreateInvoice}
          disabled={isPending}
          className="self-end rounded-full bg-foreground px-5 py-3 text-background disabled:opacity-50"
        >
          Rechnung erstellen
        </button>
      )}
    </div>
  );
}
