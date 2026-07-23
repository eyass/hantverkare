"use client";

import { useState, useTransition } from "react";
import { createInvoice, createInvoicePaymentSession } from "./actions";

type Invoice = {
  id: string;
  invoice_number: string;
  issued_at: string;
  subtotal_cents: number;
  vat_cents: number;
  total_cents: number;
  payment_status: "unpaid" | "partial" | "paid";
  amount_paid_cents: number;
};

function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE");
}

function paymentStatusLabel(status: Invoice["payment_status"]): string {
  if (status === "paid") return "Bezahlt";
  if (status === "partial") return "Teilweise bezahlt";
  return "Offen";
}

function paymentStatusBadgeClasses(status: Invoice["payment_status"]): string {
  if (status === "paid") return "bg-[#dcfce7] text-[#16a34a]";
  if (status === "partial") return "bg-[#fef9c3] text-[#a16207]";
  return "bg-[#f1f5f9] text-[#64748b]";
}

export function InvoiceSection({
  quoteId,
  invoice: initialInvoice,
  connectOnboarded,
}: {
  quoteId: string;
  invoice: Invoice | null;
  connectOnboarded: boolean;
}) {
  const [invoice, setInvoice] = useState(initialInvoice);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isPaymentPending, startPaymentTransition] = useTransition();

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

  function handlePayNow() {
    if (!invoice) return;
    setError(null);
    startPaymentTransition(async () => {
      const result = await createInvoicePaymentSession(quoteId, invoice.id);
      if (result.error !== null) {
        setError(result.error);
        return;
      }
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#e9edf2] bg-[#f8fafc] p-4">
      <h2 className="text-sm font-semibold text-[#0f172a]">Rechnung</h2>
      {error && <p className="text-sm text-[#dc2626]">{error}</p>}
      {invoice ? (
        <>
          <dl className="flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-[#64748b]">Rechnungsnummer</dt>
              <dd className="font-mono font-medium text-[#0f172a]">{invoice.invoice_number}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#64748b]">Rechnungsdatum</dt>
              <dd className="font-mono text-[#0f172a]">{formatDate(invoice.issued_at)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#64748b]">Zwischensumme</dt>
              <dd className="font-mono text-[#0f172a]">{formatEuros(invoice.subtotal_cents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#64748b]">MwSt.</dt>
              <dd className="font-mono text-[#0f172a]">{formatEuros(invoice.vat_cents)}</dd>
            </div>
            <div className="flex justify-between border-t border-[#e9edf2] pt-1.5 font-semibold">
              <dt className="text-[#0f172a]">Gesamt</dt>
              <dd className="font-mono text-[#0f172a]">{formatEuros(invoice.total_cents)}</dd>
            </div>
            <div className="flex items-center justify-between pt-1">
              <dt className="text-[#64748b]">Zahlungsstatus</dt>
              <dd>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${paymentStatusBadgeClasses(invoice.payment_status)}`}
                >
                  {paymentStatusLabel(invoice.payment_status)}
                </span>
              </dd>
            </div>
          </dl>
          {connectOnboarded && invoice.payment_status !== "paid" && (
            <button
              onClick={handlePayNow}
              disabled={isPaymentPending}
              className="w-full rounded-full bg-[#16a34a] px-5 py-2.5 text-sm font-medium text-white shadow-[0_6px_16px_rgba(22,163,74,0.3)] transition-colors hover:bg-[#15803d] disabled:opacity-50"
            >
              {isPaymentPending ? "Wird vorbereitet…" : "Jetzt bezahlen"}
            </button>
          )}
        </>
      ) : (
        <button
          onClick={handleCreateInvoice}
          disabled={isPending}
          className="w-full rounded-full bg-[#2563eb] px-5 py-2.5 text-sm font-medium text-white shadow-[0_6px_16px_rgba(37,99,235,0.3)] transition-colors hover:bg-[#1d4ed8] disabled:opacity-50"
        >
          Rechnung erstellen
        </button>
      )}
    </div>
  );
}
