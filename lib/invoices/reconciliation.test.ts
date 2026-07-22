import { describe, it, expect } from "vitest";
import { reconcileInvoices, DEFAULT_PAYMENT_TERM_DAYS } from "./reconciliation";

const NOW = new Date("2026-07-22T12:00:00Z");

function invoiceIssuedDaysAgo(days: number, overrides: Partial<Parameters<typeof reconcileInvoices>[0][number]> = {}) {
  const issuedAt = new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    id: `inv-${days}`,
    invoiceNumber: `RE-2026-${String(days).padStart(4, "0")}`,
    issuedAt,
    totalCents: 10000,
    customerName: "Test Kunde",
    quoteId: "quote-1",
    ...overrides,
  };
}

describe("reconcileInvoices", () => {
  it("buckets an invoice issued today as unpaid, not overdue", () => {
    const summary = reconcileInvoices([invoiceIssuedDaysAgo(0)], NOW);
    expect(summary.invoices[0].bucket).toBe("unpaid");
    expect(summary.invoices[0].agingBucket).toBeNull();
    expect(summary.countsByBucket.unpaid).toBe(1);
    expect(summary.countsByBucket.overdue).toBe(0);
  });

  it("treats an invoice right at the payment term boundary as not yet overdue", () => {
    const summary = reconcileInvoices([invoiceIssuedDaysAgo(DEFAULT_PAYMENT_TERM_DAYS)], NOW);
    expect(summary.invoices[0].bucket).toBe("unpaid");
  });

  it("marks an invoice past the payment term as overdue in the 0-30 aging bucket", () => {
    const summary = reconcileInvoices([invoiceIssuedDaysAgo(DEFAULT_PAYMENT_TERM_DAYS + 10)], NOW);
    expect(summary.invoices[0].bucket).toBe("overdue");
    expect(summary.invoices[0].agingBucket).toBe("0-30");
    expect(summary.aging["0-30"].count).toBe(1);
  });

  it("buckets invoices into 30-60 and 60+ aging based on days past due", () => {
    const summary = reconcileInvoices(
      [
        invoiceIssuedDaysAgo(DEFAULT_PAYMENT_TERM_DAYS + 45),
        invoiceIssuedDaysAgo(DEFAULT_PAYMENT_TERM_DAYS + 90),
      ],
      NOW,
    );
    expect(summary.invoices[0].agingBucket).toBe("30-60");
    expect(summary.invoices[1].agingBucket).toBe("60+");
    expect(summary.aging["30-60"].count).toBe(1);
    expect(summary.aging["60+"].count).toBe(1);
  });

  it("never produces paid or partiallyPaid buckets in v1 (no payment-status data source yet)", () => {
    const summary = reconcileInvoices(
      [invoiceIssuedDaysAgo(0), invoiceIssuedDaysAgo(100)],
      NOW,
    );
    expect(summary.countsByBucket.paid).toBe(0);
    expect(summary.countsByBucket.partiallyPaid).toBe(0);
  });

  it("counts every non-paid invoice toward total outstanding", () => {
    const summary = reconcileInvoices(
      [
        invoiceIssuedDaysAgo(0, { totalCents: 5000 }),
        invoiceIssuedDaysAgo(100, { totalCents: 7500 }),
      ],
      NOW,
    );
    expect(summary.totalOutstandingCents).toBe(12500);
  });

  it("respects a custom payment term", () => {
    const summary = reconcileInvoices([invoiceIssuedDaysAgo(5)], NOW, 3);
    expect(summary.invoices[0].bucket).toBe("overdue");
  });

  it("handles an empty invoice list without crashing", () => {
    const summary = reconcileInvoices([], NOW);
    expect(summary.invoices).toEqual([]);
    expect(summary.totalOutstandingCents).toBe(0);
    expect(summary.aging.current.count).toBe(0);
  });
});
