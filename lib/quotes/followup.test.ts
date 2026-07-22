import { describe, it, expect } from "vitest";
import { daysSinceFinalized, isStalledQuote, FOLLOWUP_THRESHOLD_DAYS } from "./followup";

const DAY = 24 * 60 * 60 * 1000;

describe("daysSinceFinalized", () => {
  it("floors partial days elapsed", () => {
    const now = new Date("2026-01-10T12:00:00Z");
    expect(daysSinceFinalized(new Date(now.getTime() - 5 * DAY - 60 * 60 * 1000), now)).toBe(5);
    expect(daysSinceFinalized(new Date(now.getTime() - 1000), now)).toBe(0);
  });
});

describe("isStalledQuote", () => {
  const now = new Date("2026-01-10T00:00:00Z");

  it("defaults threshold to 5 days", () => {
    expect(FOLLOWUP_THRESHOLD_DAYS).toBe(5);
  });

  it("is true once a final, unsigned, undeclined quote has aged past the threshold", () => {
    expect(
      isStalledQuote(
        {
          status: "final",
          declinedAt: null,
          signedAt: null,
          finalizedAt: new Date(now.getTime() - 5 * DAY),
        },
        now,
      ),
    ).toBe(true);
  });

  it("is false before the threshold is reached", () => {
    expect(
      isStalledQuote(
        {
          status: "final",
          declinedAt: null,
          signedAt: null,
          finalizedAt: new Date(now.getTime() - 4 * DAY),
        },
        now,
      ),
    ).toBe(false);
  });

  it("is false for draft quotes", () => {
    expect(
      isStalledQuote(
        { status: "draft", declinedAt: null, signedAt: null, finalizedAt: new Date(now.getTime() - 10 * DAY) },
        now,
      ),
    ).toBe(false);
  });

  it("is false once declined", () => {
    expect(
      isStalledQuote(
        {
          status: "final",
          declinedAt: new Date(now.getTime() - DAY),
          signedAt: null,
          finalizedAt: new Date(now.getTime() - 10 * DAY),
        },
        now,
      ),
    ).toBe(false);
  });

  it("is false once signed", () => {
    expect(
      isStalledQuote(
        {
          status: "final",
          declinedAt: null,
          signedAt: new Date(now.getTime() - DAY),
          finalizedAt: new Date(now.getTime() - 10 * DAY),
        },
        now,
      ),
    ).toBe(false);
  });

  it("is false with no finalizedAt", () => {
    expect(
      isStalledQuote({ status: "final", declinedAt: null, signedAt: null, finalizedAt: null }, now),
    ).toBe(false);
  });

  it("supports a custom threshold", () => {
    expect(
      isStalledQuote(
        {
          status: "final",
          declinedAt: null,
          signedAt: null,
          finalizedAt: new Date(now.getTime() - 2 * DAY),
        },
        now,
        2,
      ),
    ).toBe(true);
  });
});
