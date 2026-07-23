import { describe, it, expect } from "vitest";
import { summarizeDeclinedQuotes, type DeclinedQuoteRow } from "./declinedQuotes";

function row(overrides: Partial<DeclinedQuoteRow> = {}): DeclinedQuoteRow {
  return {
    id: "quote-1",
    customer_description: "Bathroom renovation",
    decline_reason: "Too expensive",
    declined_at: "2026-07-01T10:00:00.000Z",
    total_cents: 100000,
    ...overrides,
  };
}

describe("summarizeDeclinedQuotes", () => {
  it("returns zero count and zero total for an empty list", () => {
    expect(summarizeDeclinedQuotes([])).toEqual({ count: 0, totalLostCents: 0 });
  });

  it("sums total_cents across all rows", () => {
    const rows = [
      row({ id: "1", total_cents: 100000 }),
      row({ id: "2", total_cents: 25000 }),
      row({ id: "3", total_cents: 5000 }),
    ];
    expect(summarizeDeclinedQuotes(rows)).toEqual({ count: 3, totalLostCents: 130000 });
  });

  it("counts rows with null decline reasons the same as any other row", () => {
    const rows = [row({ id: "1", decline_reason: null })];
    expect(summarizeDeclinedQuotes(rows)).toEqual({ count: 1, totalLostCents: 100000 });
  });
});
