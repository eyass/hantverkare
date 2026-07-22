// Pure logic backing the cash-flow forecast section of the invoice
// reconciliation dashboard (#163). Projects three buckets of expected/
// potential inflow from data that already exists elsewhere:
//
//   1. Unpaid invoices with a due date (due_date/paid_at from the Mahnwesen
//      migration, 0025_invoice_dunning.sql / #122) -- these are "expected":
//      a signed quote has already been turned into a real invoice.
//   2. Upcoming recurring contract renewals (contracts.next_due_date,
//      0024_recurring_contracts.sql / #126) within a configurable window --
//      also "expected": the contract exists and will regenerate a quote/
//      invoice on schedule. Its value is the frozen total_cents of the
//      contract's source quote (contracts carries no value column of its
//      own), passed in by the caller alongside the row.
//   3. Open (sent-but-not-signed) quotes -- deliberately kept in a *separate*
//      "potential" bucket, summed apart from expectedInflowCents, since
//      nothing has been signed yet. The caller is responsible for filtering
//      to "open" quotes (status === 'final', not signed, not declined --
//      see lib/quotes/status.ts's computeQuoteDisplayStatus) before passing
//      them in; this module only sums what it's given.
//
// Kept free of any Supabase/env dependency, same rationale as
// lib/invoices/reconciliation.ts and lib/contracts/interval.ts: pure date/
// money math, unit-testable in isolation, reused identically by whichever
// page renders it.

export type CashFlowInvoice = {
  id: string;
  invoiceNumber: string;
  dueDate: string | Date | null;
  paidAt: string | Date | null;
  totalCents: number;
  customerName: string | null;
};

export type CashFlowContract = {
  id: string;
  nextDueDate: string | Date;
  status: string;
  expectedValueCents: number;
  customerName: string | null;
};

export type CashFlowQuote = {
  id: string;
  totalCents: number;
  customerName: string | null;
};

export type ForecastInvoiceItem = CashFlowInvoice & { dueDate: Date };
export type ForecastContractItem = CashFlowContract & { nextDueDate: Date };

export type CashFlowForecast = {
  /** Sum of unpaid-invoice totals + upcoming (in-window) renewal values. Deliberately excludes the quote pipeline -- see module doc. */
  expectedInflowCents: number;
  unpaidInvoices: {
    count: number;
    totalCents: number;
    items: ForecastInvoiceItem[];
  };
  upcomingRenewals: {
    count: number;
    totalCents: number;
    items: ForecastContractItem[];
  };
  /** Soft/unconfirmed bucket: open quote pipeline value. Kept separate from expectedInflowCents on purpose (nothing here is signed yet). */
  potentialPipelineCents: number;
  openQuotes: {
    count: number;
    totalCents: number;
    items: CashFlowQuote[];
  };
};

export const DEFAULT_RENEWAL_WINDOW_DAYS = 90;

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Builds the cash-flow forecast from raw invoice/contract/quote rows.
 * `now` is an explicit parameter (never reaches for `new Date()`
 * internally) so results are deterministic and testable.
 *
 * Callers are expected to pre-filter:
 *   - invoices: any set (this function itself only counts unpaid ones with
 *     a due date -- paid or due-date-less rows are ignored for the forecast
 *     but don't need to be excluded beforehand).
 *   - contracts: only 'active' contracts are counted; paused/cancelled rows
 *     are ignored automatically.
 *   - quotes: must already be narrowed to "open" (sent, not signed, not
 *     declined) -- this function has no opinion on quote status.
 */
export function buildCashFlowForecast(
  input: {
    invoices: CashFlowInvoice[];
    contracts: CashFlowContract[];
    quotes: CashFlowQuote[];
  },
  now: Date = new Date(),
  renewalWindowDays: number = DEFAULT_RENEWAL_WINDOW_DAYS,
): CashFlowForecast {
  const unpaidItems: ForecastInvoiceItem[] = input.invoices
    .filter((invoice) => invoice.paidAt === null && invoice.dueDate !== null)
    .map((invoice) => ({ ...invoice, dueDate: toDate(invoice.dueDate as string | Date) }))
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  const windowEnd = addDays(now, renewalWindowDays);
  const upcomingRenewalItems: ForecastContractItem[] = input.contracts
    .filter((contract) => contract.status === "active")
    .map((contract) => ({ ...contract, nextDueDate: toDate(contract.nextDueDate) }))
    .filter((contract) => contract.nextDueDate.getTime() <= windowEnd.getTime())
    .sort((a, b) => a.nextDueDate.getTime() - b.nextDueDate.getTime());

  const unpaidTotalCents = unpaidItems.reduce((sum, item) => sum + item.totalCents, 0);
  const renewalTotalCents = upcomingRenewalItems.reduce((sum, item) => sum + item.expectedValueCents, 0);
  const pipelineTotalCents = input.quotes.reduce((sum, item) => sum + item.totalCents, 0);

  return {
    expectedInflowCents: unpaidTotalCents + renewalTotalCents,
    unpaidInvoices: {
      count: unpaidItems.length,
      totalCents: unpaidTotalCents,
      items: unpaidItems,
    },
    upcomingRenewals: {
      count: upcomingRenewalItems.length,
      totalCents: renewalTotalCents,
      items: upcomingRenewalItems,
    },
    potentialPipelineCents: pipelineTotalCents,
    openQuotes: {
      count: input.quotes.length,
      totalCents: pipelineTotalCents,
      items: input.quotes,
    },
  };
}
