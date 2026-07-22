import { describe, expect, it } from "vitest";
import { daysSincePaid, isReviewRequestDue } from "./reviewRequest";

describe("daysSincePaid", () => {
  it("returns whole days elapsed since paidAt", () => {
    const paidAt = new Date("2026-07-01T00:00:00Z");
    const now = new Date("2026-07-04T00:00:00Z");
    expect(daysSincePaid(paidAt, now)).toBe(3);
  });

  it("returns 0 for the same instant", () => {
    const paidAt = new Date("2026-07-01T00:00:00Z");
    expect(daysSincePaid(paidAt, paidAt)).toBe(0);
  });

  it("returns a negative number if paidAt is in the future relative to now", () => {
    const paidAt = new Date("2026-07-10T00:00:00Z");
    const now = new Date("2026-07-04T00:00:00Z");
    expect(daysSincePaid(paidAt, now)).toBeLessThan(0);
  });
});

describe("isReviewRequestDue", () => {
  it("is false before the configured threshold", () => {
    expect(isReviewRequestDue(2, 3, null)).toBe(false);
  });

  it("is true once the threshold is reached", () => {
    expect(isReviewRequestDue(3, 3, null)).toBe(true);
    expect(isReviewRequestDue(10, 3, null)).toBe(true);
  });

  it("is false once already sent, regardless of days elapsed", () => {
    expect(isReviewRequestDue(30, 3, new Date("2026-07-01T00:00:00Z"))).toBe(false);
  });
});
