import { describe, it, expect } from "vitest";
import {
  isGenuineSubscriptionActivation,
  shouldAttemptReferralGrant,
  computeExtendedTrialEndsAt,
  REFERRAL_BONUS_DAYS,
} from "./reward";

describe("isGenuineSubscriptionActivation", () => {
  it("treats only 'active' as genuine activation", () => {
    expect(isGenuineSubscriptionActivation("active")).toBe(true);
  });

  it("does not treat trialing as genuine activation", () => {
    expect(isGenuineSubscriptionActivation("trialing")).toBe(false);
  });

  it("does not treat past_due/canceled/incomplete/null as genuine activation", () => {
    expect(isGenuineSubscriptionActivation("past_due")).toBe(false);
    expect(isGenuineSubscriptionActivation("canceled")).toBe(false);
    expect(isGenuineSubscriptionActivation("incomplete")).toBe(false);
    expect(isGenuineSubscriptionActivation(null)).toBe(false);
    expect(isGenuineSubscriptionActivation(undefined)).toBe(false);
  });
});

describe("shouldAttemptReferralGrant", () => {
  it("is false when there is no referral at all", () => {
    expect(shouldAttemptReferralGrant(null, "active")).toBe(false);
  });

  it("is false when the reward was already granted (the core anti-double-fire case)", () => {
    expect(
      shouldAttemptReferralGrant({ rewardGrantedAt: "2026-01-01T00:00:00.000Z" }, "active"),
    ).toBe(false);
  });

  it("is false for a pending referral when the status isn't a genuine activation yet", () => {
    expect(shouldAttemptReferralGrant({ rewardGrantedAt: null }, "trialing")).toBe(false);
    expect(shouldAttemptReferralGrant({ rewardGrantedAt: null }, "past_due")).toBe(false);
    expect(shouldAttemptReferralGrant({ rewardGrantedAt: null }, null)).toBe(false);
  });

  it("is true only for a pending referral with a genuine active status", () => {
    expect(shouldAttemptReferralGrant({ rewardGrantedAt: null }, "active")).toBe(true);
  });

  it("stays false across repeated calls simulating a redelivered webhook once granted", () => {
    // Simulates: event fires, we grant (rewardGrantedAt flips), event
    // redelivers (Stripe retries on non-2xx/timeout) -- must not re-attempt.
    const beforeGrant = { rewardGrantedAt: null as string | null };
    expect(shouldAttemptReferralGrant(beforeGrant, "active")).toBe(true);
    const afterGrant = { rewardGrantedAt: new Date().toISOString() };
    expect(shouldAttemptReferralGrant(afterGrant, "active")).toBe(false);
  });
});

describe("computeExtendedTrialEndsAt", () => {
  const now = Date.parse("2026-07-22T00:00:00.000Z");

  it("extends from now by the bonus days when there is no current trial_ends_at", () => {
    const result = computeExtendedTrialEndsAt(null, now);
    expect(Date.parse(result)).toBe(now + REFERRAL_BONUS_DAYS * 24 * 60 * 60 * 1000);
  });

  it("extends from the current trial_ends_at when it is in the future", () => {
    const future = new Date(now + 10 * 24 * 60 * 60 * 1000).toISOString();
    const result = computeExtendedTrialEndsAt(future, now);
    expect(Date.parse(result)).toBe(Date.parse(future) + REFERRAL_BONUS_DAYS * 24 * 60 * 60 * 1000);
  });

  it("extends from now (not the past) when the current trial_ends_at has already lapsed", () => {
    const past = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString();
    const result = computeExtendedTrialEndsAt(past, now);
    expect(Date.parse(result)).toBe(now + REFERRAL_BONUS_DAYS * 24 * 60 * 60 * 1000);
  });

  it("falls back to now when given an unparseable trial_ends_at", () => {
    const result = computeExtendedTrialEndsAt("not-a-date", now);
    expect(Date.parse(result)).toBe(now + REFERRAL_BONUS_DAYS * 24 * 60 * 60 * 1000);
  });
});
