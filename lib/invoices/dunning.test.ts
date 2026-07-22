import { describe, it, expect } from "vitest";
import {
  daysOverdue,
  nextDunningStage,
  calculateVerzugszinsenCents,
  STATUTORY_DEFAULT_INTEREST_RATE,
} from "./dunning";

const DAY = 24 * 60 * 60 * 1000;

describe("daysOverdue", () => {
  it("is zero on the due date itself", () => {
    const due = new Date("2026-01-01T00:00:00Z");
    expect(daysOverdue(due, due)).toBe(0);
  });

  it("counts whole days elapsed since due_date", () => {
    const due = new Date("2026-01-01T00:00:00Z");
    expect(daysOverdue(due, new Date(due.getTime() + 5 * DAY))).toBe(5);
  });

  it("is negative before the due date", () => {
    const due = new Date("2026-01-10T00:00:00Z");
    expect(daysOverdue(due, new Date(due.getTime() - 2 * DAY))).toBe(-2);
  });
});

describe("nextDunningStage", () => {
  const thresholds = { reminderDays: 3, mahnungDays: 10, escalationDays: 24 };
  const noneSent = { paymentReminderSentAt: null, mahnungSentAt: null, escalationSentAt: null };

  it("returns null before the first threshold", () => {
    expect(nextDunningStage(2, thresholds, noneSent)).toBeNull();
  });

  it("returns 'reminder' once past the reminder threshold", () => {
    expect(nextDunningStage(3, thresholds, noneSent)).toBe("reminder");
    expect(nextDunningStage(9, thresholds, noneSent)).toBe("reminder");
  });

  it("returns 'mahnung' once past the mahnung threshold, even if reminder was never sent", () => {
    expect(nextDunningStage(10, thresholds, noneSent)).toBe("mahnung");
  });

  it("does not resend 'reminder' once it has already been sent", () => {
    const stamps = { ...noneSent, paymentReminderSentAt: new Date("2026-01-01") };
    expect(nextDunningStage(5, thresholds, stamps)).toBeNull();
  });

  it("never returns 'escalation' before mahnung has actually been sent", () => {
    // Even far past the escalation threshold, escalation cannot fire until
    // mahnung_sent_at is set -- the sequence is strictly ordered.
    expect(nextDunningStage(100, thresholds, noneSent)).toBe("mahnung");
  });

  it("returns 'escalation' once past the escalation threshold and mahnung was sent", () => {
    const stamps = { ...noneSent, mahnungSentAt: new Date("2026-01-01") };
    expect(nextDunningStage(24, thresholds, stamps)).toBe("escalation");
  });

  it("returns null once every stage has already been sent", () => {
    const stamps = {
      paymentReminderSentAt: new Date("2026-01-01"),
      mahnungSentAt: new Date("2026-01-08"),
      escalationSentAt: new Date("2026-01-20"),
    };
    expect(nextDunningStage(100, thresholds, stamps)).toBeNull();
  });
});

describe("calculateVerzugszinsenCents", () => {
  it("is zero when not yet overdue", () => {
    expect(calculateVerzugszinsenCents(100_00, 0)).toBe(0);
    expect(calculateVerzugszinsenCents(100_00, -5)).toBe(0);
  });

  it("is zero for a non-positive invoice total", () => {
    expect(calculateVerzugszinsenCents(0, 10)).toBe(0);
    expect(calculateVerzugszinsenCents(-500, 10)).toBe(0);
  });

  it("computes simple daily interest at the statutory default rate", () => {
    // 1000.00 EUR over 365 days at the statutory rate should equal exactly
    // one year of interest (rounded to the cent).
    const cents = calculateVerzugszinsenCents(100_000, 365);
    expect(cents).toBe(Math.round(100_000 * STATUTORY_DEFAULT_INTEREST_RATE));
  });

  it("supports a custom annual rate", () => {
    expect(calculateVerzugszinsenCents(100_000, 365, 0.1)).toBe(10_000);
  });
});
