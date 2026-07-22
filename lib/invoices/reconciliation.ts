// Pure logic backing the invoice reconciliation dashboard (#130).
//
// v1 scope note: the `invoices` table (supabase/migrations/0008_invoices.sql)
// has no `due_date` and no payment-status column today -- it only records
// `issued_at` and the frozen amounts. This feature depends on real payment
// tracking landing from the online-payment-collection issue (#131) and the
// automated Mahnwesen issue (#122) for full accuracy, but per #130's own
// fallback we ship a due-date-derived version first rather than blocking on
// those.
//
// Concretely:
//   - "Due date" is computed, not stored: issued_at + DEFAULT_PAYMENT_TERM_DAYS
//     (14 days -- a common default payment term for German invoices, "zahlbar
//     innerhalb von 14 Tagen"). This keeps the feature a read-only view over
//     existing data (T2, no migration) rather than adding a schema column
//     before we know the shape #131/#122 will actually need.
//   - There is no "paid" signal anywhere yet, so every invoice is treated as
//     unpaid for now. The `paid` and `partiallyPaid` buckets are therefore
//     always empty in v1 -- they exist in the type/UI so that wiring in the
//     real payment-status column later (#131) is a data-source swap, not a
//     dashboard rewrite.
//   - Invoices are split into just two buckets given the above: `overdue`
//     (past the computed due date) and `unpaid` (not yet due). This is
//     intentionally the full v1 grouping -- see the module doc above.

export const DEFAULT_PAYMENT_TERM_DAYS = 14;

export type ReconciliationInvoice = {
  id: string;
  invoiceNumber: string;
  issuedAt: string | Date;
  totalCents: number;
  customerName: string | null;
  quoteId: string | null;
};

export type PaymentBucket = "paid" | "partiallyPaid" | "overdue" | "unpaid";

export type AgingBucket = "current" | "0-30" | "30-60" | "60+";

export type ReconciledInvoice = ReconciliationInvoice & {
  dueDate: Date;
  daysPastDue: number;
  bucket: PaymentBucket;
  agingBucket: AgingBucket | null;
};

export type ReconciliationSummary = {
  invoices: ReconciledInvoice[];
  totalOutstandingCents: number;
  countsByBucket: Record<PaymentBucket, number>;
  totalsByBucket: Record<PaymentBucket, number>;
  aging: Record<AgingBucket, { count: number; totalCents: number }>;
};

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Computes the due-date-derived aging bucket for an invoice that is past due.
 * `daysPastDue` <= 0 means not yet overdue (handled by the caller before this
 * is invoked), so this only distinguishes among 0-30 / 30-60 / 60+ days late.
 */
function agingBucketFor(daysPastDue: number): AgingBucket {
  if (daysPastDue <= 30) return "0-30";
  if (daysPastDue <= 60) return "30-60";
  return "60+";
}

/**
 * Builds the full reconciliation summary (per-invoice buckets, aging, and
 * outstanding totals) from raw invoice rows. Given "now" as an explicit
 * parameter for testability -- never reaches for `new Date()` internally.
 */
export function reconcileInvoices(
  invoices: ReconciliationInvoice[],
  now: Date = new Date(),
  paymentTermDays: number = DEFAULT_PAYMENT_TERM_DAYS,
): ReconciliationSummary {
  const reconciled: ReconciledInvoice[] = invoices.map((invoice) => {
    const issuedAt = toDate(invoice.issuedAt);
    const dueDate = addDays(issuedAt, paymentTermDays);
    const msPastDue = now.getTime() - dueDate.getTime();
    const daysPastDue = Math.floor(msPastDue / (1000 * 60 * 60 * 24));

    // No payment-status signal exists yet (see module doc): every invoice is
    // either overdue or unpaid-but-not-yet-due. `paid`/`partiallyPaid` are
    // unreachable in v1 but kept in the type for the future data-source swap.
    const bucket: PaymentBucket = daysPastDue > 0 ? "overdue" : "unpaid";
    const agingBucket = bucket === "overdue" ? agingBucketFor(daysPastDue) : null;

    return {
      ...invoice,
      dueDate,
      daysPastDue,
      bucket,
      agingBucket,
    };
  });

  const countsByBucket: Record<PaymentBucket, number> = {
    paid: 0,
    partiallyPaid: 0,
    overdue: 0,
    unpaid: 0,
  };
  const totalsByBucket: Record<PaymentBucket, number> = {
    paid: 0,
    partiallyPaid: 0,
    overdue: 0,
    unpaid: 0,
  };
  const aging: ReconciliationSummary["aging"] = {
    current: { count: 0, totalCents: 0 },
    "0-30": { count: 0, totalCents: 0 },
    "30-60": { count: 0, totalCents: 0 },
    "60+": { count: 0, totalCents: 0 },
  };

  let totalOutstandingCents = 0;

  for (const invoice of reconciled) {
    countsByBucket[invoice.bucket] += 1;
    totalsByBucket[invoice.bucket] += invoice.totalCents;

    // Outstanding = anything not fully paid. Since `paid` is unreachable in
    // v1 (see above), this is currently "all invoices" -- but written against
    // the bucket so it stays correct once payment-status data lands.
    if (invoice.bucket !== "paid") {
      totalOutstandingCents += invoice.totalCents;
    }

    if (invoice.agingBucket) {
      aging[invoice.agingBucket].count += 1;
      aging[invoice.agingBucket].totalCents += invoice.totalCents;
    } else if (invoice.bucket === "unpaid") {
      aging.current.count += 1;
      aging.current.totalCents += invoice.totalCents;
    }
  }

  return {
    invoices: reconciled,
    totalOutstandingCents,
    countsByBucket,
    totalsByBucket,
    aging,
  };
}
