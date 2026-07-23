/**
 * Pure aggregation helper for the declined-quotes report section (issue #210).
 *
 * Kept separate from the page component so the summary math (count + total
 * lost value) can be unit tested without a Supabase client.
 */

export type DeclinedQuoteRow = {
  id: string;
  customer_description: string;
  decline_reason: string | null;
  declined_at: string;
  total_cents: number;
};

export type DeclinedQuotesSummary = {
  count: number;
  totalLostCents: number;
};

export function summarizeDeclinedQuotes(rows: DeclinedQuoteRow[]): DeclinedQuotesSummary {
  return rows.reduce<DeclinedQuotesSummary>(
    (acc, row) => ({
      count: acc.count + 1,
      totalLostCents: acc.totalLostCents + row.total_cents,
    }),
    { count: 0, totalLostCents: 0 },
  );
}
