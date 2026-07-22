import { describe, it, expect } from "vitest";
import { computeReportsDateRange, isReportsRangePreset } from "./dateRange";

// Fixed "now": Wednesday, 2026-07-22 (mid Q3, mid-year).
const NOW = new Date(2026, 6, 22, 15, 30, 0);

describe("isReportsRangePreset", () => {
  it("accepts known presets", () => {
    expect(isReportsRangePreset("this_month")).toBe(true);
    expect(isReportsRangePreset("last_month")).toBe(true);
    expect(isReportsRangePreset("this_quarter")).toBe(true);
    expect(isReportsRangePreset("this_year")).toBe(true);
    expect(isReportsRangePreset("custom")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isReportsRangePreset("bogus")).toBe(false);
    expect(isReportsRangePreset(undefined)).toBe(false);
    expect(isReportsRangePreset(null)).toBe(false);
    expect(isReportsRangePreset(42)).toBe(false);
  });
});

describe("computeReportsDateRange", () => {
  it("this_month spans the 1st of the current month to the 1st of next month", () => {
    const range = computeReportsDateRange("this_month", null, null, NOW);
    expect(range.startISO).toBe(new Date(2026, 6, 1).toISOString());
    expect(range.endISO).toBe(new Date(2026, 7, 1).toISOString());
    expect(range.preset).toBe("this_month");
  });

  it("last_month spans the prior calendar month", () => {
    const range = computeReportsDateRange("last_month", null, null, NOW);
    expect(range.startISO).toBe(new Date(2026, 5, 1).toISOString());
    expect(range.endISO).toBe(new Date(2026, 6, 1).toISOString());
  });

  it("last_month rolls back across a year boundary", () => {
    const jan = new Date(2026, 0, 15);
    const range = computeReportsDateRange("last_month", null, null, jan);
    expect(range.startISO).toBe(new Date(2025, 11, 1).toISOString());
    expect(range.endISO).toBe(new Date(2026, 0, 1).toISOString());
  });

  it("this_quarter spans Jul 1 - Oct 1 for a July 'now'", () => {
    const range = computeReportsDateRange("this_quarter", null, null, NOW);
    expect(range.startISO).toBe(new Date(2026, 6, 1).toISOString());
    expect(range.endISO).toBe(new Date(2026, 9, 1).toISOString());
  });

  it("this_year spans Jan 1 - Jan 1 next year", () => {
    const range = computeReportsDateRange("this_year", null, null, NOW);
    expect(range.startISO).toBe(new Date(2026, 0, 1).toISOString());
    expect(range.endISO).toBe(new Date(2027, 0, 1).toISOString());
  });

  it("custom uses the from/to dates with an exclusive end (day after 'to')", () => {
    const range = computeReportsDateRange("custom", "2026-03-01", "2026-03-15", NOW);
    expect(range.preset).toBe("custom");
    expect(range.startISO).toBe(new Date(2026, 2, 1).toISOString());
    expect(range.endISO).toBe(new Date(2026, 2, 16).toISOString());
    expect(range.customFrom).toBe("2026-03-01");
    expect(range.customTo).toBe("2026-03-15");
  });

  it("custom falls back to this_month when from is missing", () => {
    const range = computeReportsDateRange("custom", null, "2026-03-15", NOW);
    expect(range.preset).toBe("this_month");
  });

  it("custom falls back to this_month when to is missing", () => {
    const range = computeReportsDateRange("custom", "2026-03-01", null, NOW);
    expect(range.preset).toBe("this_month");
  });

  it("custom falls back to this_month when from is after to", () => {
    const range = computeReportsDateRange("custom", "2026-03-20", "2026-03-01", NOW);
    expect(range.preset).toBe("this_month");
  });

  it("custom falls back to this_month on unparseable dates", () => {
    const range = computeReportsDateRange("custom", "not-a-date", "2026-03-15", NOW);
    expect(range.preset).toBe("this_month");
  });

  it("custom falls back to this_month on an invalid calendar date (Feb 31)", () => {
    const range = computeReportsDateRange("custom", "2026-02-31", "2026-03-01", NOW);
    expect(range.preset).toBe("this_month");
  });

  it("custom allows a single-day range (from === to)", () => {
    const range = computeReportsDateRange("custom", "2026-03-15", "2026-03-15", NOW);
    expect(range.preset).toBe("custom");
    expect(range.startISO).toBe(new Date(2026, 2, 15).toISOString());
    expect(range.endISO).toBe(new Date(2026, 2, 16).toISOString());
  });
});
