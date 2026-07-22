import { describe, it, expect } from "vitest";
import {
  computeExpiryDate,
  daysUntilExpiry,
  isExpired,
  isInReminderWindow,
  formatExpiryBadge,
  DEFAULT_EXPIRY_DAYS,
} from "./expiry";

const DAY = 24 * 60 * 60 * 1000;

describe("computeExpiryDate", () => {
  it("defaults to 14 days out", () => {
    const from = new Date("2026-01-01T00:00:00Z");
    const result = computeExpiryDate(from);
    expect(result.toISOString()).toBe("2026-01-15T00:00:00.000Z");
    expect(DEFAULT_EXPIRY_DAYS).toBe(14);
  });

  it("supports a custom number of days", () => {
    const from = new Date("2026-01-01T00:00:00Z");
    const result = computeExpiryDate(from, 7);
    expect(result.toISOString()).toBe("2026-01-08T00:00:00.000Z");
  });
});

describe("daysUntilExpiry", () => {
  const now = new Date("2026-01-01T12:00:00Z");

  it("rounds up partial days remaining", () => {
    expect(daysUntilExpiry(new Date(now.getTime() + 23 * 60 * 60 * 1000), now)).toBe(1);
    expect(daysUntilExpiry(new Date(now.getTime() + 3 * DAY), now)).toBe(3);
  });

  it("is negative once expired", () => {
    expect(daysUntilExpiry(new Date(now.getTime() - DAY), now)).toBe(-1);
  });

  it("is zero at the exact expiry instant", () => {
    expect(daysUntilExpiry(now, now)).toBe(0);
  });
});

describe("isExpired", () => {
  const now = new Date("2026-01-01T12:00:00Z");

  it("is true in the past and at the exact instant", () => {
    expect(isExpired(new Date(now.getTime() - 1), now)).toBe(true);
    expect(isExpired(now, now)).toBe(true);
  });

  it("is false in the future", () => {
    expect(isExpired(new Date(now.getTime() + 1), now)).toBe(false);
  });
});

describe("isInReminderWindow", () => {
  const now = new Date("2026-01-01T12:00:00Z");

  it("is false once already expired", () => {
    expect(isInReminderWindow(new Date(now.getTime() - DAY), now)).toBe(false);
  });

  it("is false when expiry is further out than the window", () => {
    expect(isInReminderWindow(new Date(now.getTime() + 4 * DAY), now)).toBe(false);
  });

  it("is true right at the window edge (default 3 days)", () => {
    expect(isInReminderWindow(new Date(now.getTime() + 3 * DAY), now)).toBe(true);
  });

  it("is true for a quote expiring later today", () => {
    expect(isInReminderWindow(new Date(now.getTime() + 60 * 60 * 1000), now)).toBe(true);
  });

  it("respects a custom window size", () => {
    expect(isInReminderWindow(new Date(now.getTime() + 5 * DAY), now, 7)).toBe(true);
    expect(isInReminderWindow(new Date(now.getTime() + 5 * DAY), now, 2)).toBe(false);
  });
});

describe("formatExpiryBadge", () => {
  const now = new Date("2026-01-01T12:00:00Z");

  it("reads 'Abgelaufen' once expired", () => {
    expect(formatExpiryBadge(new Date(now.getTime() - DAY), now)).toEqual({
      label: "Abgelaufen",
      tone: "expired",
    });
  });

  it("reads 'Läuft heute ab' on the expiry day", () => {
    expect(formatExpiryBadge(new Date(now.getTime() + 30 * 60 * 1000), now)).toEqual({
      label: "Läuft heute ab",
      tone: "warning",
    });
  });

  it("reads 'Läuft morgen ab' one day out", () => {
    expect(formatExpiryBadge(new Date(now.getTime() + 25 * 60 * 60 * 1000), now)).toEqual({
      label: "Läuft morgen ab",
      tone: "warning",
    });
  });

  it("counts days with a warning tone inside the reminder window", () => {
    expect(formatExpiryBadge(new Date(now.getTime() + 3 * DAY), now)).toEqual({
      label: "Läuft in 3 Tagen ab",
      tone: "warning",
    });
  });

  it("uses a neutral tone well before expiry", () => {
    expect(formatExpiryBadge(new Date(now.getTime() + 10 * DAY), now)).toEqual({
      label: "Läuft in 10 Tagen ab",
      tone: "neutral",
    });
  });
});
